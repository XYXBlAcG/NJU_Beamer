# 素材与扩展

- 可执行扩展协议：[`extensionSchema`](../app/src/domain/extensions.ts)，通过 `njub extension-schema --json` 导出，不维护另一份 Schema。
- 内置素材：[`presets.ts`](../app/src/domain/presets.ts)。`njub catalogue --json` 提供同一目录的机器可读输出。
- 扩展作者示例：[`extension.manifest.json`](../examples/extension.manifest.json)，可安装包：[`community-example.njup`](../examples/community-example.njup)。
- 可打开的绘图与公式文稿：[`advanced-editor.njub`](../examples/advanced-editor.njub)。
- 数学主题、带图片报告与可编辑绘图：[`math-research-toolbox.njup`](../examples/math-research-toolbox.njup)，生成入口：[`toolbox.ts`](../app/verification/toolbox.ts)。
- 真实编译验证入口：[`verification/catalogue.ts`](../app/verification/catalogue.ts)。

扩展 API 接受声明式主题、文稿模板、参数化 TikZ 与公式素材，不执行 JavaScript 插件代码。安装、启用、禁用、卸载与收藏位于应用“素材库”。保存当前文稿为模板会导出可分享的 `.njup` 并安装到本地；引用的图片和主题文本随文稿保存，不依赖外部扩展目录。

安装前显示作者、版本、文件来源、贡献类型与 SHA-256，并提示不要安装未经验证的插件。摘要仅用于识别文件，不等同于来源验证。替换同标识扩展需确认。TeX 编译关闭 shell escape；自行提供的 TeX 仍应来自可信来源。
