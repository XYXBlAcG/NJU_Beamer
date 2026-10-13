use std::{
    collections::HashMap,
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc, Mutex,
    },
};

#[derive(Default)]
pub struct PdfDocuments {
    documents: Mutex<HashMap<u64, Arc<Vec<u8>>>>,
    next: AtomicU64,
}

#[tauri::command]
pub fn open_pdf_raster(
    content: Vec<u8>,
    state: tauri::State<'_, PdfDocuments>,
) -> Result<u64, String> {
    if !content.starts_with(b"%PDF-") {
        return Err("无效的 PDF".into());
    }
    let id = state.next.fetch_add(1, Ordering::Relaxed);
    state
        .documents
        .lock()
        .map_err(|e| e.to_string())?
        .insert(id, Arc::new(content));
    Ok(id)
}

#[tauri::command]
pub fn close_pdf_raster(id: u64, state: tauri::State<'_, PdfDocuments>) -> Result<(), String> {
    state
        .documents
        .lock()
        .map_err(|e| e.to_string())?
        .remove(&id);
    Ok(())
}

#[tauri::command]
pub async fn render_pdf_raster(
    id: u64,
    page: usize,
    width: usize,
    height: usize,
    state: tauri::State<'_, PdfDocuments>,
) -> Result<tauri::ipc::Response, String> {
    let bytes = state
        .documents
        .lock()
        .map_err(|e| e.to_string())?
        .get(&id)
        .cloned()
        .ok_or("PDF 已关闭")?;
    tauri::async_runtime::spawn_blocking(move || render(bytes, page, width, height))
        .await
        .map_err(|e| e.to_string())?
        .map(tauri::ipc::Response::new)
}

#[cfg(target_os = "macos")]
pub fn render(
    bytes: Arc<Vec<u8>>,
    number: usize,
    width: usize,
    height: usize,
) -> Result<Vec<u8>, String> {
    use core_graphics::{
        color_space::CGColorSpace,
        context::CGContext,
        data_provider::CGDataProvider,
        geometry::{CGAffineTransform, CGPoint, CGRect, CGSize},
    };
    use foreign_types::ForeignType;
    use std::ffi::c_void;
    #[link(name = "CoreGraphics", kind = "framework")]
    extern "C" {
        fn CGPDFDocumentCreateWithProvider(provider: *mut c_void) -> *mut c_void;
        fn CGPDFDocumentRelease(document: *mut c_void);
        fn CGPDFDocumentGetPage(document: *mut c_void, number: usize) -> *mut c_void;
        fn CGPDFPageGetBoxRect(page: *mut c_void, box_type: i32) -> CGRect;
        fn CGPDFPageGetRotationAngle(page: *mut c_void) -> i32;
        fn CGPDFPageGetDrawingTransform(
            page: *mut c_void,
            box_type: i32,
            rect: CGRect,
            rotate: i32,
            preserve: bool,
        ) -> CGAffineTransform;
        fn CGContextDrawPDFPage(context: *mut c_void, page: *mut c_void);
    }
    struct Document(*mut c_void);
    impl Drop for Document {
        fn drop(&mut self) {
            unsafe { CGPDFDocumentRelease(self.0) }
        }
    }
    if width == 0
        || height == 0
        || width
            .checked_mul(height)
            .is_none_or(|pixels| pixels > 4_000_000)
    {
        return Err("PDF 页面尺寸超出预算".into());
    }
    let provider = CGDataProvider::from_buffer(bytes);
    let raw = unsafe { CGPDFDocumentCreateWithProvider(provider.as_ptr().cast()) };
    if raw.is_null() {
        return Err("无法读取 PDF".into());
    }
    let document = Document(raw);
    let page = unsafe { CGPDFDocumentGetPage(document.0, number) };
    if page.is_null() {
        return Err("PDF 页码不存在".into());
    }
    let mut context = CGContext::create_bitmap_context(
        None,
        width,
        height,
        8,
        width * 4,
        &CGColorSpace::create_device_rgb(),
        1 | (4 << 12),
    );
    let rect = CGRect::new(
        &CGPoint::new(0.0, 0.0),
        &CGSize::new(width as f64, height as f64),
    );
    context.set_rgb_fill_color(1.0, 1.0, 1.0, 1.0);
    context.fill_rect(rect);
    let bounds = unsafe { CGPDFPageGetBoxRect(page, 1) };
    let rotated = unsafe { CGPDFPageGetRotationAngle(page) }.rem_euclid(180) != 0;
    let (page_width, page_height) = if rotated {
        (bounds.size.height, bounds.size.width)
    } else {
        (bounds.size.width, bounds.size.height)
    };
    if page_width <= 0.0 || page_height <= 0.0 {
        return Err("无效的 PDF 页面尺寸".into());
    }
    let scale = (width as f64 / page_width).min(height as f64 / page_height);
    context.scale(scale, scale);
    let target = CGRect::new(
        &CGPoint::new(0.0, 0.0),
        &CGSize::new(width as f64 / scale, height as f64 / scale),
    );
    context.concat_ctm(unsafe { CGPDFPageGetDrawingTransform(page, 1, target, 0, true) });
    unsafe { CGContextDrawPDFPage(context.as_ptr().cast(), page) };
    context.flush();
    let mut result = Vec::new();
    {
        let mut encoder = png::Encoder::new(&mut result, width as u32, height as u32);
        encoder.set_color(png::ColorType::Rgba);
        encoder.set_depth(png::BitDepth::Eight);
        let mut writer = encoder.write_header().map_err(|e| e.to_string())?;
        writer
            .write_image_data(context.data())
            .map_err(|e| e.to_string())?;
    }
    Ok(result)
}

