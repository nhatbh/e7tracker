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
    pub active_client: Mutex<String>,
    pub trigger_reload: Mutex<bool>,
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
async fn save_cropped_signature(
    app: tauri::AppHandle,
    client: String,
    resolution: String,
    screen: String,
    signature_key: String,
    x: f64,
    y: f64,
    w: f64,
    h: f64,
) -> Result<String, String> {
    use crate::models::{ScreenDef, IdentityFeature, Zone};
    use crate::AppState;
    use tauri::Manager;
    use tauri::Emitter;
    use std::collections::HashMap;
    use windows::Win32::Foundation::HWND;

    crate::log_message(&format!(
        "[Profile Editor Workflow] New request: client='{}', res='{}', screen='{}', key='{}' zone=({:.3}, {:.3}, {:.3}, {:.3})",
        client, resolution, screen, signature_key, x, y, w, h
    ));

    // Resolve assets folder
    let assets_dir = app.path()
        .resolve("assets", tauri::path::BaseDirectory::Resource)
        .unwrap_or_else(|_| {
            if std::path::Path::new("src-tauri/assets").exists() {
                std::path::PathBuf::from("src-tauri/assets")
            } else {
                std::path::PathBuf::from("assets")
            }
        });

    // 1. Get current tracked window size to resolve the correct JSON profile
    let hwnd_val = {
        let state = app.state::<AppState>();
        let val = *state.tracked_hwnd.lock().unwrap();
        val
    };

    let hwnd = match hwnd_val {
        Some(h) => HWND(h as *mut _),
        None => return Err("No game window is currently tracked. Attach to Epic Seven first!".to_string()),
    };

    // Capture a quick frame to determine the exact window dimensions
    let (_, win_w, win_h) = match crate::capture::capture_window_to_rgb(hwnd) {
        Some(f) => f,
        None => return Err("Failed to capture game window dimensions.".to_string()),
    };

    // 2. Update layout coordinates in the resolved JSON profile config file
    let profile_name = resolve_profile_filename(&client);
    let profile_path = assets_dir.join(&profile_name);

    let mut resolution_map: HashMap<String, HashMap<String, ScreenDef>> = if profile_path.exists() {
        let content = std::fs::read_to_string(&profile_path)
            .map_err(|e| format!("Failed to read screen config: {}", e))?;
        serde_json::from_str::<HashMap<String, HashMap<String, ScreenDef>>>(&content)
            .or_else(|_| {
                serde_json::from_str::<HashMap<String, ScreenDef>>(&content).map(|flat| {
                    let mut nested = HashMap::new();
                    nested.insert(resolution.clone(), flat);
                    nested
                })
            })
            .map_err(|e| format!("Failed to parse profile JSON: {}", e))?
    } else {
        // Fallback to default screens.json as template base
        let default_path = assets_dir.join("screens.json");
        if default_path.exists() {
            let content = std::fs::read_to_string(&default_path)
                .map_err(|e| format!("Failed to read base template: {}", e))?;
            serde_json::from_str::<HashMap<String, HashMap<String, ScreenDef>>>(&content)
                .or_else(|_| {
                    serde_json::from_str::<HashMap<String, ScreenDef>>(&content).map(|flat| {
                        let mut nested = HashMap::new();
                        nested.insert(resolution.clone(), flat);
                        nested
                    })
                })
                .map_err(|e| format!("Failed to parse base template: {}", e))?
        } else {
            HashMap::new()
        }
    };

    let target_resolution = format!("{}x{}", win_w, win_h);

    let screens = resolution_map.entry(target_resolution.clone()).or_insert_with(HashMap::new);
    let screen_def = screens.entry(screen.clone()).or_insert_with(|| ScreenDef {
        identity: Vec::new(),
        slots: Vec::new(),
    });

    let rounded_x = (x * 1000.0).round() / 1000.0;
    let rounded_y = (y * 1000.0).round() / 1000.0;
    let rounded_w = (w * 1000.0).round() / 1000.0;
    let rounded_h = (h * 1000.0).round() / 1000.0;

    if let Some(feat) = screen_def.identity.iter_mut().find(|f| f.image == signature_key) {
        feat.zone = Zone { x: rounded_x, y: rounded_y, w: rounded_w, h: rounded_h };
    } else {
        screen_def.identity.push(IdentityFeature {
            image: signature_key.clone(),
            zone: Zone { x: rounded_x, y: rounded_y, w: rounded_w, h: rounded_h },
            threshold: 0.92, // Default signature threshold
        });
    }

    let serialized = serde_json::to_string_pretty(&resolution_map)
        .map_err(|e| format!("Failed to serialize screens layout: {}", e))?;
    std::fs::write(&profile_path, serialized)
        .map_err(|e| format!("Failed to write updated JSON profile: {}", e))?;
    crate::log_message(&format!("[Profile Editor Workflow] Updated coordinates in JSON profile: {:?}", profile_path));

    // 3. Hide the selector overlay completely & notify frontend
    {
        let state = app.state::<AppState>();
        *state.mode.lock().unwrap() = OverlayMode::Display;
    }

    if let Some(selector_win) = app.get_webview_window("selector") {
        let _ = selector_win.hide();
        let _ = selector_win.emit("mode-changed", OverlayMode::Display);
    }

    // Wait for 1 second to make sure that the overlay is completely hidden from the GDI screen buffer!
    crate::log_message("[Profile Editor Workflow] Waiting 1.0s for overlay hide composition...");
    tokio::time::sleep(tokio::time::Duration::from_millis(1000)).await;

    // 4. Trigger first forced hot-reload so that the background tracking loop starts
    // evaluating features using the new zone coordinates and outputs the fresh debug crop!
    {
        let state = app.state::<AppState>();
        *state.trigger_reload.lock().unwrap() = true;
    }

    // 5. Poll for the newly saved debug crop image file (up to 3 seconds)
    crate::log_message("[Profile Editor Workflow] Polling for fresh crop from detection capturer...");
    let debug_dir = assets_dir.join("debug_crops").join(&screen);
    let mut latest_crop: Option<std::path::PathBuf> = None;

    // Check 15 times with 200ms sleep (3 seconds total)
    for _ in 0..15 {
        let mut latest_time = std::time::SystemTime::UNIX_EPOCH;
        let mut found_any = false;
        
        for count in 0..3 {
            let crop_path = debug_dir.join(format!("{}_{}.png", signature_key, count));
            if crop_path.exists() {
                found_any = true;
                if let Ok(metadata) = std::fs::metadata(&crop_path) {
                    if let Ok(modified) = metadata.modified() {
                        if modified > latest_time {
                            latest_time = modified;
                            latest_crop = Some(crop_path.clone());
                        }
                    }
                }
            }
        }
        if found_any && latest_crop.is_some() {
            break;
        }
        tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;
    }

    let source_crop = match latest_crop {
        Some(path) => path,
        None => {
            return Err("Capture timeout: The capturer loop did not output a debug crop file. Please make sure the emulator is visible, not minimized, and you have attached to Epic Seven!".to_string());
        }
    };
    crate::log_message(&format!("[Profile Editor Workflow] Detected fresh debug crop asset at: {:?}", source_crop));

    // 6. Copy the captured debug crop file into the final target signature folder
    let folder_name = match (client.as_str(), resolution.as_str()) {
        ("default", "default") | ("default", "unknown") | ("default", "") => "identity".to_string(),
        ("default", res) => format!("identity_{}", res),
        (cli, "default") | (cli, "unknown") | (cli, "") => format!("identity_{}", cli),
        (cli, res) => format!("identity_{}_{}", cli, res),
    };

    let target_dir = assets_dir.join("screens").join(&screen).join(&folder_name);
    std::fs::create_dir_all(&target_dir)
        .map_err(|e| format!("Failed to create destination signature directory: {}", e))?;

    let final_dest_path = target_dir.join(&signature_key);
    std::fs::copy(&source_crop, &final_dest_path)
        .map_err(|e| format!("Failed to copy cropped signature file to target asset path: {}", e))?;
    crate::log_message(&format!("[Profile Editor Workflow] Successfully promoted crop to target template asset: {:?}", final_dest_path));

    // 7. Trigger a second hot-reload to load the new template signature asset into the matching engine
    {
        let state = app.state::<AppState>();
        *state.trigger_reload.lock().unwrap() = true;
    }

    Ok(format!(
        "Perfect! Coordinates synced in '{}' and signature asset promoted successfully! E7Tracker is now active using the new config.",
        profile_name
    ))
}

