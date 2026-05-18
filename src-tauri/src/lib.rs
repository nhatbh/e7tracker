mod models;
mod capture;
mod detection;
mod cache_service;

use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use cache_service::*;
use std::collections::HashMap;
use tauri::{Manager, Emitter};
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{TrayIconBuilder, TrayIconEvent};
use windows::Win32::Foundation::{HWND, LPARAM, RECT};
use windows::Win32::UI::WindowsAndMessaging::{
    EnumWindows, GetForegroundWindow, GetWindowRect, GetWindowTextW, IsWindowVisible,
};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut};
use image::ImageReader;
use image::RgbImage;

use models::*;
use detection::DetectionEngine;

/// Get the client area rect in screen coordinates.
/// This is the actual content area where the game renders — no borders, no title bar.
fn get_visible_window_rect(hwnd: HWND) -> Option<RECT> {
    unsafe {
        use windows::Win32::Graphics::Gdi::ClientToScreen;

        let mut client_rect = RECT::default();
        if windows::Win32::UI::WindowsAndMessaging::GetClientRect(hwnd, &mut client_rect).is_err() {
            return None;
        }

        // Convert (0,0) of the client area to screen coordinates
        let mut top_left = windows::Win32::Foundation::POINT { x: 0, y: 0 };
        let _ = ClientToScreen(hwnd, &mut top_left);

        Some(RECT {
            left: top_left.x,
            top: top_left.y,
            right: top_left.x + (client_rect.right - client_rect.left),
            bottom: top_left.y + (client_rect.bottom - client_rect.top),
        })
    }
}

// ── Log Buffer System ──────────────────────────────────────

use std::sync::OnceLock;

pub fn get_logs() -> &'static Mutex<Vec<String>> {
    static LOGS: OnceLock<Mutex<Vec<String>>> = OnceLock::new();
    LOGS.get_or_init(|| Mutex::new(Vec::new()))
}

pub fn log_message(msg: &str) {
    let timestamp = chrono::Local::now().format("%H:%M:%S%.3f").to_string();
    let formatted = format!("[{}] {}", timestamp, msg);
    println!("{}", formatted);
    if let Ok(mut logs) = get_logs().lock() {
        logs.push(formatted);
        if logs.len() > 1500 {
            logs.remove(0);
        }
    }
}

#[tauri::command]
fn get_rust_logs() -> Vec<String> {
    if let Ok(logs) = get_logs().lock() {
        logs.clone()
    } else {
        Vec::new()
    }
}

// ── App State ──────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum OverlayMode {
    Display,
    Selection,
    HeroDetails,
}

pub struct AppState {
    pub tracked_hwnd: Mutex<Option<isize>>,
    pub mode: Mutex<OverlayMode>,
}

// ── Window Enumeration ─────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct WindowInfo {
    pub hwnd: isize,
    pub title: String,
}

#[tauri::command]
fn get_windows() -> Vec<WindowInfo> {
    let mut windows: Vec<WindowInfo> = Vec::new();
    unsafe {
        let _ = EnumWindows(
            Some(enum_window_callback),
            LPARAM(&mut windows as *mut Vec<WindowInfo> as isize),
        );
    }
    windows
}

unsafe extern "system" fn enum_window_callback(
    hwnd: HWND,
    lparam: LPARAM,
) -> windows::Win32::Foundation::BOOL {
    let windows = &mut *(lparam.0 as *mut Vec<WindowInfo>);
    if IsWindowVisible(hwnd).as_bool() {
        let mut text: [u16; 512] = [0; 512];
        let len = GetWindowTextW(hwnd, &mut text);
        if len > 0 {
            let title = String::from_utf16_lossy(&text[..len as usize]);
            if !title.is_empty() {
                windows.push(WindowInfo {
                    hwnd: hwnd.0 as isize,
                    title,
                });
            }
        }
    }
    true.into()
}

// ── Commands ───────────────────────────────────────────────

