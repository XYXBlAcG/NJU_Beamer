# Architecture

`.njub` 是 ZIP 文稿容器：`document.json` 是内容模型的唯一写入口，`pic/` 保存文稿拥有的图片。归档编解码与校验统一位于 `app/src/domain/njub.ts`，GUI 与 CLI 共享这一路径；Tauri 只通过 `app/src-tauri/src/binary_file.rs` 提供原子二进制读写。前端文稿资源类型与引用筛选位于 `app/src/domain/document.ts`，Rust 的 `document.rs` 仅负责为编译与 TeX 发布包展开资源。

应用通过 `app/src/domain/serialize.ts` 生成 TeX，由 `app/src-tauri/src/compiler.rs` 将被引用的资源展开到应用缓存并调用 XeLaTeX，`app/src/ui/PdfPreview.tsx` 统一承载响应式物理页网格、由 WebKit 文档框架直接加载的系统 PDF 预览，以及从当前物理页开始的全屏播放。编译入口以文稿标识与模板目录隔离缓存，同一缓存通过文件锁串行访问；增量输入、辅助文件复用与失败产物清理由 `compiler.rs` 和 `document.rs` 的真实编译测试约束。内容页标题统一由 `\\frametitle` 生成。编辑与编译是显式分离的状态：中间区域默认编辑页面，用户触发编译后才生成并显示预览。

演示文稿模型位于 `app/src/domain/deck.ts`，论文通过 `app/src/domain/paper.ts` 的 `kind: paper` 独立模型描述连续章节；归档判别入口位于 `njub.ts`。共享块操作位于 `app/src/domain/blocks.ts`，输出复用 `serializeBlock` 的演示/论文目标。结构化演示页面尺寸位于 `app/src/domain/pageSize.ts`。不属于模型支持范围的内容使用显式 `rawTex` 块。混合公式语法及演示诊断入口分别位于 `app/src/domain/mixedText.ts` 与 `app/src/domain/deckValidation.ts`。

Agent 创作入口是 `app/cli/index.ts`。声明式输入规格 v2 及其到领域模型的唯一映射位于 `app/src/domain/authoring.ts`；可执行 JSON Schema 由 `njub schema` 直接从该 Zod Schema 派生，不维护第二份手写协议。

TeX 发布包由 `app/src-tauri/src/tex_bundle.rs` 生成，原子 ZIP 写入由 `app/src-tauri/src/archive.rs` 统一提供。演示包包含 `slide.tex` 与 NJU 主题，论文包包含 `paper.tex` 与论文文档类/封面资源，两者均包含被引用的 `pic/`。

南京大学模板保存在 `templates/nju`，演示主题的唯一来源是 `NJU.sty`；论文文档类及资源位于 `paper/`，固定上游版本见 `app/verification/vendor/sources.json`。

文件生命周期、编辑能力与快捷键以 [`app/README.md`](../app/README.md) 为唯一说明入口。

启动状态入口是 `app/src/domain/startup.ts`。页面复制、依赖重映射与移动的共用领域实现位于 `app/src/domain/pages.ts`，大纲操作通过 `usePageCommands.ts` 写入统一文稿历史；`DocumentOutline.tsx` 承载两种文稿的大纲。命令类型与匹配位于 `app/src/domain/commands.ts`，注册表由 `App.tsx` 派生，原生菜单通过 `app/src/services/nativeMenus.ts` 消费。共享添加块和属性面板分别为 `AddBlockToolbar.tsx` 与 `Inspector.tsx`，右键菜单复用 Radix Context Menu。

macOS 的 `.njub` 打开与原生退出事件由 `app/src-tauri/src/lib.rs` 接收。文稿替换和退出共享 `app/src/domain/lifecycle.ts`，由 `app/src/ui/App.tsx` 接入。撤销历史位于 `app/src/state/editorStore.ts`；恢复副本与最近文稿的持久化入口是 `app/src/services/session.ts`，恢复副本与用户保存文件分开存放。

声明式扩展协议位于 `app/src/domain/extensions.ts`，内置素材唯一来源为 `app/src/domain/presets.ts`。`app/src/state/libraryStore.ts` 统一管理内置、安装、禁用和收藏状态，`Catalogue.tsx` 与 `FormulaPanel.tsx` 消费同一注册表。主题的文本资源由文稿拥有，通过 `serialize.ts` 的 `filecontents*` 写入可独立编译的 TeX；卸载扩展不会改变已创建文稿。素材预览使用独立的临时编译缓存，结果不进入当前文稿状态。

扩展包作者入口与验证命令见 [`app/README.md`](../app/README.md)，扩展与功能目录见 [extensions.md](extensions.md)。

归档编码、解码与恢复通过 `app/src/services/archiveWorker.ts` 在 Worker 中运行，Worker 与 CLI 调用同一编解码器。文献模型、BibTeX 导入与序列化的入口为 `app/src/domain/bibliography.ts`。字体渲染的单一来源为 `app/src/domain/fonts.ts`，块级配置协议位于 `deck.ts` 的 `textFontSchema`；结尾页复用块编辑与序列化。匡亚明学院主题与模板位于 `kuangTemplate.ts`，双徽的固定矢量素材与来源记录位于 `domain/vendor/nju-emblems.json`。

macOS 页面网格、播放和外部素材缩略图使用 `app/src-tauri/src/pdf_raster.rs` 的 CoreGraphics 渲染，PDF 数据一次登记，页面通过二进制 PNG 传输。`app/src/services/renderQueue.ts` 限制前端并发，画布预算与请求取消由预览组件控制；系统 PDF iframe 保留交互式文档预览。浏览器开发模式使用 PDF.js，不能将 Node Canvas 的输出当作原生渲染基准。

原生 PNG 的 IPC 字节归一化入口是 `app/src/services/pdfRaster.ts`，支持 WKWebView 数组与二进制响应；布局参数唯一来源为 `app/src/domain/pdfLayout.ts`。主题预览内容由 `presetPreview.ts` 生成，内置卡片生成入口为 `app/verification/theme-thumbnails.ts`；外部主题复用 `presetThumbnails.ts` 队列。

字号协议、选择项和通用图示颜色位于 `app/src/domain/typography.ts`；GUI 与 CLI 从该定义派生。版本入口是 `app/package.json`，macOS 配置直接引用它，Cargo 元数据一致性由 `app/verification/version.test.ts` 约束。
