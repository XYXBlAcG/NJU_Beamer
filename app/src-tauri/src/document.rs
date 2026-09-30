use serde::{Deserialize, Serialize};
use std::path::{Component, Path};

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentAsset {
    pub path: String,
    pub mime_type: String,
    pub content: Vec<u8>,
}

fn asset_mime_type(path: &str) -> Result<&'static str, String> {
    match Path::new(path)
        .extension()
        .and_then(|extension| extension.to_str())
    {
        Some(extension) if extension.eq_ignore_ascii_case("png") => Ok("image/png"),
        Some(extension)
            if extension.eq_ignore_ascii_case("jpg") || extension.eq_ignore_ascii_case("jpeg") =>
        {
            Ok("image/jpeg")
        }
        _ => Err(format!("不支持的图片格式：{path}")),
    }
}

fn validate_asset_path(path: &str) -> Result<(), String> {
    let components = Path::new(path).components().collect::<Vec<_>>();
    if components.len() != 2
        || components[0] != Component::Normal("pic".as_ref())
        || !matches!(components[1], Component::Normal(_))
    {
        return Err(format!("无效的文稿资源路径：{path}"));
    }
    asset_mime_type(path)?;
    Ok(())
}

pub fn validate_asset(asset: &DocumentAsset) -> Result<(), String> {
    validate_asset_path(&asset.path)?;
    if asset.mime_type != asset_mime_type(&asset.path)? {
        return Err(format!("图片类型与扩展名不一致：{}", asset.path));
    }
    Ok(())
}

pub fn materialize(root: &Path, assets: &[DocumentAsset]) -> Result<(), String> {
    if root.exists() {
        std::fs::remove_dir_all(root).map_err(|error| error.to_string())?;
    }
    std::fs::create_dir_all(root.join("pic")).map_err(|error| error.to_string())?;
    for asset in assets {
        validate_asset(asset)?;
        std::fs::write(root.join(&asset.path), &asset.content)
            .map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_assets_outside_pic_directory() {
        assert!(validate_asset(&DocumentAsset {
            path: "../escape.png".into(),
            mime_type: "image/png".into(),
            content: vec![],
        })
        .is_err());
    }

    #[test]
    fn materializes_assets_under_the_compile_root() {
        let directory = tempfile::tempdir().unwrap();
        let root = directory.path().join("document");
        materialize(
            &root,
            &[DocumentAsset {
                path: "pic/image.jpg".into(),
                mime_type: "image/jpeg".into(),
                content: vec![1, 2, 3],
            }],
        )
        .unwrap();

        assert_eq!(
            std::fs::read(root.join("pic/image.jpg")).unwrap(),
            vec![1, 2, 3]
        );
    }
}
