use image::GrayImage;
use crate::models::HeroEntry;
use imageproc::template_matching::{match_template, MatchTemplateMethod, find_extremes};

/// Match a cropped region against all hero portraits in the database.
/// Returns the best matching hero and confidence score.
/// Note: This still uses grayscale matching for hero portraits.
pub fn detect_hero_by_image(
    region: &GrayImage,
    heroes: &[HeroEntry],
    portraits: &std::collections::HashMap<String, GrayImage>,
    threshold: f64,
) -> Option<(HeroEntry, f64)> {
    let mut best_match: Option<(HeroEntry, f64)> = None;

    for hero in heroes {
        if let Some(portrait) = portraits.get(&hero.portrait) {
            if portrait.width() > region.width() || portrait.height() > region.height() {
                continue;
            }
            let result = match_template(
                region,
                portrait,
                MatchTemplateMethod::CrossCorrelationNormalized,
            );
            let extremes = find_extremes(&result);
            let confidence = ((extremes.max_value + 1.0) / 2.0) as f64;

            if confidence >= threshold {
                if best_match.as_ref().map_or(true, |(_, best_conf)| confidence > *best_conf) {
                    best_match = Some((hero.clone(), confidence));
                }
            }
        }
    }

    best_match
}
