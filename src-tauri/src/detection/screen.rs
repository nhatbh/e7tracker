use image::{GrayImage, RgbImage};
use imageproc::template_matching::{match_template, MatchTemplateMethod, find_extremes};

/// Check if a template image exists within a region using color (RGB) NCC.
/// Runs NCC on each R, G, B channel independently and averages confidence.
/// Returns the match confidence (0.0–1.0). Higher = better match.
pub fn template_match_confidence(region: &RgbImage, template: &RgbImage) -> f64 {
    // Template must be smaller than region
    if template.width() > region.width() || template.height() > region.height() {
        return 0.0;
    }
    if template.width() == 0 || template.height() == 0 {
        return 0.0;
    }

    // Extract each channel as a GrayImage
    let channels_region = split_channels(region);
    let channels_template = split_channels(template);

    let mut total_conf = 0.0;
    for i in 0..3 {
        let result = match_template(
            &channels_region[i],
            &channels_template[i],
            MatchTemplateMethod::CrossCorrelationNormalized,
        );
        let extremes = find_extremes(&result);
        // Normalize from [-1, 1] to [0, 1]
        let conf = (extremes.max_value + 1.0) / 2.0;
        total_conf += conf;
    }

    (total_conf / 3.0) as f64
}

/// Split an RgbImage into 3 separate GrayImages (R, G, B channels).
fn split_channels(img: &RgbImage) -> [GrayImage; 3] {
    let (w, h) = img.dimensions();
    let mut r = GrayImage::new(w, h);
    let mut g = GrayImage::new(w, h);
    let mut b = GrayImage::new(w, h);
    for y in 0..h {
        for x in 0..w {
            let px = img.get_pixel(x, y);
            r.put_pixel(x, y, image::Luma([px[0]]));
            g.put_pixel(x, y, image::Luma([px[1]]));
            b.put_pixel(x, y, image::Luma([px[2]]));
        }
    }
    [r, g, b]
}