#[cfg(not(target_os = "macos"))]
pub fn render(_: Arc<Vec<u8>>, _: usize, _: usize, _: usize) -> Result<Vec<u8>, String> {
    Err("原生 PDF 渲染仅支持 macOS".into())
}

#[cfg(all(test, target_os = "macos"))]
mod tests {
    use super::*;
    #[test]
    fn scales_and_orients_pdf_pages() {
        let stream = "1 0 0 rg 0 0 200 50 re f 0 0 1 rg 0 50 200 50 re f";
        let objects = ["<< /Type /Catalog /Pages 2 0 R >>".to_owned(), "<< /Type /Pages /Kids [3 0 R] /Count 1 >>".to_owned(), "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 100] /Resources << >> /Contents 4 0 R >>".to_owned(), format!("<< /Length {} >>\nstream\n{stream}\nendstream", stream.len())];
        let mut pdf = "%PDF-1.4\n".to_owned();
        let mut offsets = Vec::new();
        for (index, object) in objects.iter().enumerate() {
            offsets.push(pdf.len());
            pdf.push_str(&format!("{} 0 obj\n{object}\nendobj\n", index + 1));
        }
        let xref = pdf.len();
        pdf.push_str("xref\n0 5\n0000000000 65535 f \n");
        for offset in offsets {
            pdf.push_str(&format!("{offset:010} 00000 n \n"));
        }
        pdf.push_str(&format!(
            "trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n"
        ));
        let bytes = Arc::new(pdf.into_bytes());
        assert!(render(bytes.clone(), 2, 600, 300).is_err());
        let image = render(bytes, 1, 600, 300).unwrap();
        let decoder = png::Decoder::new(std::io::Cursor::new(image));
        let mut reader = decoder.read_info().unwrap();
        let mut buffer = vec![0; reader.output_buffer_size().unwrap()];
        let info = reader.next_frame(&mut buffer).unwrap();
        assert_eq!((info.width, info.height), (600, 300));
        let top = (10 * 600 + 10) * 4;
        let bottom = (290 * 600 + 590) * 4;
        assert_eq!(&buffer[top..top + 4], &[0, 0, 255, 255]);
        assert_eq!(&buffer[bottom..bottom + 4], &[255, 0, 0, 255]);
    }
    #[test]
    fn rejects_invalid_documents_and_pixel_budgets() {
        assert!(render(Arc::new(b"invalid".to_vec()), 1, 100, 100).is_err());
        assert!(render(Arc::new(Vec::new()), 1, 4000, 4000).is_err());
    }
    #[test]
    #[ignore = "Requires the XeLaTeX theme matrix generated by verify:rendering"]
    fn renders_real_compiled_semantic_blocks() {
        let root =
            std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../../.tmp/render-regression");
        assert!(root.exists());
        for entry in std::fs::read_dir(root)
            .unwrap()
            .flatten()
            .filter(|entry| entry.path().join("slide.pdf").exists())
        {
            let bytes = Arc::new(std::fs::read(entry.path().join("slide.pdf")).unwrap());
            for page in 1..=5 {
                let image = render(bytes.clone(), page, 600, 450).unwrap();
                assert!(image.starts_with(b"\x89PNG"));
                std::fs::write(entry.path().join(format!("native-{page}.png")), image).unwrap();
            }
        }
    }
    #[test]
    #[ignore = "Requires documents generated by verify:interactions"]
    fn renders_all_real_document_pages() {
        use core_graphics::data_provider::CGDataProvider;
        use foreign_types::ForeignType;
        use std::ffi::c_void;
        #[link(name = "CoreGraphics", kind = "framework")]
        extern "C" {
            fn CGPDFDocumentCreateWithProvider(provider: *mut c_void) -> *mut c_void;
            fn CGPDFDocumentGetNumberOfPages(document: *mut c_void) -> usize;
            fn CGPDFDocumentRelease(document: *mut c_void);
        }
        let root =
            std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../../.tmp/editor-interactions");
        for name in [
            "nju-demo",
            "nju-bachelor",
            "nju-master",
            "nju-doctor",
            "nju-report",
        ] {
            let directory = root.join(name);
            let bytes = Arc::new(std::fs::read(directory.join("document.pdf")).unwrap());
            let provider = CGDataProvider::from_buffer(bytes.clone());
            let document = unsafe { CGPDFDocumentCreateWithProvider(provider.as_ptr().cast()) };
            assert!(!document.is_null());
            let pages = unsafe { CGPDFDocumentGetNumberOfPages(document) };
            unsafe { CGPDFDocumentRelease(document) };
            assert!(pages > 0);
            for page in 1..=pages {
                let (width, height) = if name == "nju-demo" {
                    (800, 600)
                } else {
                    (600, 850)
                };
                let image = render(bytes.clone(), page, width, height).unwrap();
                let decoder = png::Decoder::new(std::io::Cursor::new(&image));
                let mut reader = decoder.read_info().unwrap();
                let mut buffer = vec![0; reader.output_buffer_size().unwrap()];
                let frame = reader.next_frame(&mut buffer).unwrap();
                assert_eq!((frame.width, frame.height), (width as u32, height as u32));
                std::fs::write(directory.join(format!("native-{page}.png")), image).unwrap();
            }
        }
    }
}
