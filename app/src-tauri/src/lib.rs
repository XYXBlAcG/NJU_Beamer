mod archive;
mod binary_file;
mod compiler;
mod document;
mod pdf_raster;
mod tex_bundle;
mod text_editing;

use compiler::CompileResult;
use sha2::{Digest, Sha256};
use std::{
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        Mutex,
    },
};
use tauri::{Emitter, Manager};

#[derive(Default)]
struct OpenDocuments {
    frontend_ready: AtomicBool,
    pending: Mutex<Vec<String>>,
    exit_approved: AtomicBool,
}

fn document_paths(urls: Vec<tauri::Url>) -> Vec<String> {
    urls.into_iter()
        .filter_map(|url| url.to_file_path().ok())
        .filter(|path| {
            path.extension()
                .is_some_and(|extension| extension.eq_ignore_ascii_case("njub"))
        })
        .map(|path| path.to_string_lossy().into_owned())
        .collect()
}

#[tauri::command]
fn default_template_directory(app: tauri::AppHandle) -> Result<String, String> {
    let directory = if cfg!(debug_assertions) {
        compiler::default_template_directory()
    } else {
        app.path()
            .resource_dir()
            .map_err(|error| error.to_string())?
            .join("templates/nju")
    };
    if !directory.is_dir() {
        return Err(format!("模板目录不存在：{}", directory.display()));
    }
    Ok(directory.to_string_lossy().into_owned())
}

#[tauri::command]
async fn compile_document(
    app: tauri::AppHandle,
    source: String,
    workspace: String,
    assets: Vec<document::DocumentAsset>,
    preview: bool,
    cache_key: Option<String>,
) -> Result<CompileResult, String> {
    static PREVIEW_ID: AtomicU64 = AtomicU64::new(0);
    let compile_cache = app
        .path()
        .app_cache_dir()
        .map_err(|error| error.to_string())?
        .join(if preview {
            "catalogue-preview"
        } else {
            "compile"
        });
    let compile_cache = if preview {
        compile_cache.join(PREVIEW_ID.fetch_add(1, Ordering::SeqCst).to_string())
    } else {
        let key = cache_key.ok_or("缺少文稿编译标识")?;
        compile_cache.join(format!(
            "{:x}",
            Sha256::digest(format!("{workspace}\0{key}"))
        ))
    };
    tauri::async_runtime::spawn_blocking(move || {
        let result = compiler::compile(&source, &PathBuf::from(workspace), &compile_cache, &assets);
        if preview && compile_cache.exists() {
            std::fs::remove_dir_all(&compile_cache)?;
        }
        result
    })
    .await
    .map_err(|error| error.to_string())?
    .map_err(|error| error.to_string())
}

#[tauri::command]
fn read_binary_file(path: String) -> Result<Vec<u8>, String> {
    binary_file::read(&PathBuf::from(path))
}

#[tauri::command]
fn export_tex_bundle(
    path: String,
    source: String,
    assets: Vec<document::DocumentAsset>,
    workspace: String,
    paper: bool,
) -> Result<(), String> {
    tex_bundle::write(
        &PathBuf::from(path),
        &source,
        &assets,
        &PathBuf::from(workspace),
        paper,
    )
}

#[tauri::command]
fn write_binary_file(path: String, content: Vec<u8>) -> Result<(), String> {
    binary_file::write(&PathBuf::from(path), &content)
}

#[tauri::command]
fn register_open_document_listener(state: tauri::State<'_, OpenDocuments>) -> Vec<String> {
    state.frontend_ready.store(true, Ordering::SeqCst);
    std::mem::take(&mut *state.pending.lock().expect("open document queue poisoned"))
}

fn app_state_path(app: &tauri::AppHandle, key: &str) -> Result<PathBuf, String> {
    if key.is_empty()
        || !key
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'.' || byte == b'-')
        || key.starts_with('.')
    {
        return Err("无效的应用存储标识".into());
    }
    Ok(app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?
        .join(key))
}

#[tauri::command]
fn read_app_state(app: tauri::AppHandle, key: String) -> Result<Option<Vec<u8>>, String> {
    let path = app_state_path(&app, &key)?;
    if !path.exists() {
        return Ok(None);
    }
    binary_file::read(&path).map(Some)
}

#[tauri::command]
fn write_app_state(
    app: tauri::AppHandle,
    key: String,
    content: Option<Vec<u8>>,
) -> Result<(), String> {
    let path = app_state_path(&app, &key)?;
    if let Some(bytes) = content {
        std::fs::create_dir_all(path.parent().unwrap()).map_err(|error| error.to_string())?;
        binary_file::write(&path, &bytes)
    } else if path.exists() {
        std::fs::remove_file(path).map_err(|error| error.to_string())
    } else {
        Ok(())
    }
}

#[tauri::command]
fn exit_app(app: tauri::AppHandle, state: tauri::State<'_, OpenDocuments>) {
    state.exit_approved.store(true, Ordering::SeqCst);
    app.exit(0);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .manage(OpenDocuments::default())
        .manage(pdf_raster::PdfDocuments::default())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            text_editing::perform_text_action,
            default_template_directory,
            compile_document,
            read_binary_file,
            export_tex_bundle,
            write_binary_file,
            register_open_document_listener,
            read_app_state,
            write_app_state,
            exit_app,
            pdf_raster::open_pdf_raster,
            pdf_raster::close_pdf_raster,
            pdf_raster::render_pdf_raster
        ])
        .build(tauri::generate_context!())
        .expect("failed to build NJU Beamer Editor");

    app.run(|app_handle, event| {
        if let tauri::RunEvent::ExitRequested { api, .. } = &event {
            let state = app_handle.state::<OpenDocuments>();
            if state.frontend_ready.load(Ordering::SeqCst)
                && !state.exit_approved.load(Ordering::SeqCst)
            {
                api.prevent_exit();
                let _ = app_handle.emit("request-quit", ());
            }
        }
        #[cfg(target_os = "macos")]
        if let tauri::RunEvent::Opened { urls } = event {
            let paths = document_paths(urls);
            if paths.is_empty() {
                return;
            }
            let state = app_handle.state::<OpenDocuments>();
            if state.frontend_ready.load(Ordering::SeqCst) {
                let _ = app_handle.emit("open-documents", paths);
            } else {
                state
                    .pending
                    .lock()
                    .expect("open document queue poisoned")
                    .extend(paths);
            }
        }
    });
}

#[cfg(test)]
mod open_document_tests {
    use super::document_paths;
    use tauri::Url;

    #[test]
    fn accepts_only_local_njub_documents() {
        let urls = vec![
            Url::from_file_path("/tmp/deck.njub").unwrap(),
            Url::from_file_path("/tmp/notes.txt").unwrap(),
            Url::parse("https://example.com/deck.njub").unwrap(),
        ];

        assert_eq!(document_paths(urls), vec!["/tmp/deck.njub"]);
    }
}
