# Application

## Commands

```bash
npm test
npm run build
npm run tauri dev
```

Rust 编译服务位于 `src-tauri/src/compiler.rs`，文稿模型和 TeX 序列化入口分别位于 `src/domain/deck.ts` 与 `src/domain/serialize.ts`。

## CLI 创作接口

CLI 接受适合 Agent 生成的声明式 JSON，并将其规范化为与 GUI 相同的 `.njub` 模型。输入协议的唯一来源是 `src/domain/authoring.ts`，通过命令实时导出 JSON Schema：

```bash
npm run njub -- schema --json
npm run njub -- create --spec ../examples/double-counting-trees.spec.json --output ../examples/double-counting-trees.njub --json
npm run njub -- validate ../examples/double-counting-trees.njub --json
npm run njub -- inspect ../examples/double-counting-trees.njub --summary --json
```

`create` 默认拒绝覆盖已有文件；明确使用 `--force` 才会覆盖。规格可用 `--spec -` 从 stdin 输入，图片路径相对于规格文件目录，也可通过 `--asset-root` 指定受限资源根目录。机器调用应使用 `--json`，错误会在 stderr 返回稳定的错误码与非零退出状态。

发布 CLI 时运行 `npm run build:cli`，可执行文件生成到 `dist-cli/njub.mjs`，并由 `package.json` 的 `njub` bin 入口暴露。完整创作示例见 [`examples/double-counting-trees.spec.json`](../examples/double-counting-trees.spec.json)。

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

“文稿”属性提供正文 CJK 字体、数学字体、主题、章节标题页、document class 选项、自定义 TeX 头、LaTeX 包和 TikZ 库配置。Times 风格数学公式使用 TeX Live 自带的 TeX Gyre Termes Math；自定义 OpenType 数学字体由当前 XeLaTeX 环境解析。主题可选择南京大学、Beamer 默认或组合 Beamer theme、color theme、font theme、inner theme 与 outer theme；自定义 TeX 头在生成配置之后写入 preamble，可用于最终覆盖。

文本、列表项、表格单元格、语义块、脚注和讲者备注可直接使用 `\(...\)`、`$...$` 或 `$$...$$`；列表与表格中的独立公式会自动转为适合当前排版上下文的行内展示样式。未闭合的公式定界符会在调用 XeLaTeX 前显示为编译诊断。内容页还支持富文本粗体、斜体、颜色、超链接与脚注、普通或逐项展示列表、单行/多行及编号公式、Beamer 普通/警示/示例/定理/证明块、二栏或三栏递归布局、表格、TikZ、代码和 Raw TeX。每个内容块都可以调整字号、隐藏、设置为逐块显现或逐块独显，并通过左侧手柄直接拖动排序；分栏中的块也可跨栏拖动。隐藏块保留在编辑器中但不会进入 TeX。

右侧“页面”属性提供 `plain`、`allowframebreaks`、`shrink`、页面标签和讲者备注。自动分页与逐项/逐块显示互斥，文稿 Schema 会阻止这一无效组合。

内容页支持三种图片插入方式：点击“图片”选择 PNG/JPEG、从 Finder 拖入编辑区、在编辑区粘贴剪贴板图片。图片会复制进 `.njub` 的 `pic/`，保存时只保留仍被图片块引用的资源。

“导出 TeX 包”生成 ZIP，内含 `slide.tex`、`NJU.sty` 和完整图片目录；编译错误显示在右侧属性栏，保存与编译结果通过应用内消息提示。

macOS 应用包将 `.njub` 声明为 ZIP 文稿类型。安装或首次启动应用后，可以在 Finder 中双击 `.njub` 文稿；应用在未运行和已经运行两种状态下都会接收文件。

打包命令为 `npm run tauri build`，应用包输出到 `src-tauri/target/release/bundle/macos/NJU Beamer.app`。发布构建从 App Resources 读取 NJU 模板，XeLaTeX 中间文件写入系统应用缓存目录。

macOS 自动构建入口为 [`.github/workflows/build-macos.yml`](../.github/workflows/build-macos.yml)。向 `main` 推送或手动触发工作流后，会构建 Intel 与 Apple Silicon 通用 `.app`，以 ZIP 形式上传为 Actions artifact；推送 `v*` 标签还会创建或更新同名 GitHub Release，并同时发布应用 ZIP 与 [`release/tutor.pdf`](../release/tutor.pdf)。工作流不生成 Windows 产物，也不包含 Apple Developer ID 签名或公证。
