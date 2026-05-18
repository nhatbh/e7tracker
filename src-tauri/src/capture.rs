use image::{RgbImage, Rgb};
use windows::Win32::Foundation::{HWND, RECT};
use windows::Win32::Graphics::Gdi::{
    GetDC, ReleaseDC, CreateCompatibleDC, CreateCompatibleBitmap, SelectObject,
    BitBlt, DeleteDC, DeleteObject, GetDIBits, BITMAPINFO, BITMAPINFOHEADER,
    DIB_RGB_COLORS, SRCCOPY, BI_RGB,
};
use windows::Win32::UI::WindowsAndMessaging::GetWindowRect;

/// Get the client area rect in screen coordinates.
fn get_visible_rect(hwnd: HWND) -> Option<RECT> {
    unsafe {
        use windows::Win32::Graphics::Gdi::ClientToScreen;

        let mut client_rect = RECT::default();
        if windows::Win32::UI::WindowsAndMessaging::GetClientRect(hwnd, &mut client_rect).is_err() {
            return None;
        }

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

/// Capture a window's content as an RGB image.
/// Uses desktop DC at the window's visible screen coordinates (DWM-aware).
/// Our overlay windows are marked WDA_EXCLUDEFROMCAPTURE so they won't appear.
pub fn capture_window_to_rgb(hwnd: HWND) -> Option<(RgbImage, u32, u32)> {
    unsafe {
        let rect = get_visible_rect(hwnd)?;

        let width = rect.right - rect.left;
        let height = rect.bottom - rect.top;
        if width <= 0 || height <= 0 {
            return None;
        }

        // Capture from the desktop DC at the window's screen coordinates
        let hdc_screen = GetDC(HWND(0 as _));
        let hdc_mem = CreateCompatibleDC(hdc_screen);
        let hbm_screen = CreateCompatibleBitmap(hdc_screen, width, height);

        let old_obj = SelectObject(hdc_mem, hbm_screen);
        
        // BitBlt from the calculated screen coordinates
        let _ = BitBlt(hdc_mem, 0, 0, width, height, hdc_screen, rect.left, rect.top, SRCCOPY);

        let mut bmi = BITMAPINFO {
            bmiHeader: BITMAPINFOHEADER {
                biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                biWidth: width,
                biHeight: -height, // top-down
                biPlanes: 1,
                biBitCount: 32,
                biCompression: BI_RGB.0 as u32,
                ..Default::default()
            },
            ..Default::default()
        };

        let mut buffer: Vec<u8> = vec![0; (width * height * 4) as usize];
        GetDIBits(
            hdc_mem, hbm_screen, 0, height as u32,
            Some(buffer.as_mut_ptr() as *mut _),
            &mut bmi, DIB_RGB_COLORS,
        );

        // Clean up GDI objects
        SelectObject(hdc_mem, old_obj);
        let _ = DeleteObject(hbm_screen);
        let _ = DeleteDC(hdc_mem);
        let _ = ReleaseDC(HWND(0 as _), hdc_screen);

        // Convert BGRA → RGB
        let w = width as u32;
        let h = height as u32;
        let mut rgb_img = RgbImage::new(w, h);
        for y in 0..h {
            for x in 0..w {
                let offset = ((y * w + x) * 4) as usize;
                let b = buffer[offset];
                let g = buffer[offset + 1];
                let r = buffer[offset + 2];
                rgb_img.put_pixel(x, y, Rgb([r, g, b]));
            }
        }

        Some((rgb_img, w, h))
    }
}

/// Crop a sub-region from an RGB image using percentage-based zone coordinates.
pub fn crop_zone(img: &RgbImage, win_w: u32, win_h: u32, zone: &crate::models::Zone) -> RgbImage {
    let (px, py, pw, ph) = zone.to_pixels(win_w, win_h);

    // Clamp to image bounds
    let px = px.min(win_w.saturating_sub(1));
    let py = py.min(win_h.saturating_sub(1));
    let pw = pw.min(win_w - px).max(1);
    let ph = ph.min(win_h - py).max(1);

    let mut cropped = RgbImage::new(pw, ph);
    for y in 0..ph {
        for x in 0..pw {
            let src_x = px + x;
            let src_y = py + y;
            if src_x < win_w && src_y < win_h {
                cropped.put_pixel(x, y, *img.get_pixel(src_x, src_y));
            }
        }
    }
    cropped
}
