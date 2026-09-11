# NJU Beamer GUI Editor

所见即所得的 XeTeX Beamer 桌面编辑器，使用真实 XeLaTeX 输出作为预览结果，支持响应式多页网格、系统 PDF 预览和从当前页播放。

## 仓库入口

- 应用源码与开发命令：[app](app)
- 内置南京大学模板：[templates/nju](templates/nju)
- 可直接打开的示例文稿：[examples/nju-demo.njub](examples/nju-demo.njub)
- 架构与文档索引：[docs](docs)

## 本地开发

```bash
cd app
npm install
npm run tauri dev
```

需要已安装 XeLaTeX 与 `latexmk`。macOS 的 TeX Live 标准安装路径可直接识别。

示例文稿包含完整功能演示、使用说明、本 README 的项目入口与开发方式，并以 Acknowledgement 收尾。