#[tauri::command]
fn set_tracked_window(state: tauri::State<'_, AppState>, hwnd: isize) {
    *state.tracked_hwnd.lock().unwrap() = Some(hwnd);
}

#[tauri::command]
fn set_overlay_mode(state: tauri::State<'_, AppState>, mode: OverlayMode) {
    *state.mode.lock().unwrap() = mode;
    log_message(&format!("[Backend Mode Changed] {:?}", mode));
}

#[tauri::command]
fn log_selection(x: f64, y: f64, w: f64, h: f64) {
    log_message(&format!("{{ \"x\": {:.3}, \"y\": {:.3}, \"w\": {:.3}, \"h\": {:.3} }}", x, y, w, h));
}

#[tauri::command]
fn log_frontend_error(msg: String) {
    log_message(&format!("[Frontend Error] {}", msg));
}

#[tauri::command]
fn log_frontend_info(msg: String) {
    log_message(&format!("[Frontend Info] {}", msg));
}

#[tauri::command]
async fn fetch_combat_data(url: String) -> Result<String, String> {
    log_message(&format!("[Rust Fetch] Sending native GET request to: {}", url));
    let client = reqwest::Client::builder()
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;
    
    let res = client.get(&url)
        .send()
        .await
        .map_err(|e| format!("HTTP request failed: {}", e))?;
        
    log_message(&format!("[Rust Fetch] Response received: {:?}", res.status()));
    
    if !res.status().is_success() {
        return Err(format!("Server returned error status: {}", res.status()));
    }
    
    let body = res.text()
        .await
        .map_err(|e| format!("Failed to read response body: {}", e))?;
        
    log_message(&format!("[Rust Fetch] Successfully fetched {} bytes", body.len()));
    Ok(body)
}

#[tauri::command]
fn is_autostart_enabled() -> bool {
    #[cfg(target_os = "windows")]
    {
        let output = std::process::Command::new("reg")
            .args(&["query", "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run", "/v", "e7tracker"])
            .output();
            
        match output {
            Ok(out) => out.status.success(),
            Err(_) => false,
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        false
    }
}

#[tauri::command]
fn is_autostart_silent() -> bool {
    #[cfg(target_os = "windows")]
    {
        let output = std::process::Command::new("reg")
            .args(&["query", "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run", "/v", "e7tracker"])
            .output();
            
        match output {
            Ok(out) => {
                if out.status.success() {
                    let stdout = String::from_utf8_lossy(&out.stdout).to_string();
                    stdout.contains("--silent")
                } else {
                    true
                }
            }
            Err(_) => true,
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        true
    }
}

#[tauri::command]
fn set_autostart_enabled(enabled: bool, silent: bool) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        if enabled {
            let exe_path = std::env::current_exe()
                .map_err(|e| format!("Failed to get current executable path: {}", e))?;
                
            let exe_str = exe_path.to_string_lossy().to_string();
            let val = if silent {
                format!("\"{}\" --silent", exe_str)
            } else {
                format!("\"{}\"", exe_str)
            };
            
            let output = std::process::Command::new("reg")
                .args(&["add", "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run", "/v", "e7tracker", "/t", "REG_SZ", "/d", &val, "/f"])
                .output()
                .map_err(|e| format!("Failed to run reg command: {}", e))?;
                
            if !output.status.success() {
                let err = String::from_utf8_lossy(&output.stderr).to_string();
                return Err(format!("Registry write failed: {}", err));
            }
        } else {
            let _ = std::process::Command::new("reg")
                .args(&["delete", "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run", "/v", "e7tracker", "/f"])
                .output();
        }
    }
    Ok(())
}

#[tauri::command]
fn is_silent_launch() -> bool {
    let args: Vec<String> = std::env::args().collect();
    args.contains(&"--silent".to_string())
}

#[tauri::command]
fn get_tracked_window(state: tauri::State<'_, AppState>) -> Option<isize> {
    let val = {
        let guard = state.tracked_hwnd.lock().unwrap();
        *guard
    };
    val
}


