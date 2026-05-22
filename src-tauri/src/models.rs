use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// A rectangular region defined in percentage coordinates (0.0-100.0).
/// Scales with window size.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Zone {
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
}

impl Zone {
    /// Convert percentage zone to pixel coordinates given a window size.
    pub fn to_pixels(&self, win_w: u32, win_h: u32) -> (u32, u32, u32, u32) {
        let px = (self.x / 100.0 * win_w as f64) as u32;
        let py = (self.y / 100.0 * win_h as f64) as u32;
        let pw = (self.w / 100.0 * win_w as f64) as u32;
        let ph = (self.h / 100.0 * win_h as f64) as u32;
        (px, py, pw, ph)
    }
}

/// OCR zone configuration for a specific screen
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OcrZoneConfig {
    pub zones: HashMap<String, ZoneWithDescription>,
    pub description: String,
}

/// Zone with description for OCR monitoring
/// Matches the JSON structure where x, y, w, h are at the same level as description
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ZoneWithDescription {
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
    pub description: String,
}

impl ZoneWithDescription {
    /// Convert to a Zone for compatibility
    pub fn to_zone(&self) -> Zone {
        Zone {
            x: self.x,
            y: self.y,
            w: self.w,
            h: self.h,
        }
    }
}

/// How a hero is detected in a specific slot using AI OCR.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum HeroDetection {
    /// Read hero name via AI OCR, then fuzzy-match against heroes.json.
    #[serde(rename = "ocr")]
    OCR { zone: Zone },
}

/// A single hero position on a screen.
/// Groups detection (how to find the hero) with display (where to show stats).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HeroSlot {
    /// Unique identifier for this slot (e.g., "my_pick_1", "enemy_ban_2").
    pub id: String,
    /// How to detect which hero is in this slot.
    pub detection: HeroDetection,
    /// Where to display the hero's stats on the overlay.
    pub display: Zone,
}

/// A simplified screen definition for AI-based detection.
/// Screens are now identified by the AI classifier, not by template matching.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScreenDef {
    /// Hero slots on this screen.
    pub slots: Vec<HeroSlot>,
}

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BuildStats {
    pub hp: u32,
    pub atk: u32,
    pub def: u32,
    pub spd: u32,
    pub chc: f64,
    pub chd: f64,
    pub eff: f64,
    pub efr: f64,
}

/// A hero entry in the database.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HeroEntry {
    pub id: u32,
    pub name: String,
    /// Filename of the portrait image in assets/heroes/portraits/
    pub portrait: String,
}

/// Result of detecting a hero in a slot.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetectionResult {
    pub slot_id: String,
    pub hero_id: Option<u32>,
    pub hero_name: Option<String>,
    pub confidence: f64,
    pub display: Zone,
}

/// The current state of screen detection.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FrameResult {
    pub screen_name: Option<String>,
    pub detections: Vec<DetectionResult>,
    pub debug_zones: Vec<DebugZone>,
}

/// Debug zone for visualization (kept for compatibility but no longer uses template matching).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DebugZone {
    pub zone: Zone,
    pub screen_name: String,
    pub confidence: f64,
}

/// Client profile configuration for multi-client support.
/// Each client (Epic Seven PC, BlueStack, etc.) has specific offset settings.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClientProfile {
    pub id: String,
    pub name: String,
    /// Exact window title to match for auto-detection
    pub window_title_pattern: String,
    
    /// Fixed pixel offset for X-axis (can be negative)
    pub offset_pixels_x: i32,
    /// Percentage-based offset for X-axis (0-100, scales with window width)
    pub offset_percentage_x: f32,
    
    /// Fixed pixel offset for Y-axis (can be negative)
    pub offset_pixels_y: i32,
    /// Percentage-based offset for Y-axis (0-100, scales with window height)
    pub offset_percentage_y: f32,
    
    pub enabled: bool,
}

impl ClientProfile {
    /// Calculate total X-Y offsets for a given window size
    /// total_offset = offset_pixels + (dimension * offset_percentage / 100)
    pub fn calculate_total_offsets(&self, window_width: u32, window_height: u32) -> (i32, i32) {
        let offset_x = self.offset_pixels_x + (window_width as f32 * self.offset_percentage_x / 100.0) as i32;
        let offset_y = self.offset_pixels_y + (window_height as f32 * self.offset_percentage_y / 100.0) as i32;
        (offset_x, offset_y)
    }
}