#[tauri::command]
fn update_ocr_zone(
    app: tauri::AppHandle,
    client: String,
    resolution: String,
    screen: String,
    slot_id: String,
    x: f64,
    y: f64,
    w: f64,
    h: f64,
) -> Result<String, String> {
    use crate::models::{ScreenDef, HeroSlot, HeroDetection, Zone};
    use crate::AppState;
    use tauri::Manager;
    use tauri::Emitter;
    use std::collections::HashMap;

    crate::log_message(&format!(
        "[Profile Editor OCR] Update request: client='{}', res='{}', screen='{}', slot='{}' zone=({:.3}, {:.3}, {:.3}, {:.3})",
        client, resolution, screen, slot_id, x, y, w, h
    ));

    // Resolve assets folder
    let assets_dir = app.path()
        .resolve("assets", tauri::path::BaseDirectory::Resource)
        .unwrap_or_else(|_| {
            if std::path::Path::new("src-tauri/assets").exists() {
                std::path::PathBuf::from("src-tauri/assets")
            } else {
                std::path::PathBuf::from("assets")
            }
        });

    // Update layout coordinates in the resolved JSON profile config file
    let profile_name = resolve_profile_filename(&client);
    let profile_path = assets_dir.join(&profile_name);

    let mut resolution_map: HashMap<String, HashMap<String, ScreenDef>> = if profile_path.exists() {
        let content = std::fs::read_to_string(&profile_path)
            .map_err(|e| format!("Failed to read screen config: {}", e))?;
        serde_json::from_str::<HashMap<String, HashMap<String, ScreenDef>>>(&content)
            .or_else(|_| {
                serde_json::from_str::<HashMap<String, ScreenDef>>(&content).map(|flat| {
                    let mut nested = HashMap::new();
                    nested.insert(resolution.clone(), flat);
                    nested
                })
            })
            .map_err(|e| format!("Failed to parse profile JSON: {}", e))?
    } else {
        // Fallback to default screens.json as template base
        let default_path = assets_dir.join("screens.json");
        if default_path.exists() {
            let content = std::fs::read_to_string(&default_path)
                .map_err(|e| format!("Failed to read base template: {}", e))?;
            serde_json::from_str::<HashMap<String, HashMap<String, ScreenDef>>>(&content)
                .or_else(|_| {
                    serde_json::from_str::<HashMap<String, ScreenDef>>(&content).map(|flat| {
                        let mut nested = HashMap::new();
                        nested.insert(resolution.clone(), flat);
                        nested
                    })
                })
                .map_err(|e| format!("Failed to parse base template: {}", e))?
        } else {
            HashMap::new()
        }
    };

    let hwnd_val = {
        let state = app.state::<AppState>();
        let val = *state.tracked_hwnd.lock().unwrap();
        val
    };

    let target_resolution = if let Some(h_val) = hwnd_val {
        let hwnd = HWND(h_val as *mut _);
        if let Some((_, win_w, win_h)) = crate::capture::capture_window_to_rgb(hwnd) {
            format!("{}x{}", win_w, win_h)
        } else {
            resolution.clone()
        }
    } else {
        resolution.clone()
    };

    let screens = resolution_map.entry(target_resolution.clone()).or_insert_with(HashMap::new);
    let screen_def = screens.entry(screen.clone()).or_insert_with(|| ScreenDef {
        identity: Vec::new(),
        slots: Vec::new(),
    });

    let rounded_x = (x * 1000.0).round() / 1000.0;
    let rounded_y = (y * 1000.0).round() / 1000.0;
    let rounded_w = (w * 1000.0).round() / 1000.0;
    let rounded_h = (h * 1000.0).round() / 1000.0;

    // Find slot or push a new one
    if let Some(slot) = screen_def.slots.iter_mut().find(|s| s.id == slot_id) {
        slot.detection = HeroDetection::OCR {
            zone: Zone { x: rounded_x, y: rounded_y, w: rounded_w, h: rounded_h },
        };
        slot.display = Zone { x: rounded_x, y: rounded_y, w: rounded_w, h: rounded_h };
    } else {
        screen_def.slots.push(HeroSlot {
            id: slot_id.clone(),
            detection: HeroDetection::OCR {
                zone: Zone { x: rounded_x, y: rounded_y, w: rounded_w, h: rounded_h },
            },
            display: Zone { x: rounded_x, y: rounded_y, w: rounded_w, h: rounded_h },
        });
    }

    let serialized = serde_json::to_string_pretty(&resolution_map)
        .map_err(|e| format!("Failed to serialize screens layout: {}", e))?;
    std::fs::write(&profile_path, serialized)
        .map_err(|e| format!("Failed to write updated JSON profile: {}", e))?;
    crate::log_message(&format!("[Profile Editor OCR] Updated OCR zone inside JSON profile: {:?}", profile_path));

    // Hide the selector overlay completely & notify frontend
    {
        let state = app.state::<AppState>();
        *state.mode.lock().unwrap() = OverlayMode::Display;
    }

    if let Some(selector_win) = app.get_webview_window("selector") {
        let _ = selector_win.hide();
        let _ = selector_win.emit("mode-changed", OverlayMode::Display);
    }

    // Trigger forced hot-reload so that the tracking loop instantly loads the new OCR coordinates!
    {
        let state = app.state::<AppState>();
        *state.trigger_reload.lock().unwrap() = true;
    }

    Ok(format!(
        "Perfect! OCR Slot ID '{}' coordinates updated in '{}' successfully!",
        slot_id, profile_name
    ))
}