// ── Asset Loading ──────────────────────────────────────────

fn load_screens(assets_dir: &std::path::Path) -> HashMap<String, ScreenDef> {
    let path = assets_dir.join("screens.json");
    match std::fs::read_to_string(&path) {
        Ok(content) => {
            match serde_json::from_str::<HashMap<String, ScreenDef>>(&content) {
                Ok(screens) => {
                    log_message(&format!("[e7tracker] Loaded {} screen definitions", screens.len()));
                    screens
                }
                Err(e) => {
                    log_message(&format!("[e7tracker] Error parsing screens.json: {}", e));
                    HashMap::new()
                }
            }
        }
        Err(e) => {
            log_message(&format!("[e7tracker] Could not read screens.json: {}", e));
            HashMap::new()
        }
    }
}

fn load_heroes(assets_dir: &std::path::Path) -> Vec<HeroEntry> {
    let path = assets_dir.join("heroes.json");
    match std::fs::read_to_string(&path) {
        Ok(content) => {
            match serde_json::from_str::<Vec<HeroEntry>>(&content) {
                Ok(heroes) => {
                    log_message(&format!("[e7tracker] Loaded {} heroes", heroes.len()));
                    heroes
                }
                Err(e) => {
                    log_message(&format!("[e7tracker] Error parsing heroes.json: {}", e));
                    Vec::new()
                }
            }
        }
        Err(_) => {
            log_message("[e7tracker] heroes.json not found — starting with empty database");
            Vec::new()
        }
    }
}

fn load_rgb_image(path: &std::path::Path) -> Option<RgbImage> {
    ImageReader::open(path)
        .ok()?
        .decode()
        .ok()
        .map(|img| img.to_rgb8())
}

fn load_identity_templates(
    assets_dir: &std::path::Path,
    screens: &HashMap<String, ScreenDef>,
) -> HashMap<String, RgbImage> {
    let mut templates = HashMap::new();

    for (screen_name, screen_def) in screens {
        for feature in &screen_def.identity {
            let key = format!("{}/identity/{}", screen_name, feature.image);
            let path = assets_dir.join("screens").join(screen_name).join("identity").join(&feature.image);
            if let Some(img) = load_rgb_image(&path) {
                log_message(&format!("[e7tracker] Loaded identity template: {}", key));
                templates.insert(key, img);
            } else {
                log_message(&format!("[e7tracker] Warning: Could not load '{}'", path.display()));
            }
        }
    }

    templates
}

fn load_hero_portraits(
    assets_dir: &std::path::Path,
    heroes: &[HeroEntry],
) -> HashMap<String, RgbImage> {
    let mut portraits = HashMap::new();
    let portraits_dir = assets_dir.join("heroes").join("portraits");

    for hero in heroes {
        let path = portraits_dir.join(&hero.portrait);
        if let Some(img) = load_rgb_image(&path) {
            portraits.insert(hero.portrait.clone(), img);
        }
    }

    if !portraits.is_empty() {
        log_message(&format!("[e7tracker] Loaded {} hero portraits", portraits.len()));
    }

    portraits
}

