# Application

## Commands

```bash
npm test
npm run build
npm run tauri dev
npm run verify:catalogue
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

无文件启动时，欢迎页提供创建幻灯片、创建文档、打开项目和最近文稿；Finder 打开与恢复副本优先。新建先选择类型，再选择文件名称和保存位置，取消不会替换当前文稿。默认手动编译；点击“编译”或按 `Command/Ctrl+Enter` 后运行 XeLaTeX 并切换到 PDF 预览。幻灯片提供响应式多页网格、系统 PDF 预览和从当前物理页开始的全屏播放。论文提供竖向纸张网格、适宽连续阅读、缩放与系统预览，不显示幻灯片播放动作。系统预览提供原生翻页与超链接交互，按 `Escape` 返回编辑。

| 操作 | macOS | Windows / Linux |
| --- | --- | --- |
| 新建并选择保存位置 | `Command+N` | `Ctrl+N` |
| 打开 | `Command+O` | `Ctrl+O` |
| 保存 | `Command+S` | `Ctrl+S` |
| 另存为 | `Command+Shift+S` | `Ctrl+Shift+S` |
| 编译并预览 | `Command+Enter` | `Ctrl+Enter` |
| 返回编辑 | `Escape` | `Escape` |
| 文稿撤销 / 重做 | `Command+Z` / `Command+Shift+Z` | `Ctrl+Z` / `Ctrl+Shift+Z` |
| 命令与最近文稿 | `Command+K` | `Ctrl+K` |
| 关闭窗口 | `Command+W` | `Ctrl+W` |
| 左栏复制 / 剪切 / 粘贴 | `Command+C/X/V` | `Ctrl+C/X/V` |
| 左栏创建副本 / 全选 | `Command+D/A` | `Ctrl+D/A` |
| 左栏删除选中项 | `Backspace` | `Backspace` |

文稿未保存时，新建、打开其他文稿和退出应用都会先请求确认。章节在左侧栏创建，在右侧“页面”属性中重命名；章节旁的加号用于向指定章节添加页面。

左栏支持 Command/Ctrl 多选、Shift 范围选择、批量页面操作、跨章节拖动和“移动到…”；章节可折叠。页面与内容块右键菜单提供相关操作，文字输入保留文字复制粘贴。复制页面或论文章节会携带图片、标签、内部引用、文献及已声明的 TeX 依赖，粘贴生成独立标识并采用目标文稿主题；自定义 TeX 头或同名资源冲突时需先统一定义。跳过的幻灯片保留可编辑内容但不参与编译。macOS 菜单栏与应用命令面板共用命令及可用状态，软件内工具栏仍保留。

“文稿”属性提供正文 CJK 字体、数学字体、主题、章节标题页、document class 选项、自定义 TeX 头、LaTeX 包和 TikZ 库配置。Times 风格数学公式使用 TeX Live 自带的 TeX Gyre Termes Math；自定义 OpenType 数学字体由当前 XeLaTeX 环境解析。主题可选择南京大学、Beamer 默认或组合 Beamer theme、color theme、font theme、inner theme 与 outer theme；自定义 TeX 头在生成配置之后写入 preamble，可用于最终覆盖。

文本、列表项、表格单元格、语义块、脚注和讲者备注可直接使用 `\(...\)`、`$...$` 或 `$$...$$`；列表与表格中的独立公式会自动转为适合当前排版上下文的行内展示样式。未闭合的公式定界符会在调用 XeLaTeX 前显示为编译诊断。内容页还支持富文本粗体、斜体、颜色、超链接与脚注、普通或逐项展示列表、单行/多行及编号公式、Beamer 普通/警示/示例/定理/证明块、二栏或三栏递归布局、表格、TikZ、代码和 Raw TeX。每个内容块都可以调整字号、隐藏、设置为逐块显现或逐块独显，并通过左侧手柄直接拖动排序；分栏中的块也可跨栏拖动。隐藏块保留在编辑器中但不会进入 TeX。

右侧“页面”属性提供 `plain`、`allowframebreaks`、`shrink`、页面标签和讲者备注。自动分页与逐项/逐块显示互斥，文稿 Schema 会阻止这一无效组合。

内容页支持三种图片插入方式：点击“图片”选择 PNG/JPEG、从 Finder 拖入编辑区、在编辑区粘贴剪贴板图片。图片会复制进 `.njub` 的 `pic/`，保存时只保留仍被图片块引用的资源。

左侧“添加结尾页”创建居中的结尾语，默认 `Thanks`，正文直接编辑；页面类型也可切换为“结尾页”。文本、列表、表格和语义块的字体选择默认继承文稿，也可独立选择宋体、黑体、楷体、仿宋或自定义中西文字体。自定义字体需要在编译机器安装，或使用 TeX 可查找的字体文件名。

素材库的主题和模板均提供“匡亚明学院”：深蓝金色、封面双徽、逐页角落双徽。主题文本与矢量标识随文稿保存，导出 TeX 后无需安装 NJUVisual。CLI 使用 `njub from-template kuang-yaming --output report.njub --json`；结尾页和字体的输入协议由 `njub schema --json` 导出。

真实编译验收入口：`npm run verify:presentation-features`；标识素材重建入口：`npm run vendor:emblems`（需要 TeX Live NJUVisual 0.3.0）。

字号从 `tiny` 到 `Huge`，选择项与 CLI 协议来自 [`typography.ts`](src/domain/typography.ts)。匡亚明双徽通过 TeX Live 的 `xsavebox` 复用矢量对象。已打开的旧文稿保留其拥有的主题源码；要使用素材库中的新主题，请重新应用“匡亚明学院”。

编译缓存按文稿隔离，未改变的输入和辅助文件参与增量构建；编译失败不返回旧 PDF。真实 50 页性能验收入口为 [`compile-performance.ts`](verification/compile-performance.ts)。先运行 `npm run verify:compile-performance`，再从 `src-tauri` 运行 `NJU_BENCH_NEW_ONLY=1 cargo test benchmarks_fifty_page_kuang_deck -- --ignored --nocapture`。前后比较时向生成命令传入旧主题文件路径，并去掉环境变量。

“导出 TeX 包”生成 ZIP，内含 `slide.tex`、`NJU.sty` 和完整图片目录；编译错误显示在右侧属性栏，保存与编译结果通过应用内消息提示。

“文稿”属性提供页面比例预设和自定义毫米尺寸。界面使用系统字体、系统窗口控件和浅色/深色外观；素材库支持搜索、分类、收藏、真实编译预览、本地扩展安装和当前文稿模板导出。富文本工具栏与公式、列表、表格输入框旁的按钮可唤出公式助手；选区可直接带入分数、根式等结构。页面和块均支持复制，恢复副本独立存放于应用数据目录。

## 素材与扩展 CLI

```bash
njub catalogue --json
njub from-template lecture --output lecture.njub --json
njub extension-schema --json
njub extension-pack --manifest ../examples/extension.manifest.json --output community.njup --json
```

扩展协议、可安装示例与真实编译验证索引见 [`docs/extensions.md`](../docs/extensions.md)。

## 论文文稿

工具栏“论文”创建论文并选择保存位置。本科、硕士、博士采用南京大学 NJUThesis，课程报告使用 A4 南京大学风格。模板预览展示各自封面；正文按左侧章节大纲编辑，编译后预览真实分页。

右侧设置提供中英文标题、摘要、关键词、院系、专业、导师、页边距、行距、页眉页脚、字体和自定义 TeX 头。章节可设为章、节、小节、附录或致谢。内容块共享绘图、公式、表格、图片、代码、拖动、字号与隐藏，并可在块前分页。富文本工具栏可插入文献与交叉引用标识；图、表、编号公式和章节可设置对应标签。文献支持 BibTeX 导入、编辑和导出，NJUThesis 提供编号或作者—年份样式。

论文的保存、撤销、恢复、图片拖入/粘贴和未保存询问与演示文稿共用。“导出 TeX 包”包含 `paper.tex`、论文文档类、封面资源与图片，可在独立目录编译。

```bash
njub paper-schema --json
njub create-paper --template bachelor --output paper.njub --json
njub create-paper --template master --spec paper.json --asset-root ./assets --output thesis.njub --json
njub validate paper.njub --json
```

`paper.json` 使用 `paper-schema` 的完整模型。示例：[本科](../examples/nju-bachelor.njub)、[硕士](../examples/nju-master.njub)、[博士](../examples/nju-doctor.njub)、[课程报告](../examples/nju-report.njub)。能力边界与验证入口见 [编辑器能力](../docs/editor-evolution.md)。

## 可视化绘图与性能

TikZ 内容块的“可视化编辑”打开离线 TikZ Editor。节点、边和源码由编辑器同步，点击“应用到文稿”保留可编辑 TikZ，并支持文稿撤销。未识别的语法保留源码，最终效果以 XeLaTeX 编译为准。

公式助手、素材库与 PDF 网格仅挂载可见项，归档通过 Worker 编解码。内置主题、模板与 TikZ 卡片使用各自真实编译的图片；主题展示主色、示例色和强调色，外部素材自动排队生成缩略图。macOS 网格与播放使用原生 PDF 渲染，以保留 Beamer 阴影、透明度与中文；浏览器开发模式使用 PDF.js。宋体斜体使用原宋体字形倾斜，不替换为楷体。

主题图片生成入口为 `npm run generate:themes`。页面操作后的归档往返与真实编译验收入口为 `npm run verify:interactions`；不需要交互操作。

macOS 应用包将 `.njub` 声明为 ZIP 文稿类型。安装或首次启动应用后，可以在 Finder 中双击 `.njub` 文稿；应用在未运行和已经运行两种状态下都会接收文件。

打包命令为 `npm run tauri build`，应用包输出到 `src-tauri/target/release/bundle/macos/NJU Beamer.app`。发布构建从 App Resources 读取 NJU 模板，XeLaTeX 中间文件写入系统应用缓存目录。

macOS 自动构建入口为 [`.github/workflows/build-macos.yml`](../.github/workflows/build-macos.yml)。向 `main` 推送或手动触发工作流后，会构建 Intel 与 Apple Silicon 通用 `.app`，以 ZIP 形式上传为 Actions artifact；推送 `v*` 标签还会创建或更新同名 GitHub Release，并同时发布应用 ZIP 与 [`release/tutor.pdf`](../release/tutor.pdf)。工作流不生成 Windows 产物。应用使用本地 ad-hoc 签名，不包含 Apple Developer ID 签名或公证。