#[tauri::command]
fn get_current_zone(
    app: tauri::AppHandle,
    client: String,
    resolution: String,
    screen: String,
    edit_mode: String,
    signature_key: String,
    slot_id: String,
) -> Result<Option<crate::models::Zone>, String> {
    use crate::models::{ScreenDef, Zone};
    use std::collections::HashMap;

    // Resolve assets folder
    let assets_dir = app.path()
        .resolve("assets", tauri::path::BaseDirectory::Resource)
        .unwrap_or_else(|_| {
            if std::path::Path::new("src-tauri/assets").exists() {
                std::path::PathBuf::from("src-tauri/assets")
            } else {
                std::path::PathBuf::from("assets")
            }
        });

    // 1. Resolve JSON profile filename
    let profile_name = resolve_profile_filename(&client);
    let profile_path = assets_dir.join(&profile_name);
    if !profile_path.exists() {
        return Ok(None);
    }

    let content = std::fs::read_to_string(&profile_path)
        .map_err(|e| format!("Failed to read screen config: {}", e))?;

    let resolution_map: HashMap<String, HashMap<String, ScreenDef>> = serde_json::from_str::<HashMap<String, HashMap<String, ScreenDef>>>(&content)
        .or_else(|_| {
            serde_json::from_str::<HashMap<String, ScreenDef>>(&content).map(|flat| {
                let mut nested = HashMap::new();
                nested.insert(resolution.clone(), flat);
                nested
            })
        })
        .map_err(|e| format!("Failed to parse profile JSON: {}", e))?;

    let hwnd_val = {
        let state = app.state::<AppState>();
        let val = *state.tracked_hwnd.lock().unwrap();
        val
    };

    let target_resolution = if let Some(h_val) = hwnd_val {
        let hwnd = HWND(h_val as *mut _);
        if let Some((_, win_w, win_h)) = crate::capture::capture_window_to_rgb(hwnd) {
            format!("{}x{}", win_w, win_h)
        } else {
            resolution.clone()
        }
    } else {
        resolution.clone()
    };

    let target_w: u32;
    let target_h: u32;
    let parts: Vec<&str> = target_resolution.split('x').collect();
    if parts.len() == 2 {
        target_w = parts[0].parse::<u32>().unwrap_or(1600);
        target_h = parts[1].parse::<u32>().unwrap_or(900);
    } else {
        target_w = 1600;
        target_h = 900;
    }

    let empty_map = HashMap::new();
    let screens = match resolution_map.get(&target_resolution) {
        Some(s) => s,
        None => {
            // Find the closest available resolution setting in the map!
            if let Some(closest_key) = find_closest_resolution_key(&resolution_map, target_w, target_h) {
                resolution_map.get(&closest_key).unwrap_or(&empty_map)
            } else {
                match resolution_map.values().next() {
                    Some(s) => s,
                    None => return Ok(None),
                }
            }
        }
    };

    let screen_def = match screens.get(&screen) {
        Some(s) => s,
        None => return Ok(None),
    };

    if edit_mode == "signature" {
        // Find inside identity features
        if let Some(feat) = screen_def.identity.iter().find(|f| f.image == signature_key) {
            return Ok(Some(feat.zone.clone()));
        }
    } else {
        // Find inside slots
        if let Some(slot) = screen_def.slots.iter().find(|s| s.id == slot_id) {
            match &slot.detection {
                crate::models::HeroDetection::OCR { zone } => return Ok(Some(zone.clone())),
                crate::models::HeroDetection::Image { zone, .. } => return Ok(Some(zone.clone())),
            }
        }
    }

    Ok(None)
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
    
    if let Some(client) = settings.get("activeClient").and_then(|v| v.as_str()) {
        let state = app.state::<AppState>();
        let mut active = state.active_client.lock().unwrap();
        if *active != client {
            *active = client.to_string();
            log_message(&format!("[Rust Broadcast] Active client profile changed to: {}", client));
        }
    }

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

fn load_initial_client(db_file: &std::path::Path) -> String {
    if let Ok(conn) = rusqlite::Connection::open(db_file) {
        let stmt = conn.prepare("SELECT value FROM kv_cache WHERE key = 'app_user_settings'").ok();
        if let Some(mut s) = stmt {
            if let Ok(mut rows) = s.query([]) {
                if let Ok(Some(row)) = rows.next() {
                    if let Ok(val_str) = row.get::<_, String>(0) {
                        if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&val_str) {
                            if let Some(client) = parsed.get("activeClient").and_then(|v| v.as_str()) {
                                return client.to_string();
                            }
                        }
                    }
                }
            }
        }
    }
    "default".to_string()
}