// ── Main ───────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState {
            tracked_hwnd: Mutex::new(None),
            mode: Mutex::new(OverlayMode::Display),
        })
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            get_windows, 
            set_tracked_window, 
            log_selection, 
            log_frontend_error, 
            log_frontend_info,
            get_rust_logs,
            set_overlay_mode,
            cache_set,
            cache_get,
            cache_remove,
            cache_clear,
            cache_get_all,
            fetch_combat_data,
            get_or_download_portrait,
            is_autostart_enabled,
            set_autostart_enabled,
            is_autostart_silent,
            is_silent_launch,
            get_tracked_window
        ])
        .setup(|app| {
            let handle = app.handle().clone();

            // ── System Tray Icon Setup ──
            if let Some(icon) = app.default_window_icon().cloned() {
                let quit_menu = MenuItem::with_id(app, "quit", "Close App", true, None::<&str>)?;
                let menu = Menu::with_items(app, &[&quit_menu])?;
                
                let _tray = TrayIconBuilder::new()
                    .icon(icon)
                    .menu(&menu)
                    .on_menu_event(|app, event| {
                        match event.id.as_ref() {
                            "quit" => {
                                app.exit(0);
                            }
                            _ => {}
                        }
                    })
                    .on_tray_icon_event(|tray, event| {
                        if let tauri::tray::TrayIconEvent::Click { button: tauri::tray::MouseButton::Left, .. } = event {
                            let app = tray.app_handle();
                            if let Some(controls_win) = app.get_webview_window("controls") {
                                if let Ok(visible) = controls_win.is_visible() {
                                    if visible {
                                        let _ = controls_win.hide();
                                    } else {
                                        let _ = controls_win.show();
                                        let _ = controls_win.set_focus();
                                    }
                                }
                            }
                        }
                    })
                    .build(app)?;
                crate::log_message("[System Tray] Successfully initialized system tray icon.");
            } else {
                crate::log_message("[System Tray] Warning: Default window icon not found. Skipping tray initialization.");
            }

            // ── Startup & Silent Window Show Management ──
            let args: Vec<String> = std::env::args().collect();
            let is_silent = args.contains(&"--silent".to_string());
            
            if is_silent {
                crate::log_message("[Startup] App started in silent background mode.");
            }

            // Setup Cache Database using a proper high-performance SQLite database
            let cache_dir = app.path().app_cache_dir().unwrap_or_else(|_| std::path::PathBuf::from("cache"));
            let db_file = cache_dir.join("cache.db");
            
            app.manage(CacheService::new(db_file));

            // Resolve assets directory
            let assets_dir = app.path()
                .resolve("assets", tauri::path::BaseDirectory::Resource)
                .unwrap_or_else(|_| {
                    if std::path::Path::new("src-tauri/assets").exists() {
                        std::path::PathBuf::from("src-tauri/assets")
                    } else {
                        std::path::PathBuf::from("assets")
                    }
                });

            // Load all config and assets
            let screens = load_screens(&assets_dir);
            let heroes = load_heroes(&assets_dir);
            let identity_templates = load_identity_templates(&assets_dir, &screens);
            let hero_portraits = load_hero_portraits(&assets_dir, &heroes);

            let mut engine = DetectionEngine::new(
                assets_dir.clone(),
                screens,
                heroes,
                identity_templates,
                hero_portraits,
            );

            // Mark our overlay windows as excluded from screen capture (Commented out to show on screenshots/OBS)
            // WDA_EXCLUDEFROMCAPTURE (0x11) makes them invisible to BitBlt/PrintWindow
            // but still visible to the user on their monitor
            /*
            {
                use windows::Win32::UI::WindowsAndMessaging::{SetWindowDisplayAffinity, WINDOW_DISPLAY_AFFINITY};
                let wda_exclude = WINDOW_DISPLAY_AFFINITY(0x00000011);

                for label in &["main", "selector"] {
                    if let Some(win) = app.get_webview_window(label) {
                        if let Ok(hwnd_obj) = win.hwnd() {
                            let hwnd = HWND(hwnd_obj.0);
                            unsafe {
                                let result = SetWindowDisplayAffinity(hwnd, wda_exclude);
                                if result.is_ok() {
                                    println!("[e7tracker] Window '{}' excluded from screen capture", label);
                                } else {
                                    eprintln!("[e7tracker] Failed to set display affinity for '{}'", label);
                                }
                            }
                        }
                    }
                }
            }
            */

            // ── Shortcuts ──

            // Alt + P: Toggle Controls window
            let alt_p = Shortcut::new(Some(Modifiers::ALT), Code::KeyP);
            app.global_shortcut().on_shortcut(alt_p, move |app, _shortcut, event| {
                if event.state() == tauri_plugin_global_shortcut::ShortcutState::Pressed {
                    if let Some(controls_win) = app.get_webview_window("controls") {
                        if let Ok(visible) = controls_win.is_visible() {
                            if visible { let _ = controls_win.hide(); }
                            else { let _ = controls_win.show(); let _ = controls_win.set_focus(); }
                        }
                    }
                }
            })?;

            // Alt + O: Toggle Selection Mode (show/hide selector window)
            let alt_o = Shortcut::new(Some(Modifiers::ALT), Code::KeyO);
            let handle_o = handle.clone();
            app.global_shortcut().on_shortcut(alt_o, move |_app, _shortcut, event| {
                if event.state() == tauri_plugin_global_shortcut::ShortcutState::Pressed {
                    let state = handle_o.state::<AppState>();
                    let mut mode = state.mode.lock().unwrap();
                    let new_mode = if *mode == OverlayMode::Display {
                        OverlayMode::Selection
                    } else {
                        OverlayMode::Display
                    };
                    *mode = new_mode;

                    // Show/hide the selector window
                    if let Some(selector_win) = handle_o.get_webview_window("selector") {
                        if new_mode == OverlayMode::Selection {
                            // Sync selector to overlay position
                            if let Some(main_win) = handle_o.get_webview_window("main") {
                                if let (Ok(size), Ok(pos)) = (main_win.outer_size(), main_win.outer_position()) {
                                    let _ = selector_win.set_size(tauri::Size::Physical(size));
                                    let _ = selector_win.set_position(tauri::Position::Physical(pos));
                                }
                            }
                            let _ = selector_win.show();
                            let _ = selector_win.set_focus();
                        } else {
                            let _ = selector_win.hide();
                        }
                    }

                    // Notify frontend
                    if let Some(selector_win) = handle_o.get_webview_window("selector") {
                        let _ = selector_win.emit("mode-changed", new_mode);
                    }

                    crate::log_message(&format!("[e7tracker] Mode → {:?}", new_mode));
                }
            })?;

            // Alt + B: Fetch Build Assist
            let alt_b = Shortcut::new(Some(Modifiers::ALT), Code::KeyB);
            let handle_b = handle.clone();
            app.global_shortcut().on_shortcut(alt_b, move |_app, _shortcut, event| {
                if event.state() == tauri_plugin_global_shortcut::ShortcutState::Pressed {
                    if let Some(main_win) = handle_b.get_webview_window("main") {
                        crate::log_message("[e7tracker] Emitting fetch-build-data");
                        let _ = main_win.emit("fetch-build-data", ());
                    }
                }
            })?;

            // Alt + T: Toggle Build Stats Source (Avg -> Set 1 -> Set 2)
            let alt_t = Shortcut::new(Some(Modifiers::ALT), Code::KeyT);
            let handle_t = handle.clone();
            app.global_shortcut().on_shortcut(alt_t, move |_app, _shortcut, event| {
                if event.state() == tauri_plugin_global_shortcut::ShortcutState::Pressed {
                    if let Some(main_win) = handle_t.get_webview_window("main") {
                        crate::log_message("[e7tracker] Emitting toggle-build-source");
                        let _ = main_win.emit("toggle-build-source", ());
                    }
                }
            })?;

            // Alt + R: Detailed Interactible Hero Screen
            let alt_r = Shortcut::new(Some(Modifiers::ALT), Code::KeyR);
            let handle_r = handle.clone();
            app.global_shortcut().on_shortcut(alt_r, move |_app, _shortcut, event| {
                if event.state() == tauri_plugin_global_shortcut::ShortcutState::Pressed {
                    if let Some(main_win) = handle_r.get_webview_window("main") {
                        crate::log_message("[e7tracker] Emitting toggle-hero-details");
                        let _ = main_win.emit("toggle-hero-details", ());
                    }
                }
            })?;



            // ── Tracking Loop ──
            tauri::async_runtime::spawn(async move {
                let mut last_auto_search = std::time::Instant::now();
                loop {
                    tokio::time::sleep(std::time::Duration::from_millis(100)).await;

                    let mut tracked_hwnd = {
                        let state = handle.state::<AppState>();
                        let x = *state.tracked_hwnd.lock().unwrap();
                        x
                    };

                    // Auto-detect "Epic Seven" window every 1.5 seconds if none is currently tracked
                    if tracked_hwnd.is_none() && last_auto_search.elapsed().as_millis() > 1500 {
                        last_auto_search = std::time::Instant::now();
                        let wins = get_windows();
                        if let Some(epic_win) = wins.into_iter().find(|w| {
                            w.title.trim() == "Epic Seven"
                        }) {
                            crate::log_message(&format!("[Auto-Tracker] Successfully detected and attached to Epic Seven window: '{}' (HWND: {})", epic_win.title, epic_win.hwnd));
                            let state = handle.state::<AppState>();
                            *state.tracked_hwnd.lock().unwrap() = Some(epic_win.hwnd);
                            tracked_hwnd = Some(epic_win.hwnd);
                            
                            // Notify frontend
                            let _ = handle.emit("auto-tracked-window", epic_win.clone());
                        }
                    }

                    if let Some(hwnd_val) = tracked_hwnd {
                        let hwnd = HWND(hwnd_val as *mut _);

                        unsafe {
                            // Check if window is still visible and valid
                            if !IsWindowVisible(hwnd).as_bool() {
                                crate::log_message("[Auto-Tracker] Tracked window is no longer visible/valid. Re-enabling search.");
                                let state = handle.state::<AppState>();
                                *state.tracked_hwnd.lock().unwrap() = None;
                                let _ = handle.emit("tracked-window-lost", ());
                                continue;
                            }

                            let foreground_hwnd = GetForegroundWindow();
                            if let Some(main_win) = handle.get_webview_window("main") {
                                let mode = {
                                    let state = handle.state::<AppState>();
                                    let val = *state.mode.lock().unwrap();
                                    val
                                };

                                let is_own_window = handle.webview_windows().values().any(|w| {
                                    if let Ok(hwnd_obj) = w.hwnd() {
                                        HWND(hwnd_obj.0 as *mut _) == foreground_hwnd
                                    } else {
                                        false
                                    }
                                });

                                if foreground_hwnd == hwnd || mode == OverlayMode::Selection || mode == OverlayMode::HeroDetails || is_own_window {
                                    if let Some(rect) = get_visible_window_rect(hwnd) {
                                        let width = (rect.right - rect.left) as u32;
                                        let height = (rect.bottom - rect.top) as u32;

                                        let _ = main_win.set_size(tauri::Size::Physical(
                                            tauri::PhysicalSize { width, height },
                                        ));
                                        let x_offset = -8; // Shift left a bit as requested
                                        let _ = main_win.set_position(tauri::Position::Physical(
                                            tauri::PhysicalPosition { x: rect.left + x_offset, y: rect.top },
                                        ));
                                        let _ = main_win.show();

                                        // Sync selector window if in Selection mode
                                        if mode == OverlayMode::Selection {
                                            if let Some(selector_win) = handle.get_webview_window("selector") {
                                                let _ = selector_win.set_size(tauri::Size::Physical(
                                                    tauri::PhysicalSize { width, height },
                                                ));
                                                let _ = selector_win.set_position(tauri::Position::Physical(
                                                    tauri::PhysicalPosition { x: rect.left + x_offset, y: rect.top },
                                                ));
                                            }
                                        }

                                        // Run detection engine (only in Display mode)
                                        if mode == OverlayMode::Display {
                                            if let Some((frame, w, h)) = capture::capture_window_to_rgb(hwnd) {
                                                let result = engine.process_frame(&frame, w, h);
                                                // Emit results to frontend
                                                if !result.detections.is_empty() || !result.debug_zones.is_empty() {
                                                    let _ = main_win.emit("detection-result", &result);
                                                }
                                            }
                                        }
                                    }
                                } else {
                                    if !is_own_window {
                                        let _ = main_win.hide();
                                    }
                                }
                            }
                        }
                    }
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
