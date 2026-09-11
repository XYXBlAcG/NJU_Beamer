use crate::{archive::{self, ArchiveEntry}, document::{self, DocumentAsset}};
use std::{collections::BTreeMap, fs, path::Path};

pub fn write(path: &Path, source: &str, assets: &[DocumentAsset], template: &Path) -> Result<(), String> {
    let style = fs::read(template.join("NJU.sty")).map_err(|error| error.to_string())?;
    let logo = fs::read(template.join("pic/NJU_Logo.png")).map_err(|error| error.to_string())?;
    let mut pictures = BTreeMap::from([("pic/NJU_Logo.png".to_owned(), logo)]);
    for asset in assets {
        document::validate_asset(asset)?;
        pictures.insert(asset.path.clone(), asset.content.clone());
    }
    let mut entries = vec![
        ArchiveEntry { path: "slide.tex", content: Some(source.as_bytes()) },
        ArchiveEntry { path: "NJU.sty", content: Some(&style) },
        ArchiveEntry { path: "pic/", content: None },
    ];
    entries.extend(pictures.iter().map(|(path, content)| ArchiveEntry { path, content: Some(content) }));
    archive::write(path, &entries)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Read;

    #[test]
    fn exports_compilable_bundle_structure() {
        let directory = tempfile::tempdir().unwrap();
        let output = directory.path().join("slides.zip");
        let template = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../templates/nju");
        write(&output, "\\documentclass{beamer}", &[], &template).unwrap();
        let mut zip = zip::ZipArchive::new(fs::File::open(output).unwrap()).unwrap();
        for name in ["slide.tex", "NJU.sty", "pic/NJU_Logo.png"] {
            let mut entry = zip.by_name(name).unwrap();
            let mut bytes = Vec::new();
            entry.read_to_end(&mut bytes).unwrap();
            assert!(!bytes.is_empty());
        }
    }
}
