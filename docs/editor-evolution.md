# 编辑器能力与边界

## 入口

- 虚拟网格与容量受限缓存：[`VirtualGrid.tsx`](../app/src/ui/VirtualGrid.tsx)、[`cache.ts`](../app/src/domain/cache.ts)。公式、素材库与 PDF 网格共用基础设施。
- 字形：[`fonts.ts`](../app/src/domain/fonts.ts)。宋体斜体采用原宋体倾斜，楷体是独立选择。
- macOS PDF 页面渲染：[`pdf_raster.rs`](../app/src-tauri/src/pdf_raster.rs)。页面网格与播放通过 CoreGraphics 绘制，系统预览承载翻页与超链接；浏览器开发模式使用 PDF.js。
- 素材缩略图：[`thumbnails.ts`](../app/verification/thumbnails.ts)、[`presetThumbnails.ts`](../app/src/services/presetThumbnails.ts)。内置图随包发布，外部素材通过队列编译，不用统一图标冒充内容。
- 扩展与示例：[extensions.md](extensions.md)。扩展仅提供声明式贡献，不执行 JavaScript。
- 离线 TikZ 编辑：[`TikzEditor.tsx`](../app/src/ui/TikzEditor.tsx)、[`tikzEditor.ts`](../app/src/domain/tikzEditor.ts)。无法可视化的语法仍保留源码，最终输出以 XeLaTeX 为准。
- 论文模型与输出：[`paper.ts`](../app/src/domain/paper.ts)。GUI、CLI、引用、资源和归档使用同一模型，使用方式见 [`app/README.md`](../app/README.md)。
- 页面大纲与命令：[架构索引](architecture.md)。
- 第三方固定版本与许可：[`sources.json`](../app/verification/vendor/sources.json)。重建命令由 `app/package.json` 的 `vendor:*` 提供。

## 论文模式边界

论文按章节编辑，支持真实 PDF 分页预览，不是 Word 式逐像素即时分页。幻灯片主题与模板不用于论文；绘图和公式素材共享。自定义排版使用 TeX 头，参考文献格式由论文模板提供。

目前不提供 DOCX 往返、修订协作、任意 LaTeX 反向解析、源码行映射或 SyncTeX 定位。可视化 TikZ 编辑器不保证理解所有第三方库；画布和公式标签编辑离线运行，上游的联网 TikZJax 预览不在离线支持范围，真实预览应应用修改后由主程序编译。性能改进由虚拟化、缓存、取消与渲染预算约束，未进行交互式帧率验收。

## 验证入口

- 领域与依赖测试：`npm test`。
- 主题语义块及字体真实编译：`npm run verify:rendering`。
- macOS 原生渲染矩阵：在生成主题矩阵后运行 `cargo test pdf_raster -- --ignored`。
- 素材与公式真实编译：`npm run verify:catalogue`。
- 四种论文示例：`npm run verify:papers`。
- 页面复制后的真实编译：`npm run verify:interactions`；对应原生渲染为 `cargo test renders_all_real_document_pages -- --ignored`。
- 主题代表色图片：`npm run generate:themes`。
- 离线插件贡献：`npm run verify:toolbox`。

交互测试由用户完成；自动编译和离屏图像检查不能代替交互性能测量。

## 参考

素材组织参考 [LaTeX 工作室](https://www.latexstudio.net/)。图形编辑器来源为 [TikZ Editor](https://tikz.dev/editor/)，论文文档类来源为 [NJUThesis](https://ctan.org/pkg/njuthesis)，虚拟化采用 [TanStack Virtual](https://tanstack.com/virtual/latest)。
