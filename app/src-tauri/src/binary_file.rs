use std::{fs, io::Write, path::Path};

pub fn read(path: &Path) -> Result<Vec<u8>, String> {
    fs::read(path).map_err(|error| error.to_string())
}

pub fn write(path: &Path, content: &[u8]) -> Result<(), String> {
    let parent = path.parent().ok_or_else(|| "文件保存位置无效".to_owned())?;
    let mut temporary =
        tempfile::NamedTempFile::new_in(parent).map_err(|error| error.to_string())?;
    temporary
        .write_all(content)
        .map_err(|error| error.to_string())?;
    temporary
        .as_file_mut()
        .flush()
        .map_err(|error| error.to_string())?;
    temporary
        .persist(path)
        .map_err(|error| error.error.to_string())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn atomically_round_trips_and_replaces_binary_content() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("document.njub");

        write(&path, &[1, 2, 3]).unwrap();
        assert_eq!(read(&path).unwrap(), vec![1, 2, 3]);

        write(&path, &[4, 5]).unwrap();
        assert_eq!(read(&path).unwrap(), vec![4, 5]);
    }
}
