# Architecture

`.njub` 是 ZIP 文稿容器：`document.json` 是内容模型的唯一写入口，`pic/` 保存文稿拥有的图片。归档编解码与校验统一位于 `app/src/domain/njub.ts`，GUI 与 CLI 共享这一路径；Tauri 只通过 `app/src-tauri/src/binary_file.rs` 提供原子二进制读写。前端文稿资源类型与引用筛选位于 `app/src/domain/document.ts`，Rust 的 `document.rs` 仅负责为编译与 TeX 发布包展开资源。

应用通过 `app/src/domain/serialize.ts` 生成 TeX，由 `app/src-tauri/src/compiler.rs` 将被引用的资源展开到应用缓存并调用 XeLaTeX，`app/src/ui/PdfPreview.tsx` 统一承载响应式物理页网格、由 WebKit 文档框架直接加载的系统 PDF 预览，以及从当前物理页开始的全屏播放。编译服务负责解析完整 TeX 工具链、为 `latexmk` 子进程建立确定的 PATH，并为每次编译创建干净的输出目录。内容页标题统一由 `\\frametitle` 生成，避免块级字号分组或 verbatim 内容被 Beamer 误判为副标题；这些契约由环境测试、产物清理测试与真实 XeLaTeX 编译测试共同约束。编辑与编译是显式分离的状态：中间区域默认编辑页面，用户触发编译后才生成并显示预览。

领域模型定义在 `app/src/domain/deck.ts`，当前归档格式为 `formatVersion: 4`，v3 文稿只在该 Schema 的读取边界迁移，保存时统一写入 v4。正文 CJK 字体、OpenType 数学字体、Beamer 主题、document class 选项、preamble、页面选项与备注、块级字号、隐藏和逐块显示状态、富文本、混合公式、超链接、语义块、递归分栏、列表、公式、表格与 TikZ 均由该模型统一描述；不属于模型支持范围的页面内容使用显式 `rawTex` 块。可编辑字符串中的混合公式语法及诊断入口分别位于 `app/src/domain/mixedText.ts` 与 `app/src/domain/deckValidation.ts`。

Agent 创作入口是 `app/cli/index.ts`。声明式输入规格 v2 及其到领域模型的唯一映射位于 `app/src/domain/authoring.ts`；可执行 JSON Schema 由 `njub schema` 直接从该 Zod Schema 派生，不维护第二份手写协议。

TeX 发布包由 `app/src-tauri/src/tex_bundle.rs` 生成，原子 ZIP 写入由 `app/src-tauri/src/archive.rs` 统一提供。发布包包含 `slide.tex`、`NJU.sty` 与被引用的 `pic/` 资源。

现有南京大学模板保存在 `templates/nju`，主题样式的唯一来源是其中的 `NJU.sty`。

文件生命周期、编辑能力与快捷键以 [`app/README.md`](../app/README.md) 为唯一说明入口。

macOS 的 `.njub` 打开事件由 `app/src-tauri/src/lib.rs` 接收。所有替换当前文稿的操作共享 `app/src/ui/App.tsx` 中的未保存状态机。
