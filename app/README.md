# Application

## Commands

```bash
npm test
npm run build
npm run tauri dev
```

Rust 编译服务位于 `src-tauri/src/compiler.rs`，文稿模型和 TeX 序列化入口分别位于 `src/domain/deck.ts` 与 `src/domain/serialize.ts`。

## 使用方式

应用默认打开页面编辑区，不会自动编译。点击“编译”或按 `Command/Ctrl+Enter` 后运行 XeLaTeX 并切换到 PDF 预览；预览可在响应式多页网格与系统 PDF 预览之间切换，网格中选择物理页后可从该页开始全屏播放。系统预览提供原生翻页与超链接交互，按 `Escape` 返回编辑。

| 操作 | macOS | Windows / Linux |
| --- | --- | --- |
| 新建并选择保存位置 | `Command+N` | `Ctrl+N` |
| 打开 | `Command+O` | `Ctrl+O` |
| 保存 | `Command+S` | `Ctrl+S` |
| 另存为 | `Command+Shift+S` | `Ctrl+Shift+S` |
| 编译并预览 | `Command+Enter` | `Ctrl+Enter` |
| 返回编辑 | `Escape` | `Escape` |

文稿未保存时，新建、打开其他文稿和退出应用都会先请求确认。章节在左侧栏创建，在右侧“页面”属性中重命名；章节旁的加号用于向指定章节添加页面。

“文稿”属性提供正文 CJK 字体、章节标题页开关、LaTeX 包和 TikZ 库配置。内容页支持富文本粗体、斜体、颜色、超链接与脚注、普通或逐项展示列表、单行/多行及编号公式、表格、TikZ、代码和 Raw TeX。每个内容块都可以调整字号、隐藏或通过左侧手柄直接拖动排序；隐藏块保留在编辑器中但不会进入 TeX。

内容页支持三种图片插入方式：点击“图片”选择 PNG/JPEG、从 Finder 拖入编辑区、在编辑区粘贴剪贴板图片。图片会复制进 `.njub` 的 `pic/`，保存时只保留仍被图片块引用的资源。

“导出 TeX 包”生成 ZIP，内含 `slide.tex`、`NJU.sty` 和完整图片目录；编译错误显示在右侧属性栏，保存与编译结果通过应用内消息提示。

macOS 应用包将 `.njub` 声明为 ZIP 文稿类型。安装或首次启动应用后，可以在 Finder 中双击 `.njub` 文稿；应用在未运行和已经运行两种状态下都会接收文件。

打包命令为 `npm run tauri build`，应用包输出到 `src-tauri/target/release/bundle/macos/NJU Beamer.app`。发布构建从 App Resources 读取 NJU 模板，XeLaTeX 中间文件写入系统应用缓存目录。

macOS 自动构建入口为 [`.github/workflows/build-macos.yml`](../.github/workflows/build-macos.yml)。向 `main` 推送或手动触发工作流后，会构建 Intel 与 Apple Silicon 通用 `.app`，以 ZIP 形式上传为 Actions artifact；推送 `v*` 标签还会创建或更新同名 GitHub Release，并同时发布应用 ZIP 与 [`release/tutor.pdf`](../release/tutor.pdf)。工作流不生成 Windows 产物，也不包含 Apple Developer ID 签名或公证。