fn get_resolution_bucket(width: u32, height: u32) -> Option<&'static str> {
    // 1280x720 window bucket
    if (1200..=1360).contains(&width) && (680..=780).contains(&height) {
        return Some("1280x720");
    }
    // 1600x900 window bucket
    if (1500..=1700).contains(&width) && (850..=950).contains(&height) {
        return Some("1600x900");
    }
    // 1920x1080 window bucket
    if (1800..=2000).contains(&width) && (1000..=1150).contains(&height) {
        return Some("1920x1080");
    }
    None
}

fn resolve_profile_filename(active_client: &str) -> String {
    match active_client {
        "pc_client" => "screens_pc_client.json".to_string(),
        "bluestacks" => "screens_bluestacks.json".to_string(),
        "mumu" => "screens_mumu.json".to_string(),
        "ldplayer" => "screens_ldplayer.json".to_string(),
        _ => "screens.json".to_string(),
    }
}

fn find_closest_resolution_key(
    res_map: &HashMap<String, HashMap<String, ScreenDef>>,
    target_w: u32,
    target_h: u32,
) -> Option<String> {
    let mut closest_key: Option<String> = None;
    let mut min_diff = u64::MAX;

    for key in res_map.keys() {
        let parts: Vec<&str> = key.split('x').collect();
        if parts.len() == 2 {
            if let (Ok(w), Ok(h)) = (parts[0].parse::<u32>(), parts[1].parse::<u32>()) {
                let diff = (w as i32 - target_w as i32).abs() as u64 + (h as i32 - target_h as i32).abs() as u64;
                if diff < min_diff {
                    min_diff = diff;
                    closest_key = Some(key.clone());
                }
            }
        }
    }
    closest_key
}

