use crate::document::{self, DocumentAsset};
use serde::Serialize;
use std::{
    env,
    ffi::{OsStr, OsString},
    fs,
    path::{Path, PathBuf},
    process::Command,
};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum CompileError {
    #[error("模板目录不存在：{0}")]
    MissingWorkspace(String),
    #[error("无法访问文件：{0}")]
    Io(#[from] std::io::Error),
    #[error("未找到完整的 XeLaTeX 工具链。请安装 MacTeX，或确保 latexmk 和 xelatex 位于 PATH 中")]
    MissingToolchain,
    #[error("无法构造 TeX 工具链环境：{0}")]
    InvalidEnvironment(String),
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CompileResult {
    pub success: bool,
    pub pdf: Option<Vec<u8>>,
    pub log: String,
}

struct TexToolchain {
    latexmk: PathBuf,
    path: OsString,
}

fn find_executable(name: &str, path: Option<&OsStr>) -> Option<PathBuf> {
    path.into_iter()
        .flat_map(env::split_paths)
        .map(|directory| directory.join(name))
        .find(|candidate| candidate.is_file())
}

fn command_path(latexmk: &Path, inherited: Option<&OsStr>) -> Result<OsString, CompileError> {
    let mut directories = Vec::new();
    if let Some(directory) = latexmk.parent() {
        directories.push(directory.to_path_buf());
    }
    directories.extend(inherited.into_iter().flat_map(env::split_paths));
    for directory in ["/usr/bin", "/bin", "/usr/sbin", "/sbin"].map(PathBuf::from) {
        if directory.is_dir() && !directories.contains(&directory) {
            directories.push(directory);
        }
    }
    directories.dedup();
    env::join_paths(directories)
        .map_err(|error| CompileError::InvalidEnvironment(error.to_string()))
}

fn tex_toolchain() -> Result<TexToolchain, CompileError> {
    let inherited = env::var_os("PATH");
    let macos_directory = PathBuf::from("/Library/TeX/texbin");
    let macos_latexmk = macos_directory.join("latexmk");
    let macos_xelatex = macos_directory.join("xelatex");
    let latexmk = if macos_latexmk.is_file() && macos_xelatex.is_file() {
        macos_latexmk
    } else {
        let latexmk = find_executable("latexmk", inherited.as_deref());
        let xelatex = find_executable("xelatex", inherited.as_deref());
        match (latexmk, xelatex) {
            (Some(latexmk), Some(_)) => latexmk,
            _ => return Err(CompileError::MissingToolchain),
        }
    };
    let path = command_path(&latexmk, inherited.as_deref())?;
    Ok(TexToolchain { latexmk, path })
}

fn prepare_output_directory(output_dir: &Path) -> Result<(), std::io::Error> {
    if output_dir.exists() {
        fs::remove_dir_all(output_dir)?;
    }
    fs::create_dir_all(output_dir)
}

pub fn compile(
    source: &str,
    workspace: &Path,
    work_dir: &Path,
    assets: &[DocumentAsset],
) -> Result<CompileResult, CompileError> {
    if !workspace.is_dir() {
        return Err(CompileError::MissingWorkspace(
            workspace.display().to_string(),
        ));
    }
    let document_dir = work_dir.join("document");
    document::materialize(&document_dir, assets).map_err(|error| std::io::Error::other(error))?;
    let output_dir = work_dir.join("build");
    prepare_output_directory(&output_dir)?;
    let source_path = document_dir.join("preview.tex");
    fs::write(&source_path, source)?;
    let toolchain = tex_toolchain()?;

    let output = Command::new(toolchain.latexmk)
        .current_dir(&document_dir)
        .env("PATH", toolchain.path)
        .env("TEXINPUTS", format!("{}//:", workspace.display()))
        .args([
            "-xelatex",
            "-interaction=nonstopmode",
            "-file-line-error",
            "-synctex=1",
        ])
        .arg(format!("-outdir={}", output_dir.display()))
        .arg(&source_path)
        .output()?;

    let mut log = String::from_utf8_lossy(&output.stdout).into_owned();
    if !output.stderr.is_empty() {
        log.push_str(&String::from_utf8_lossy(&output.stderr));
    }
    let pdf_path = output_dir.join("preview.pdf");
    let pdf = if output.status.success() && pdf_path.is_file() {
        Some(fs::read(pdf_path)?)
    } else {
        None
    };
    Ok(CompileResult {
        success: output.status.success() && pdf.is_some(),
        pdf,
        log,
    })
}

pub fn default_template_directory() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../templates/nju")
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::ffi::OsString;

    #[test]
    fn prepends_latexmk_directory_to_child_process_path() {
        let inherited = std::env::join_paths([Path::new("/usr/bin"), Path::new("/bin")]).unwrap();
        let path = command_path(
            Path::new("/Library/TeX/texbin/latexmk"),
            Some(inherited.as_os_str()),
        )
        .unwrap();
        let directories = std::env::split_paths(&OsString::from(path)).collect::<Vec<_>>();

        assert_eq!(directories[0], PathBuf::from("/Library/TeX/texbin"));
        assert!(directories.contains(&PathBuf::from("/usr/bin")));
        assert!(directories.contains(&PathBuf::from("/bin")));
    }

    #[test]
    fn removes_stale_build_artifacts_before_compiling() {
        let cache = tempfile::tempdir().unwrap();
        let output = cache.path().join("build");
        fs::create_dir_all(&output).unwrap();
        fs::write(output.join("preview.log"), "stale").unwrap();

        prepare_output_directory(&output).unwrap();

        assert!(output.is_dir());
        assert!(!output.join("preview.log").exists());
    }

    #[test]
    fn default_template_is_present() {
        assert!(default_template_directory().join("NJU.sty").is_file());
    }

    #[test]
    fn compiles_with_real_xelatex() {
        let workspace = tempfile::tempdir().expect("temporary workspace unavailable");
        let compile_cache = tempfile::tempdir().expect("temporary compile cache unavailable");
        fs::copy(
            default_template_directory().join("NJU.sty"),
            workspace.path().join("NJU.sty"),
        )
        .expect("theme copy failed");
        let source = r#"\documentclass{beamer}
\usepackage[fontset=fandol]{ctex}
\usepackage{graphicx,xcolor,booktabs,amsmath,tikz}
\usetikzlibrary{arrows.meta,positioning}
\author{测试作者}
\title{GUI 编译测试}
\institute{南京大学}
\date{\today}
\usepackage{NJU}
\AtBeginSection[]{\begin{frame}\centering\LARGE\insertsection\end{frame}}
\begin{document}
\section{自动章节页}
\begin{frame}{真实渲染}
{\small \textcolor[HTML]{63065F}{XeLaTeX 编译成功。}\footnote{自动测试脚注}}
\begin{align}a&=b\\c&=d\end{align}
\begin{tabular}{ll}\toprule 甲 & 乙 \\ \bottomrule\end{tabular}
\includegraphics[width=0.2\linewidth]{pic/document-image.png}
\begin{tikzpicture}\draw[-{Stealth}] (0,0) -- (1,0);\end{tikzpicture}
\end{frame}
\end{document}
"#;
        let assets = [DocumentAsset {
            path: "pic/document-image.png".into(),
            mime_type: "image/png".into(),
            content: fs::read(default_template_directory().join("pic/NJU_Logo.png")).unwrap(),
        }];
        let result = compile(source, workspace.path(), compile_cache.path(), &assets)
            .expect("XeLaTeX invocation failed");
        assert!(result.success, "{}", result.log);
        assert!(result.pdf.is_some_and(|pdf| pdf.starts_with(b"%PDF")));
        assert!(!workspace.path().join(".nju-beamer").exists());
    }

    #[test]
    fn compiles_sized_listing_as_the_first_frame_block() {
        let compile_cache = tempfile::tempdir().expect("temporary compile cache unavailable");
        let source = r#"\documentclass{beamer}
\usepackage[fontset=fandol]{ctex}
\usepackage{listings}
\usepackage{NJU}
\begin{document}
\begin{frame}[fragile]
\frametitle{代码}
{\small
\begin{lstlisting}[language=Python]
print("你好，NJU")
\end{lstlisting}
}
\end{frame}
\end{document}
"#;
        let result = compile(
            source,
            &default_template_directory(),
            compile_cache.path(),
            &[],
        )
        .expect("XeLaTeX invocation failed");

        assert!(result.success, "{}", result.log);
    }
}
