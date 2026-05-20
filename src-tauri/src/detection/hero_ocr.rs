#![allow(dead_code)]
use crate::models::BuildStats;

/// Perform AI OCR on a cropped grayscale region and return raw text.
/// Uses the system OCR engine (win_ocr) for text extraction.
/// Returns the extracted text and confidence score.
pub fn detect_hero_by_ocr(region: &image::GrayImage) -> Option<(String, f64)> {
    // Save to temp directory for OCR processing
    let temp_dir = std::env::temp_dir().join("e7tracker");
    if let Err(e) = std::fs::create_dir_all(&temp_dir) {
        return None;
    }

    let temp_path = temp_dir.join("ocr_temp.png");

    if let Err(e) = region.save(&temp_path) {
        return None;
    }

    // Use system OCR to extract text
    let text = match win_ocr::ocr_with_lang(&temp_path.to_string_lossy(), "en") {
        Ok(t) => {
            // Clean the OCR output - keep only alphanumeric, spaces, dots, and percentages
            let cleaned: String = t
                .chars()
                .filter(|c| c.is_alphanumeric() || c.is_whitespace() || *c == '.' || *c == '%')
                .collect();
            let cleaned_joined = cleaned.split_whitespace().collect::<Vec<&str>>().join(" ");
            cleaned_joined
        }
        Err(e) => String::new(),
    };

    if text.is_empty() {
        return None;
    }

    crate::log_message(&format!("[AI OCR] Success: Extracted '{}'", text));

    // For now, return with full confidence - the fuzzy matching happens in the caller
    Some((text, 1.0))
}

/// Simple fuzzy match: returns a similarity score (0.0–1.0) between two strings.
/// Uses case-insensitive substring matching as a baseline.
pub fn fuzzy_match(haystack: &str, needle: &str) -> f64 {
    if haystack.is_empty() || needle.is_empty() {
        return 0.0;
    }

    let h = haystack.to_lowercase();
    let n = needle.to_lowercase();

    if h == n {
        return 1.0;
    }
    if h.contains(&n) || n.contains(&h) {
        let shorter = h.len().min(n.len()) as f64;
        let longer = h.len().max(n.len()) as f64;
        return shorter / longer;
    }

    0.0
}

/// Parse raw OCR stats text and normalize OCR errors into a valid BuildStats struct.
pub fn parse_current_stats(ocr_text: &str) -> Option<BuildStats> {
    // Filter tokens to keep only those containing at least one digit
    let tokens: Vec<String> = ocr_text
        .split_whitespace()
        .map(|s| s.to_string())
        .filter(|s| s.chars().any(|c| c.is_ascii_digit()))
        .collect();

    if tokens.len() < 8 {
        crate::log_message(&format!(
            "[e7tracker] Stats OCR parsing error: Expected at least 8 numeric tokens, got {}",
            tokens.len()
        ));
        return None;
    }

    // Parse the 8 stats in order: ATK, DEF, HP, SPD, CHC, CHD, EFF, EFR
    // 1. Attack (integer)
    let atk = parse_integer_stat(&tokens[0])?;
    // 2. Defense (integer)
    let def = parse_integer_stat(&tokens[1])?;
    // 3. Health (integer)
    let hp = parse_integer_stat(&tokens[2])?;
    // 4. Speed (integer)
    let spd = parse_integer_stat(&tokens[3])?;

    // 5. Crit Chance (percentage, max 100.0%)
    let chc = parse_percentage_stat(&tokens[4], 100.0)?;
    // 6. Crit Damage (percentage, max 999.0%)
    let chd = parse_percentage_stat(&tokens[5], 999.0)?;
    // 7. Effectiveness (percentage, max 999.0%)
    let eff = parse_percentage_stat(&tokens[6], 999.0)?;
    // 8. Effect Resistance (percentage, max 999.0%)
    let efr = parse_percentage_stat(&tokens[7], 999.0)?;

    Some(BuildStats {
        hp,
        atk,
        def,
        spd,
        chc,
        chd,
        eff,
        efr,
    })
}

