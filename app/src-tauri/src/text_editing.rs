#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum TextAction {
    Cut,
    Copy,
    Paste,
    SelectAll,
}

#[tauri::command]
pub fn perform_text_action(app: tauri::AppHandle, action: TextAction) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        use objc2::{sel, MainThreadMarker};
        use objc2_app_kit::NSApplication;
        app.run_on_main_thread(move || {
            let marker = MainThreadMarker::new().unwrap();
            let selector = match action {
                TextAction::Cut => sel!(cut:),
                TextAction::Copy => sel!(copy:),
                TextAction::Paste => sel!(paste:),
                TextAction::SelectAll => sel!(selectAll:),
            };
            unsafe {
                NSApplication::sharedApplication(marker).sendAction_to_from(selector, None, None);
            }
        })
        .map_err(|error| error.to_string())
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (app, action);
        Err("原生文字编辑需要 macOS".into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn accepts_only_standard_text_actions() {
        for action in ["cut", "copy", "paste", "selectAll"] {
            assert!(serde_json::from_str::<TextAction>(&format!("\"{action}\"")).is_ok());
        }
        assert!(serde_json::from_str::<TextAction>("\"inspect\"").is_err());
    }
}
