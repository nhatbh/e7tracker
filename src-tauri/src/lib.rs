extern crate ort;

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
use tauri::tray::TrayIconBuilder;
use windows::Win32::Foundation::{HWND, LPARAM, RECT};
use windows::Win32::UI::WindowsAndMessaging::{
    EnumWindows, GetForegroundWindow, GetWindowTextW, IsWindowVisible,
};
use std::thread;
use std::sync::Arc;

/// Helper to get tick count for timing
fn get_tick_count() -> u64 {
    use std::time::SystemTime;
    SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut};

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
    pub active_client_profile: Mutex<Option<ClientProfile>>,
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
fn set_active_client_profile(state: tauri::State<'_, AppState>, profile: ClientProfile) {
    *state.active_client_profile.lock().unwrap() = Some(profile.clone());
    log_message(&format!("[Client Profile] Set to: {} ({})", profile.name, profile.id));
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
fn broadcast_settings(app: tauri::AppHandle, settings: serde_json::Value) -> Result<(), String> {
    use tauri::Emitter;
    log_message(&format!("[Rust Broadcast] settings-changed: {:?}", settings));
    
    // AI OCR system no longer uses client profiles
    // Settings are now handled entirely by the frontend

    app.emit("settings-changed", settings).map_err(|e| e.to_string())
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
async fn perform_ocr_on_screen(
    app: tauri::AppHandle,
    zone: models::Zone,
) -> Result<models::DetectionResult, String> {
    // log_message(&format!("[OCR Backend] perform_ocr_on_screen called"));
    // log_message(&format!("[OCR Backend] Zone coordinates: x={}, y={}, w={}, h={}", zone.x, zone.y, zone.w, zone.h));
    
    // Get the tracked window
    let state = app.state::<AppState>();
    let tracked_hwnd = {
        let guard = state.tracked_hwnd.lock().unwrap();
        *guard
    };
    
    if tracked_hwnd.is_none() {
        // log_message("[OCR Backend] Error: No window is currently tracked");
        return Err("No window is currently tracked".to_string());
    }
    
    let hwnd = HWND(tracked_hwnd.unwrap() as *mut _);
    
    // Get the active client profile's layout for OCR capture
    let client_profile = {
        let state = app.state::<AppState>();
        let profile = state.active_client_profile.lock().unwrap().clone();
        profile
    };
    
    let layout = if let Some(ref profile) = client_profile {
        profile.layout.clone()
    } else {
        // Fallback to default layout (0% offset, 100% size)
        models::LayoutConfig {
            offset: models::OffsetConfig {
                x: models::LayoutDimension { pixels: 0, percent: 0.0 },
                y: models::LayoutDimension { pixels: 0, percent: 0.0 },
            },
            size: models::SizeConfig {
                width: models::LayoutDimension { pixels: 0, percent: 100.0 },
                height: models::LayoutDimension { pixels: 0, percent: 100.0 },
            },
        }
    };
    
    // Use the layout to capture the window (respects client offsets)
    let (frame, win_w, win_h) = match capture::capture_window_with_layout(hwnd, &layout) {
        Some(result) => {
            result
        }
        None => {
            return Err("Failed to capture window".to_string());
        }
    };
    
    // Get the detection engine
    // log_message("[OCR Backend] Acquiring detection engine...");
    let engine_state = app.state::<Arc<std::sync::Mutex<DetectionEngine>>>();
    let engine_guard = engine_state.lock().unwrap();
    
    // Create a temporary slot for OCR
    let temp_slot = models::HeroSlot {
        id: "ocr_slot".to_string(),
        detection: models::HeroDetection::OCR { zone: zone.clone() },
        display: zone.clone(), // Use same zone for display
    };
    
    // log_message(&format!("[OCR Backend] Performing OCR detection"));
    
    // Perform OCR
    let result = engine_guard.detect_slot(&frame, win_w, win_h, &temp_slot);
    
    // log_message(&format!("[OCR Backend] Detection result: hero_name={:?}, confidence={}", result.hero_name, result.confidence));
    
    Ok(result)
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

/// Load heroes database from heroes.json
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

/// Load OCR zone configurations from JSON file
fn load_ocr_zones(assets_dir: &std::path::Path) -> HashMap<String, models::OcrZoneConfig> {
    let path = assets_dir.join("ocr_zones.json");
    log_message(&format!("[e7tracker] Loading OCR zones from: {:?}", path));
    match std::fs::read_to_string(&path) {
        Ok(content) => {
            log_message(&format!("[e7tracker] Successfully read ocr_zones.json ({} bytes)", content.len()));
            match serde_json::from_str::<HashMap<String, models::OcrZoneConfig>>(&content) {
                Ok(zones) => {
                    log_message(&format!("[e7tracker] Loaded OCR zones for {} screens: {:?}", zones.len(), zones.keys().collect::<Vec<_>>()));
                    zones
                }
                Err(e) => {
                    log_message(&format!("[e7tracker] Error parsing ocr_zones.json: {}", e));
                    HashMap::new()
                }
            }
        }
        Err(e) => {
            log_message(&format!("[e7tracker] ocr_zones.json not found at {:?}: {}", path, e));
            HashMap::new()
        }
    }
}

/// Load simplified screen definitions (no longer uses resolution profiles)
fn load_screens(_assets_dir: &std::path::Path) -> HashMap<String, ScreenDef> {
    // New simplified approach - no more screen.json configuration
    // Screen definitions are now hardcoded or loaded from a simpler format
    
    // For now, return empty HashMap since OCR is called on-demand
    // The frontend will provide the zones when calling perform_ocr_on_screen
    log_message("[e7tracker] Using new on-demand OCR system - no screen.json configuration needed");
    HashMap::new()
}

// ── Main ───────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState {
            tracked_hwnd: Mutex::new(None),
            mode: Mutex::new(OverlayMode::Display),
            active_client_profile: Mutex::new(None),
        })
        .manage(CacheState(std::sync::OnceLock::new()))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            get_windows, 
            set_tracked_window, 
            log_selection, 
            log_frontend_error, 
            log_frontend_info,
            broadcast_settings,
            get_rust_logs,
            set_overlay_mode,
            cache_set,
            cache_get,
            cache_remove,
            cache_clear,
            cache_get_all,
            fetch_combat_data,
            get_or_download_portrait,
            get_hero_names,
            is_autostart_enabled,
            set_autostart_enabled,
            is_autostart_silent,
            is_silent_launch,
            get_tracked_window,
            is_cache_ready,
            perform_ocr_on_screen,
            set_active_client_profile,
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
                if let Some(controls_win) = app.get_webview_window("controls") {
                    let _ = controls_win.hide();
                }
            }

            // Setup Cache Database using a proper high-performance SQLite database
            let cache_dir = app.path().app_cache_dir().unwrap_or_else(|_| std::path::PathBuf::from("cache"));
            let db_file = cache_dir.join("cache.db");
            crate::log_message(&format!("[CacheState] Initializing SQLite cache at path: {:?}", db_file));
            
            let service = CacheService::new(db_file.clone());
            crate::log_message("[CacheState] SQLite tables successfully initialized. Storing in CacheState.");
            
            if app.state::<CacheState>().0.set(service).is_ok() {
                crate::log_message("[CacheState] CacheState successfully populated and online for query operations.");
            } else {
                crate::log_message("[CacheState] Warning: CacheState was already populated.");
            }

            // Resolve assets directory
            let mut assets_dir = app.path()
                .resolve("assets", tauri::path::BaseDirectory::Resource)
                .unwrap_or_else(|_| {
                    if std::path::Path::new("src-tauri/assets").exists() {
                        std::path::PathBuf::from("src-tauri/assets")
                    } else {
                        std::path::PathBuf::from("assets")
                    }
                });
            
            // During dev, the ocr_zones.json might not be copied to target/debug/assets
            // Check if the file exists, and if not, use src-tauri/assets directly
            if !assets_dir.join("ocr_zones.json").exists() {
                if std::path::Path::new("src-tauri/assets").exists() {
                    log_message(&format!("[e7tracker] ocr_zones.json not found in resolved assets dir, falling back to src-tauri/assets"));
                    let fallback_dir = std::path::PathBuf::from("src-tauri/assets");
                    // Convert to absolute path
                    if let Ok(abs_path) = std::fs::canonicalize(&fallback_dir) {
                        log_message(&format!("[e7tracker] Using fallback assets directory: {:?}", abs_path));
                        assets_dir = abs_path;
                    } else {
                        assets_dir = fallback_dir;
                    }
                }
            }
            
            log_message(&format!("[e7tracker] Resolved assets directory to: {:?}", assets_dir));

            // Load screen definitions for AI OCR
            // OCR zones are now defined in the frontend and passed per-request
            let screens = load_screens(&assets_dir);
            let heroes = load_heroes(&assets_dir);

            let detection_engine = Arc::new(std::sync::Mutex::new(DetectionEngine::new(
                assets_dir.clone(),
                screens,
                heroes,
            )));

            // Manage the detection engine
            app.manage(detection_engine.clone());