fn load_screens(assets_dir: &std::path::Path, profile: &str, resolution: &str) -> HashMap<String, ScreenDef> {
    let path = assets_dir.join(profile);
    match std::fs::read_to_string(&path) {
        Ok(content) => {
            // First try parsing as the new nested KV resolution map
            if let Ok(res_map) = serde_json::from_str::<HashMap<String, HashMap<String, ScreenDef>>>(&content) {
                if let Some(screens) = res_map.get(resolution) {
                    log_message(&format!(
                        "[e7tracker] Loaded {} screens for exact resolution '{}' from profile '{}'",
                        screens.len(), resolution, profile
                    ));
                    return screens.clone();
                }

                // Fallback to the closest resolution key in the profile!
                let parts: Vec<&str> = resolution.split('x').collect();
                if parts.len() == 2 {
                    if let (Ok(target_w), Ok(target_h)) = (parts[0].parse::<u32>(), parts[1].parse::<u32>()) {
                        if let Some(closest_key) = find_closest_resolution_key(&res_map, target_w, target_h) {
                            if let Some(screens) = res_map.get(&closest_key) {
                                log_message(&format!(
                                    "[e7tracker] Exact resolution '{}' not found in '{}'. Loaded closest matching setting '{}' ({} screens)",
                                    resolution, profile, closest_key, screens.len()
                                ));
                                return screens.clone();
                            }
                        }
                    }
                }

                // Fallback to "1600x900" default if resolution key doesn't exist
                let fallback_res = "1600x900";
                if let Some(screens) = res_map.get(fallback_res) {
                    log_message(&format!(
                        "[e7tracker] Resolution '{}' not found in '{}', falling back to '{}' ({} screens)",
                        resolution, profile, fallback_res, screens.len()
                    ));
                    return screens.clone();
                }
                // Final map fallback to any first resolution key
                if let Some(screens) = res_map.values().next() {
                    log_message(&format!(
                        "[e7tracker] Resolution '{}' not found in '{}', falling back to first resolution ({} screens)",
                        resolution, profile, screens.len()
                    ));
                    return screens.clone();
                }
            }
            // Parse as old flat map fallback
            match serde_json::from_str::<HashMap<String, ScreenDef>>(&content) {
                Ok(screens) => {
                    log_message(&format!(
                        "[e7tracker] Loaded {} screens directly (flat map) from profile '{}'",
                        screens.len(), profile
                    ));
                    screens
                }
                Err(e) => {
                    log_message(&format!(
                        "[e7tracker] Error parsing flat screen profile '{}': {}",
                        profile, e
                    ));
                    HashMap::new()
                }
            }
        }
        Err(e) => {
            log_message(&format!(
                "[e7tracker] Could not read screen profile '{}': {}",
                profile, e
            ));
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
    active_client: &str,
    resolution: &str,
) -> HashMap<String, RgbImage> {
    let mut templates = HashMap::new();

    for (screen_name, screen_def) in screens {
        for feature in &screen_def.identity {
            let key = format!("{}/identity/{}", screen_name, feature.image);
            
            // Search order resolution hierarchy
            let mut signature_path = None;

            // 1. Client + Resolution Specific
            if active_client != "default" && resolution != "unknown" {
                let path = assets_dir
                    .join("screens")
                    .join(screen_name)
                    .join(format!("identity_{}_{}", active_client, resolution))
                    .join(&feature.image);
                if path.exists() {
                    signature_path = Some(path);
                }
            }

            // 2. Client Generic
            if signature_path.is_none() && active_client != "default" {
                let path = assets_dir
                    .join("screens")
                    .join(screen_name)
                    .join(format!("identity_{}", active_client))
                    .join(&feature.image);
                if path.exists() {
                    signature_path = Some(path);
                }
            }

            // 3. Resolution Generic
            if signature_path.is_none() && resolution != "unknown" {
                let path = assets_dir
                    .join("screens")
                    .join(screen_name)
                    .join(format!("identity_{}", resolution))
                    .join(&feature.image);
                if path.exists() {
                    signature_path = Some(path);
                }
            }

            // 4. Default Fallback
            let final_path = signature_path.unwrap_or_else(|| {
                assets_dir
                    .join("screens")
                    .join(screen_name)
                    .join("identity")
                    .join(&feature.image)
            });

            if let Some(img) = load_rgb_image(&final_path) {
                // Log specialization choice if it differs from the basic template path
                let default_path = assets_dir.join("screens").join(screen_name).join("identity").join(&feature.image);
                if final_path != default_path {
                    log_message(&format!(
                        "[e7tracker] Loaded specialized signature for screen '{}' (client '{}', res '{}'): {}",
                        screen_name, active_client, resolution, feature.image
                    ));
                }
                templates.insert(key, img);
            } else {
                log_message(&format!("[e7tracker] Warning: Could not load '{}'", final_path.display()));
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
            active_client: Mutex::new("default".to_string()),
            trigger_reload: Mutex::new(false),
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
            is_autostart_enabled,
            set_autostart_enabled,
            is_autostart_silent,
            is_silent_launch,
            get_tracked_window,
            is_cache_ready,
            save_cropped_signature,
            update_ocr_zone,
            get_current_zone
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
            let assets_dir = app.path()
                .resolve("assets", tauri::path::BaseDirectory::Resource)
                .unwrap_or_else(|_| {
                    if std::path::Path::new("src-tauri/assets").exists() {
                        std::path::PathBuf::from("src-tauri/assets")
                    } else {
                        std::path::PathBuf::from("assets")
                    }
                });

            // Load initial active_client from settings db
            let initial_client = load_initial_client(&db_file);
            crate::log_message(&format!("[Startup] Active client profile: {}", initial_client));
            *app.state::<AppState>().active_client.lock().unwrap() = initial_client.clone();

            // Sizing bucket guess for startup (1600x900 default)
            let initial_profile = resolve_profile_filename(&initial_client);
            let resolution_bucket = get_resolution_bucket(1600, 900).unwrap_or("unknown");
            crate::log_message(&format!("[Startup] Resolved screen profile: {}", initial_profile));

            let screens = load_screens(&assets_dir, &initial_profile, resolution_bucket);
            let heroes = load_heroes(&assets_dir);
            let identity_templates = load_identity_templates(&assets_dir, &screens, &initial_client, resolution_bucket);
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



            let loop_initial_profile = initial_profile.clone();
            // ── Tracking Loop ──
            tauri::async_runtime::spawn(async move {
                let mut last_auto_search = std::time::Instant::now();
                let mut current_loaded_profile = loop_initial_profile;
                let mut current_loaded_resolution = "1600x900".to_string();
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
                                                    tauri::PhysicalPosition { x: rect.left, y: rect.top },
                                                ));
                                            }
                                        }

                                        // Run detection engine (only in Display mode)
                                        if mode == OverlayMode::Display {
                                            if let Some((frame, w, h)) = capture::capture_window_to_rgb(hwnd) {
                                                // Dynamic active client and resolution lookup
                                                let active_client = {
                                                    let state = handle.state::<AppState>();
                                                    let guard = state.active_client.lock().unwrap();
                                                    guard.clone()
                                                };

                                                 let resolved_profile = resolve_profile_filename(&active_client);
                                                 let force_reload = {
                                                      let state = handle.state::<AppState>();
                                                      let mut guard = state.trigger_reload.lock().unwrap();
                                                      let val = *guard;
                                                      if val {
                                                          *guard = false;
                                                      }
                                                      val
                                                  };

                                                 let res_bucket = get_resolution_bucket(w, h).unwrap_or("1600x900").to_string();

                                                 if resolved_profile != current_loaded_profile || res_bucket != current_loaded_resolution || force_reload {
                                                     crate::log_message(&format!(
                                                         "[Tracking Loop] Configuration reload needed (client: '{}', resolution: '{}'). Reloading screens configuration from '{}'...",
                                                         active_client, res_bucket, resolved_profile
                                                     ));
                                                     let new_screens = load_screens(&engine.assets_dir, &resolved_profile, &res_bucket);
                                                     let new_templates = load_identity_templates(&engine.assets_dir, &new_screens, &active_client, &res_bucket);
                                                     engine.screens = new_screens;
                                                     engine.identity_templates = new_templates;
                                                     current_loaded_profile = resolved_profile;
                                                     current_loaded_resolution = res_bucket;
                                                 }

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
