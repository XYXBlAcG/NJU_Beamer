use crate::archive::{self, ArchiveEntry};
use serde::{Deserialize, Serialize};
use std::{
    fs::File,
    io::Read,
    path::{Component, Path},
};
use zip::ZipArchive;

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentAsset {
    pub path: String,
    pub mime_type: String,
    pub content: Vec<u8>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenedDocument {
    pub content: String,
    pub assets: Vec<DocumentAsset>,
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

pub fn read(path: &Path) -> Result<OpenedDocument, String> {
    let file = File::open(path).map_err(|error| error.to_string())?;
    let mut archive = ZipArchive::new(file).map_err(|error| error.to_string())?;
    let mut content = None;
    let mut assets = Vec::new();

    for index in 0..archive.len() {
        let mut entry = archive.by_index(index).map_err(|error| error.to_string())?;
        let name = entry.name().to_owned();
        if name == "document.json" {
            let mut value = String::new();
            entry
                .read_to_string(&mut value)
                .map_err(|error| error.to_string())?;
            content = Some(value);
        } else if !entry.is_dir() {
            validate_asset_path(&name)?;
            let mut bytes = Vec::new();
            entry
                .read_to_end(&mut bytes)
                .map_err(|error| error.to_string())?;
            assets.push(DocumentAsset {
                path: name.clone(),
                mime_type: asset_mime_type(&name)?.into(),
                content: bytes,
            });
        }
    }

    assets.sort_by(|left, right| left.path.cmp(&right.path));
    Ok(OpenedDocument {
        content: content.ok_or_else(|| "文稿中缺少 document.json".to_owned())?,
        assets,
    })
}

pub fn write(path: &Path, content: &str, assets: &[DocumentAsset]) -> Result<(), String> {
    for asset in assets {
        validate_asset(asset)?;
    }
    let mut entries = vec![
        ArchiveEntry {
            path: "document.json",
            content: Some(content.as_bytes()),
        },
        ArchiveEntry {
            path: "pic/",
            content: None,
        },
    ];
    entries.extend(assets.iter().map(|asset| ArchiveEntry {
        path: &asset.path,
        content: Some(&asset.content),
    }));
    archive::write(path, &entries)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn round_trips_document_and_assets() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("deck.njub");
        let assets = vec![DocumentAsset {
            path: "pic/12345678-1234-1234-1234-123456789abc.png".into(),
            mime_type: "image/png".into(),
            content: vec![137, 80, 78, 71],
        }];

        write(&path, "{\"formatVersion\":1}", &assets).unwrap();
        let opened = read(&path).unwrap();

        assert_eq!(opened.content, "{\"formatVersion\":1}");
        assert_eq!(opened.assets, assets);
    }

    #[test]
    fn rejects_assets_outside_pic_directory() {
        let directory = tempfile::tempdir().unwrap();
        let result = write(
            &directory.path().join("deck.njub"),
            "{}",
            &[DocumentAsset {
                path: "../escape.png".into(),
                mime_type: "image/png".into(),
                content: vec![],
            }],
        );

        assert!(result.is_err());
    }

    #[test]
    fn rejects_archive_without_document_json() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("deck.njub");
        let file = std::fs::File::create(&path).unwrap();
        zip::ZipWriter::new(file).finish().unwrap();

        assert!(read(&path).is_err());
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

    #[test]
    fn bundled_example_is_a_valid_document_archive() {
        let path = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../examples/nju-demo.njub");
        let opened = read(&path).unwrap();
        let json: serde_json::Value = serde_json::from_str(&opened.content).unwrap();
        let slides = json["sections"]
            .as_array()
            .unwrap()
            .iter()
            .flat_map(|section| section["slides"].as_array().unwrap())
            .count();
        let packages = json["settings"]["packages"].as_array().unwrap();

        assert!(opened.content.contains("NJU Beamer GUI Editor"));
        assert_eq!(json["formatVersion"], 3);
        assert_eq!(json["settings"]["bodyFont"], "song");
        assert_eq!(json["sections"].as_array().unwrap().len(), 5);
        assert!(slides >= 19);
        assert!(packages.iter().any(|package| package["name"] == "bookmark"));
        assert!(opened.content.contains("npm run tauri dev"));
        assert_eq!(
            json["sections"].as_array().unwrap().last().unwrap()["title"],
            "Acknowledgement"
        );
        assert_eq!(opened.assets.len(), 1);
        assert_eq!(opened.assets[0].path, "pic/NJU_Logo.png");
    }
}
