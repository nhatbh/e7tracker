pub mod screen;
pub mod hero_ocr;
pub mod hero_image;

use std::collections::HashMap;
use image::RgbImage;
use crate::models::*;
use crate::capture::crop_zone;

/// Preloaded assets for detection.
pub struct DetectionEngine {
    /// The base assets directory
    pub assets_dir: std::path::PathBuf,
    /// Screen definitions loaded from screens.json.
    pub screens: HashMap<String, ScreenDef>,
    /// Hero database loaded from heroes.json.
    pub heroes: Vec<HeroEntry>,
    /// Preloaded identity template images per screen.
    /// Key: "ScreenName/image_filename.png"
    pub identity_templates: HashMap<String, RgbImage>,
    /// Preloaded hero portrait images.
    /// Key: portrait filename
    pub hero_portraits: HashMap<String, RgbImage>,
    /// The currently detected screen name.
    pub current_screen: Option<String>,
    /// Counters for rotating debug crop saves (0, 1, 2)
    pub crop_counters: std::sync::Mutex<HashMap<String, usize>>,
    /// Throttle OCR to once per second
    pub last_ocr_run: std::sync::Mutex<std::time::Instant>,
    /// Last successful OCR results per slot
    pub last_ocr_results: std::sync::Mutex<HashMap<String, DetectionResult>>,
}

impl DetectionEngine {
    pub fn new(
        assets_dir: std::path::PathBuf,
        screens: HashMap<String, ScreenDef>,
        heroes: Vec<HeroEntry>,
        identity_templates: HashMap<String, RgbImage>,
        hero_portraits: HashMap<String, RgbImage>,
    ) -> Self {
        Self {
            assets_dir,
            screens,
            heroes,
            identity_templates,
            hero_portraits,
            current_screen: None,
            crop_counters: std::sync::Mutex::new(HashMap::new()),
            last_ocr_run: std::sync::Mutex::new(std::time::Instant::now() - std::time::Duration::from_secs(1)),
            last_ocr_results: std::sync::Mutex::new(HashMap::new()),
        }
    }

    pub fn process_frame(&mut self, frame: &RgbImage, win_w: u32, win_h: u32) -> FrameResult {
        // Step 1: Identify which screen we are on
        let (screen_name, debug_zones) = self.detect_screen(frame, win_w, win_h);

        if screen_name != self.current_screen {
            if let Some(ref name) = screen_name {
                crate::log_message(&format!("[e7tracker] Screen detected: {}", name));
            } else if self.current_screen.is_some() {
                crate::log_message("[e7tracker] Screen lost — no match");
            }
            self.current_screen = screen_name.clone();
        }

        // Step 2: If we have a screen, detect heroes in each slot
        let mut detections = Vec::new();

        if let Some(ref screen_name) = self.current_screen {
            if let Some(screen_def) = self.screens.get(screen_name) {
                // Determine if we should run OCR this frame
                let mut should_ocr = false;
                if let Ok(mut last_run) = self.last_ocr_run.lock() {
                    if last_run.elapsed() >= std::time::Duration::from_secs(1) {
                        should_ocr = true;
                        *last_run = std::time::Instant::now();
                    }
                }

                for slot in &screen_def.slots {
                    match &slot.detection {
                        HeroDetection::OCR { .. } => {
                            if should_ocr {
                                let result = self.detect_slot(frame, win_w, win_h, slot);
                                if let Ok(mut cached) = self.last_ocr_results.lock() {
                                    cached.insert(slot.id.clone(), result.clone());
                                }
                                detections.push(result);
                            } else if let Ok(cached) = self.last_ocr_results.lock() {
                                if let Some(result) = cached.get(&slot.id) {
                                    detections.push(result.clone());
                                }
                            }
                        }
                        _ => {
                            detections.push(self.detect_slot(frame, win_w, win_h, slot));
                        }
                    }
                }
            }
        }

        FrameResult {
            screen_name: self.current_screen.clone(),
            detections,
            debug_zones,
        }
    }