fn parse_integer_stat(token: &str) -> Option<u32> {
    let cleaned: String = token.chars().filter(|c| c.is_ascii_digit()).collect();
    cleaned.parse::<u32>().ok()
}

fn parse_percentage_stat(token: &str, max_val: f64) -> Option<f64> {
    let lower = token.to_lowercase();

    // Clean known percentage suffix errors
    let mut cleaned_token = lower;
    if cleaned_token.ends_with("/0") {
        cleaned_token = cleaned_token[..cleaned_token.len() - 2].to_string();
    } else if cleaned_token.ends_with("/o") {
        cleaned_token = cleaned_token[..cleaned_token.len() - 2].to_string();
    } else if cleaned_token.ends_with("wo") {
        cleaned_token = cleaned_token[..cleaned_token.len() - 2].to_string();
    } else if cleaned_token.ends_with('%') {
        cleaned_token = cleaned_token[..cleaned_token.len() - 1].to_string();
    } else if cleaned_token.ends_with('o') && cleaned_token.len() > 1 {
        // Strip trailing 'o' if it's preceded by a digit
        if cleaned_token
            .chars()
            .nth(cleaned_token.len() - 2)
            .map_or(false, |c| c.is_ascii_digit())
        {
            cleaned_token = cleaned_token[..cleaned_token.len() - 1].to_string();
        }
    }

    // 1. If it contains a dot, clean of non-numeric except dot, and parse
    if cleaned_token.contains('.') {
        let cleaned: String = cleaned_token
            .chars()
            .filter(|c| c.is_ascii_digit() || *c == '.')
            .collect();
        if let Ok(val) = cleaned.parse::<f64>() {
            if val <= max_val {
                return Some(val);
            }
        }
    }

    // 2. No dot found (or failed validation), clean of non-numeric entirely
    let digits: String = cleaned_token
        .chars()
        .filter(|c| c.is_ascii_digit())
        .collect();

    if digits.is_empty() {
        return None;
    }

    if let Ok(num) = digits.parse::<u64>() {
        // Assume the last digit is the decimal place (e.g. 1000 -> 100.0)
        let val = num as f64 / 10.0;
        if val <= max_val {
            return Some(val);
        }

        // Fallback for cases where it's parsed extra symbols as double digits (e.g. 100.0% -> 10000)
        let val2 = num as f64 / 100.0;
        if val2 <= max_val {
            return Some(val2);
        }
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_percentage_stat() {
        assert_eq!(parse_percentage_stat("18.0%", 999.0), Some(18.0));
        assert_eq!(parse_percentage_stat("180/0", 999.0), Some(18.0));
        assert_eq!(parse_percentage_stat("18.0/0", 999.0), Some(18.0));
        assert_eq!(parse_percentage_stat("48.0%", 999.0), Some(48.0));
        assert_eq!(parse_percentage_stat("100.0/0", 100.0), Some(100.0));
        assert_eq!(parse_percentage_stat("198.0o/o", 999.0), Some(198.0));
        assert_eq!(parse_percentage_stat("19800/0", 999.0), Some(198.0));
    }

    #[test]
    fn test_parse_current_stats() {
        let input = "2134 969 9059 298 100.0% 1980/0 116.0% 180/0";
        let parsed = parse_current_stats(input).unwrap();
        assert_eq!(parsed.atk, 2134);
        assert_eq!(parsed.def, 969);
        assert_eq!(parsed.hp, 9059);
        assert_eq!(parsed.spd, 298);
        assert_eq!(parsed.chc, 100.0);
        assert_eq!(parsed.chd, 198.0);
        assert_eq!(parsed.eff, 116.0);
        assert_eq!(parsed.efr, 18.0);
    }
}
