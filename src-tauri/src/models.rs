use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DebugZone {
    pub zone: Zone,
    pub image_name: String,
    pub screen_name: String,
    pub confidence: f64,
    pub threshold: f64,
}


/// A rectangular region defined in percentage coordinates (0.0–100.0).
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

/// A feature used to identify which screen is currently active.
/// The `image` field is the filename of the template image inside the screen's identity folder.
/// ALL identity features for a screen must match for that screen to be considered active.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IdentityFeature {
    pub image: String,
    pub zone: Zone,
    /// Match threshold (0.0–1.0). Higher = stricter. Default 0.8.
    #[serde(default = "default_threshold")]
    pub threshold: f64,
}

fn default_threshold() -> f64 {
    0.8
}

/// How a hero is detected in a specific slot.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum HeroDetection {
    /// Read hero name via OCR, then fuzzy-match against heroes.json.
    #[serde(rename = "ocr")]
    OCR { zone: Zone },
    /// Match the zone's content against hero portrait images.
    #[serde(rename = "image")]
    Image {
        zone: Zone,
        /// Match threshold (0.0–1.0). Default 0.8.
        #[serde(default = "default_threshold")]
        threshold: f64,
    },
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

/// A game screen definition.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScreenDef {
    /// ALL identity features must match for this screen to be active.
    pub identity: Vec<IdentityFeature>,
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
