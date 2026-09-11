use std::{io::Write, path::Path};
use zip::{write::SimpleFileOptions, CompressionMethod, ZipWriter};

pub struct ArchiveEntry<'a> {
    pub path: &'a str,
    pub content: Option<&'a [u8]>,
}

pub fn write(path: &Path, entries: &[ArchiveEntry<'_>]) -> Result<(), String> {
    let parent = path.parent().ok_or_else(|| "归档保存位置无效".to_owned())?;
    let mut temporary = tempfile::NamedTempFile::new_in(parent).map_err(|error| error.to_string())?;
    {
        let mut archive = ZipWriter::new(temporary.as_file_mut());
        let options = SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);
        for entry in entries {
            if let Some(content) = entry.content {
                archive.start_file(entry.path, options).map_err(|error| error.to_string())?;
                archive.write_all(content).map_err(|error| error.to_string())?;
            } else {
                archive.add_directory(entry.path, options).map_err(|error| error.to_string())?;
            }
        }
        archive.finish().map_err(|error| error.to_string())?;
    }
    temporary.as_file_mut().flush().map_err(|error| error.to_string())?;
    temporary.persist(path).map_err(|error| error.error.to_string())?;
    Ok(())
}
