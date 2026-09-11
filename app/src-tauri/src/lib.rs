mod archive;
mod compiler;
mod document;
mod tex_bundle;

use compiler::CompileResult;
use std::{
    fs,
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, Ordering},
        Mutex,
    },
};
use tauri::{Emitter, Manager};

#[derive(Default)]
struct OpenDocuments {
    frontend_ready: AtomicBool,
    pending: Mutex<Vec<String>>,
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
) -> Result<CompileResult, String> {
    let compile_cache = app
        .path()
        .app_cache_dir()
        .map_err(|error| error.to_string())?
        .join("compile");
    tauri::async_runtime::spawn_blocking(move || {
        compiler::compile(&source, &PathBuf::from(workspace), &compile_cache, &assets)
    })
    .await
    .map_err(|error| error.to_string())?
    .map_err(|error| error.to_string())
}

#[tauri::command]
fn read_document(path: String) -> Result<document::OpenedDocument, String> {
    document::read(&PathBuf::from(path))
}

#[tauri::command]
fn write_document(path: String, content: String, assets: Vec<document::DocumentAsset>) -> Result<(), String> {
    document::write(&PathBuf::from(path), &content, &assets)
}

#[tauri::command]
fn export_tex_bundle(path: String, source: String, assets: Vec<document::DocumentAsset>, workspace: String) -> Result<(), String> {
    tex_bundle::write(&PathBuf::from(path), &source, &assets, &PathBuf::from(workspace))
}

#[tauri::command]
fn write_binary_file(path: String, content: Vec<u8>) -> Result<(), String> {
    fs::write(path, content).map_err(|error| error.to_string())
}

#[tauri::command]
fn register_open_document_listener(state: tauri::State<'_, OpenDocuments>) -> Vec<String> {
    state.frontend_ready.store(true, Ordering::SeqCst);
    std::mem::take(&mut *state.pending.lock().expect("open document queue poisoned"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .manage(OpenDocuments::default())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            default_template_directory,
            compile_document,
            read_document,
            write_document,
            export_tex_bundle,
            write_binary_file,
            register_open_document_listener
        ])
        .build(tauri::generate_context!())
        .expect("failed to build NJU Beamer Editor");

    app.run(|app_handle, event| {
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
