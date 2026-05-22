//! AI-based OCR Detection Engine
//!
//! This module provides the core detection capabilities for E7Tracker,
//! using AI models for screen classification and OCR for hero/stat detection.

pub mod hero_ocr;

use crate::capture::crop_zone;
use crate::models::*;
use image::RgbImage;
use std::collections::HashMap;

/// AI-based Detection Engine using ONNX models for screen classification and OCR.
pub struct DetectionEngine {
    /// The base assets directory
    pub assets_dir: std::path::PathBuf,
    /// Screen definitions loaded from simplified screen configs.
    pub screens: HashMap<String, ScreenDef>,
    /// Hero database loaded from heroes.json.
    pub heroes: Vec<HeroEntry>,
    /// Persistent ONNX Session for AI screen detection
    pub ort_session: Option<ort::session::Session>,
    /// The currently detected screen name.
    pub current_screen: std::sync::Mutex<Option<String>>,
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
    ) -> Self {
        // Initialize the ONNX session for screen classification
        let onnx_path = assets_dir.join("onnx").join("screen-classifier.onnx");
        let ort_session = match ort::session::Session::builder() {
            Ok(mut builder) => {
                crate::log_message(&format!(
                    "[ONNX] Loading screen classifier from {:?}",
                    onnx_path
                ));
                match builder.commit_from_file(&onnx_path) {
                    Ok(session) => {
                        crate::log_message("[ONNX] Screen classifier loaded successfully.");
                        Some(session)
                    }
                    Err(e) => {
                        crate::log_message(&format!(
                            "[ONNX] ERROR: Failed to load session from file: {:?}",
                            e
                        ));
                        None
                    }
                }
            }
            Err(e) => {
                crate::log_message(&format!(
                    "[ONNX] ERROR: Failed to create session builder: {:?}",
                    e
                ));
                None
            }
        };

        Self {
            assets_dir,
            screens,
            heroes,
            ort_session,
            current_screen: std::sync::Mutex::new(None),
            crop_counters: std::sync::Mutex::new(HashMap::new()),
            last_ocr_run: std::sync::Mutex::new(std::time::Instant::now()),
            last_ocr_results: std::sync::Mutex::new(HashMap::new()),
        }
    }

    /// Process a frame through the AI detection pipeline.
    pub fn process_frame(&mut self, frame: &RgbImage, win_w: u32, win_h: u32) -> FrameResult {
        // Step 1: Identify which screen we are on using AI classifier
        let (screen_name, debug_zones) = self.detect_screen(frame, win_w, win_h);

        // Update current screen tracking and log only on final changes
        {
            let mut current = self.current_screen.lock().unwrap();
            if screen_name != *current {
                if let Some(ref name) = screen_name {
                    crate::log_message(&format!("[e7tracker] Screen detected: {}", name));
                } else if current.as_ref().map_or(false, |c| c.contains("Stats")) {
                    crate::log_message("[e7tracker] Screen lost — no match");
                }
                *current = screen_name.clone();
            }
        }

        // Step 2: OCR is now called on-demand from frontend, not automatically
        let detections = Vec::new();

        FrameResult {
            screen_name,
            detections,
            debug_zones,
        }
    }

    /// Get the currently detected screen name.
    fn current_screen(&self) -> Option<String> {
        let current = self.current_screen.lock().unwrap();
        current.clone()
    }

    /// Detect which screen is active using the AI classifier.
    fn detect_screen(
        &mut self,
        frame: &RgbImage,
        _win_w: u32,
        _win_h: u32,
    ) -> (Option<String>, Vec<DebugZone>) {
        let mut predicted_screen: Option<String> = None;
        let mut debug_zones = Vec::new();

        if let Some(ref mut session) = self.ort_session {
            // 1. Resize the frame to the model's expected input size (448x448)
            let resized =
                image::imageops::resize(frame, 448, 448, image::imageops::FilterType::Triangle);

            // 2. Preprocess pixels into CHW float layout (1, 3, 448, 448)
            let mut input_data = vec![0.0_f32; 1 * 3 * 448 * 448];
            for y in 0..448 {
                for x in 0..448 {
                    let pixel = resized.get_pixel(x, y);
                    let r_idx = 0 * 448 * 448 + y as usize * 448 + x as usize;
                    let g_idx = 1 * 448 * 448 + y as usize * 448 + x as usize;
                    let b_idx = 2 * 448 * 448 + y as usize * 448 + x as usize;

                    input_data[r_idx] = pixel[0] as f32 / 255.0; // R
                    input_data[g_idx] = pixel[1] as f32 / 255.0; // G
                    input_data[b_idx] = pixel[2] as f32 / 255.0; // B
                }
            }

            let shape = [1, 3, 448, 448];

            // 3. Create the input tensor
            match ort::value::Tensor::from_array((shape, input_data.into_boxed_slice())) {
                Ok(tensor) => {
                    // 4. Run inference
                    let inputs = ort::inputs![tensor];
                    match session.run(inputs) {
                        Ok(outputs) => {
                            let output_value = &outputs[0];
                            match output_value.try_extract_tensor::<f32>() {
                                Ok((_shape, slice)) => {
                                    if slice.len() >= 3 {
                                        // Apply Softmax to get probabilities
                                        let logits = &slice[0..3];
                                        let max_logit = logits
                                            .iter()
                                            .cloned()
                                            .fold(f32::NEG_INFINITY, f32::max);
                                        let exp_sum: f32 =
                                            logits.iter().map(|&l| (l - max_logit).exp()).sum();
                                        let probs: Vec<f32> = logits
                                            .iter()
                                            .map(|&l| (l - max_logit).exp() / exp_sum)
                                            .collect();

                                        // Find the class with highest probability
                                        let (label_idx, confidence) = probs
                                            .iter()
                                            .enumerate()
                                            .max_by(|(_, &a), (_, &b)| {
                                                a.partial_cmp(&b)
                                                    .unwrap_or(std::cmp::Ordering::Equal)
                                            })
                                            .map(|(idx, &prob)| (idx, prob))
                                            .unwrap_or((0, 0.0));

                                        // crate::log_message(&format!(
                                        //     "[AI Screen Detection] Predicted class {} with confidence: {:.4} (probs: {:?})",
                                        //     label_idx, confidence, probs
                                        // ));

                                        // Map class index to screen names
                                        // This mapping should be configurable
                                        predicted_screen = match label_idx {
                                            0 => Some("Guild_War".to_string()),
                                            1 => Some("Hero_Stats".to_string()),
                                            _ => Some("Other".to_string()),
                                        };

                                        // Add debug zone for visualization
                                        debug_zones.push(DebugZone {
                                            zone: Zone {
                                                x: 0.0,
                                                y: 0.0,
                                                w: 100.0,
                                                h: 100.0,
                                            },
                                            screen_name: predicted_screen
                                                .clone()
                                                .unwrap_or_default(),
                                            confidence: confidence as f64,
                                        });
                                    } else {
                                        crate::log_message(&format!(
                                            "[ONNX] Warning: Unexpected output tensor length: {}",
                                            slice.len()
                                        ));
                                    }
                                }
                                Err(e) => {
                                    crate::log_message(&format!(
                                        "[ONNX] ERROR: Failed to extract output array: {:?}",
                                        e
                                    ));
                                }
                            }
                        }
                        Err(e) => {
                            crate::log_message(&format!(
                                "[ONNX] ERROR: Inference session run failed: {:?}",
                                e
                            ));
                        }
                    }
                }
                Err(e) => {
                    crate::log_message(&format!("[ONNX] ERROR: Failed to create tensor: {:?}", e));
                }
            }
        } else {
            crate::log_message("[ONNX] Screen classifier session is not loaded.");
        }

        (predicted_screen, debug_zones)
    }

    /// Detect the hero in a specific slot using AI OCR (now called on-demand).
    pub fn detect_slot(
        &self,
        frame: &RgbImage,
        win_w: u32,
        win_h: u32,
        slot: &HeroSlot,
    ) -> DetectionResult {
        match &slot.detection {
            HeroDetection::OCR { zone } => {
                let region = crop_zone(frame, win_w, win_h, zone);
                // Convert to grayscale for OCR
                let gray = image::DynamicImage::ImageRgb8(region).to_luma8();

                // Use the AI OCR system
                if let Some((text, confidence)) = hero_ocr::detect_hero_by_ocr(&gray) {
                    // Note: Hero validation is now done in the frontend using BuildAssist.matchHeroName()
                    // which uses the cached hero data from SQLite. Backend heroes.json may be empty.
                    // Return hero_name without backend fuzzy matching.

                    DetectionResult {
                        slot_id: slot.id.clone(),
                        hero_id: None, // Frontend will validate and provide the matched name
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
        }
    }

    /// Fuzzy match OCR text against known heroes.
    fn fuzzy_match_hero(&self, text: &str) -> Option<HeroEntry> {
        let query = text.to_lowercase();
        self.heroes
            .iter()
            .filter_map(|hero| {
                let hero_name = hero.name.to_lowercase();
                let similarity = Self::string_similarity(&query, &hero_name);
                if similarity > 0.7 {
                    Some((similarity, hero))
                } else {
                    None
                }
            })
            .max_by(|(a, _), (b, _)| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal))
            .map(|(_, hero)| hero.clone())
    }

    /// Simple string similarity (0.0 to 1.0) based on substring matching.
    fn string_similarity(a: &str, b: &str) -> f64 {
        if a.is_empty() || b.is_empty() {
            return 0.0;
        }
        if a == b {
            return 1.0;
        }

        let a_in_b = if b.contains(a) {
            a.len() as f64 / b.len() as f64
        } else {
            0.0
        };
        let b_in_a = if a.contains(b) {
            b.len() as f64 / a.len() as f64
        } else {
            0.0
        };

        a_in_b.max(b_in_a)
    }
}