    fn detect_screen(&self, frame: &RgbImage, win_w: u32, win_h: u32) -> (Option<String>, Vec<DebugZone>) {
        let mut all_debug_zones = Vec::new();
        let mut best_screen: Option<String> = None;
        let mut best_avg_confidence = 0.0;
        
        for (name, screen_def) in &self.screens {
            if screen_def.identity.is_empty() {
                continue;
            }

            let mut screen_zones = Vec::new();
            let mut total_confidence = 0.0;
            let mut all_met_threshold = true;

            for feature in &screen_def.identity {
                let region = crop_zone(frame, win_w, win_h, &feature.zone);
                let template_key = format!("{}/identity/{}", name, feature.image);

                // DEBUG CROP SAVING: Save 3 rotating crops to disk for visual verification
                if let Ok(mut counters) = self.crop_counters.lock() {
                    let count = counters.entry(template_key.clone()).or_insert(0);
                    let debug_dir = self.assets_dir.join("debug_crops").join(name);
                    let _ = std::fs::create_dir_all(&debug_dir);
                    let crop_path = debug_dir.join(format!("{}_{}.png", feature.image, *count));
                    let _ = region.save(&crop_path);
                    *count = (*count + 1) % 3;
                }

                if let Some(template) = self.identity_templates.get(&template_key) {
                    let confidence = screen::template_match_confidence(&region, template);
                    total_confidence += confidence;

                    if confidence < feature.threshold {
                        all_met_threshold = false;
                    }
                    
                    let image_path = self.assets_dir
                        .join("screens")
                        .join(name)
                        .join("identity")
                        .join(&feature.image)
                        .to_string_lossy()
                        .to_string();

                    screen_zones.push(DebugZone {
                        zone: feature.zone.clone(),
                        image_name: image_path,
                        screen_name: name.clone(),
                        confidence,
                        threshold: feature.threshold,
                    });
                } else {
                    crate::log_message(&format!("[e7tracker] ERROR: Template not found: {}", template_key));
                    all_met_threshold = false;
                }
            }

            let avg_confidence = total_confidence / screen_def.identity.len() as f64;
            
            // Only consider this screen if all its features met their individual thresholds
            if all_met_threshold && avg_confidence > best_avg_confidence {
                best_avg_confidence = avg_confidence;
                best_screen = Some(name.clone());
            }

            // Always collect debug zones to show in the overlay
            all_debug_zones.extend(screen_zones);
        }



        if all_debug_zones.is_empty() {
            crate::log_message("[e7tracker] Warning: No debug zones evaluated this frame!");
        }

        (best_screen, all_debug_zones)
    }

    /// Detect the hero in a specific slot.
    fn detect_slot(&self, frame: &RgbImage, win_w: u32, win_h: u32, slot: &HeroSlot) -> DetectionResult {
        match &slot.detection {
            HeroDetection::OCR { zone } => {
                let region = crop_zone(frame, win_w, win_h, zone);
                // Convert to grayscale for OCR
                let gray = image::DynamicImage::ImageRgb8(region).to_luma8();
                if let Some((text, confidence)) = hero_ocr::detect_hero_by_ocr(&gray) {
                    crate::log_message(&format!("[e7tracker] Slot '{}': {} (OCR, conf: {:.2})", slot.id, text, confidence));
                    DetectionResult {
                        slot_id: slot.id.clone(),
                        hero_id: None,
                        hero_name: Some(text),
                        confidence,
                        display: slot.display.clone(),
                    }
                } else {
                    DetectionResult {
                        slot_id: slot.id.clone(),
                        hero_id: None,
                        hero_name: None,
                        confidence: 0.0,
                        display: slot.display.clone(),
                    }
                }
            }
            HeroDetection::Image { zone, threshold } => {
                let region = crop_zone(frame, win_w, win_h, zone);
                // Convert to grayscale for hero image matching (for now)
                let gray = image::DynamicImage::ImageRgb8(region).to_luma8();
                let gray_portraits: HashMap<String, image::GrayImage> = self.hero_portraits.iter()
                    .map(|(k, v)| (k.clone(), image::DynamicImage::ImageRgb8(v.clone()).to_luma8()))
                    .collect();
                if let Some((hero, confidence)) = hero_image::detect_hero_by_image(
                    &gray, &self.heroes, &gray_portraits, *threshold,
                ) {
                    crate::log_message(&format!("[e7tracker] Slot '{}': {} (IMG, conf: {:.2})", slot.id, hero.name, confidence));
                    DetectionResult {
                        slot_id: slot.id.clone(),
                        hero_id: Some(hero.id),
                        hero_name: Some(hero.name),
                        confidence,
                        display: slot.display.clone(),
                    }
                } else {
                    DetectionResult {
                        slot_id: slot.id.clone(),
                        hero_id: None,
                        hero_name: None,
                        confidence: 0.0,
                        display: slot.display.clone(),
                    }
                }
            }
        }
    }
}