// Mouse click monitoring thread removed.

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
                        crate::log_message(&format!("[Selector] Changing mode to: {:?}", new_mode));
                        if new_mode == OverlayMode::Selection {
                            crate::log_message("[Selector] Showing selector window");
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
                            crate::log_message("[Selector] Hiding selector window");
                            let _ = selector_win.hide();
                        }
                    } else {
                        crate::log_message("[Selector] No selector window found");
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

            // Alt + S: Scan Stats and Import
            let alt_s = Shortcut::new(Some(Modifiers::ALT), Code::KeyS);
            let handle_s = handle.clone();
            app.global_shortcut().on_shortcut(alt_s, move |_app, _shortcut, event| {
                if event.state() == tauri_plugin_global_shortcut::ShortcutState::Pressed {
                    if let Some(main_win) = handle_s.get_webview_window("main") {
                        crate::log_message("[e7tracker] Emitting scan-hero-stats");
                        let _ = main_win.emit("scan-hero-stats", ());
                    }
                }
            })?;

            // Alt + 1 to 9: Open Lobby Menu Items
            for i in 1..=9 {
                let digit_code = match i {
                    1 => Code::Digit1,
                    2 => Code::Digit2,
                    3 => Code::Digit3,
                    4 => Code::Digit4,
                    5 => Code::Digit5,
                    6 => Code::Digit6,
                    7 => Code::Digit7,
                    8 => Code::Digit8,
                    9 => Code::Digit9,
                    _ => unreachable!(),
                };
                let shortcut = Shortcut::new(Some(Modifiers::ALT), digit_code);
                let handle_digit = handle.clone();
                app.global_shortcut().on_shortcut(shortcut, move |_app, _shortcut, event| {
                    if event.state() == tauri_plugin_global_shortcut::ShortcutState::Pressed {
                        if let Some(main_win) = handle_digit.get_webview_window("main") {
                            let _ = main_win.emit("menu-item-select", i);
                        }
                    }
                })?;
            }

            // Alt + . (Period)
            let alt_period = Shortcut::new(Some(Modifiers::ALT), Code::Period);
            let handle_period = handle.clone();
            app.global_shortcut().on_shortcut(alt_period, move |_app, _shortcut, event| {
                if event.state() == tauri_plugin_global_shortcut::ShortcutState::Pressed {
                    if let Some(main_win) = handle_period.get_webview_window("main") {
                        let _ = main_win.emit("menu-navigate", "next");
                    }
                }
            })?;

            // Alt + , (Comma)
            let alt_comma = Shortcut::new(Some(Modifiers::ALT), Code::Comma);
            let handle_comma = handle.clone();
            app.global_shortcut().on_shortcut(alt_comma, move |_app, _shortcut, event| {
                if event.state() == tauri_plugin_global_shortcut::ShortcutState::Pressed {
                    if let Some(main_win) = handle_comma.get_webview_window("main") {
                        let _ = main_win.emit("menu-navigate", "prev");
                    }
                }
            })?;


            // ── Tracking Loop ──
            let engine_clone = detection_engine.clone();
            tauri::async_runtime::spawn(async move {
                let mut last_auto_search = std::time::Instant::now();
                loop {
                    tokio::time::sleep(std::time::Duration::from_millis(100)).await;

                    let mut tracked_hwnd = {
                        let state = handle.state::<AppState>();
                        let x = *state.tracked_hwnd.lock().unwrap();
                        x
                    };

                    // Auto-detect client window every 1.5 seconds if none is currently tracked
                    if tracked_hwnd.is_none() && last_auto_search.elapsed().as_millis() > 1500 {
                        last_auto_search = std::time::Instant::now();
                        let wins = get_windows();
                        
                        // Get active client profile patterns to match
                        let state = handle.state::<AppState>();
                        let client_profile = state.active_client_profile.lock().unwrap().clone();
                        
                        // Find matching window based on client profile or use default Epic Seven pattern
                        let match_result = if let Some(ref profile) = client_profile {
                            wins.into_iter().find(|w| w.title.trim() == profile.window_title_pattern)
                        } else {
                            // Default fallback: try Epic Seven first, then BlueStacks App Player
                            wins.into_iter().find(|w| {
                                w.title.trim() == "Epic Seven" || w.title.trim() == "BlueStacks App Player"
                            })
                        };
                        
                        if let Some(found_win) = match_result {
                            crate::log_message(&format!("[Auto-Tracker] Successfully detected and attached to window: '{}' (HWND: {})", found_win.title, found_win.hwnd));
                            *state.tracked_hwnd.lock().unwrap() = Some(found_win.hwnd);
                            tracked_hwnd = Some(found_win.hwnd);
                            
                            // Notify frontend
                            let _ = handle.emit("auto-tracked-window", found_win.clone());
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

                                        // Get client profile and calculate total X-Y layout (position and size)
                                        let state = handle.state::<AppState>();
                                        let client_profile = state.active_client_profile.lock().unwrap().clone();
                                        let (offset_x, offset_y, layout_width, layout_height) = if let Some(ref profile) = client_profile {
                                            profile.calculate_layout(width, height)
                                        } else {
                                            (0, 0, width as i32, height as i32)  // Default: no adjustment
                                        };
                                        
                                        // Ensure dimensions are positive
                                        let final_width = layout_width.max(1) as u32;
                                        let final_height = layout_height.max(1) as u32;
                                        
                                        let _ = main_win.set_size(tauri::Size::Physical(
                                            tauri::PhysicalSize { width: final_width, height: final_height },
                                        ));
                                        
                                        let _ = main_win.set_position(tauri::Position::Physical(
                                            tauri::PhysicalPosition { 
                                                x: rect.left + offset_x, 
                                                y: rect.top + offset_y 
                                            },
                                        ));
                                        let _ = main_win.show();

                                        // Sync selector window if in Selection mode
                                        if mode == OverlayMode::Selection {
                                            if let Some(selector_win) = handle.get_webview_window("selector") {
                                                let _ = selector_win.set_size(tauri::Size::Physical(
                                                    tauri::PhysicalSize { width, height },
                                                ));
                                                let _ = selector_win.set_position(tauri::Position::Physical(
                                                    tauri::PhysicalPosition { x: rect.left, y: rect.top },
                                                ));
                                            }
                                        }

                                        // Run detection engine (only in Display mode)
                                        if mode == OverlayMode::Display {
                                            if let Some((frame, w, h)) = capture::capture_window_to_rgb(hwnd) {
                                                let mut engine_guard = engine_clone.lock().unwrap();
                                                let result = engine_guard.process_frame(&frame, w, h);
                                                
                                                // Note: OCR is on-demand only (via perform_ocr_on_screen command). 
                                                // This detection loop only does screen classification, not OCR.
                                                // Emit results to frontend
                                                if !result.detections.is_empty() || !result.debug_zones.is_empty() {
                                                    let _ = main_win.emit("detection-result", &result);
                                                    
                                                    // Also send to selector window if it's in Selection mode (OCR monitoring)
                                                    if let Some(selector_win) = handle.get_webview_window("selector") {
                                                        let _ = selector_win.emit("detection-result", &result);
                                                    }
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
