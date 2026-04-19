# NJU Beamer Theme

南京大学专属 Beamer 演示文稿主题。

本模版基于[清华大学 Beamer 模版](https://github.com/YangLaTeX/thubeamer)改造，适配南京大学配色与校徽风格。

## 文件结构

```
NJU_Beamer/
├── slide.tex      # 主幻灯片文件
├── NJU.sty       # 南京大学主题样式
├── ref.bib       # 参考文献数据库
├── pic/          # 图片目录
│   └── NJU_Logo.png
└── README.md
```

## 使用方法

### 编译

使用 XeLaTeX 编译：

```bash
xelatex slide.tex
```

或使用 latexmk：

```bash
latexmk -xelatex slide.tex
```

### 自定义内容

1. 编辑 `slide.tex` 中的元信息：
   - `\author` - 作者姓名
   - `\title` - 演示标题
   - `\subtitle` - 副标题
   - `\institute` - 机构名称
   - `\date` - 日期

2. 在 `slide.tex` 中添加或修改幻灯片内容

3. 将图片放入 `pic/` 目录后引用

## 主题特点

- **南京大学配色**：采用南大紫（#63065F）作为主色调
- **校徽支持**：适配南京大学校徽
- **页脚信息**：显示作者、机构、标题及页码
- **分节导航**：自动生成带阴影效果的目录页

## 依赖环境

- XeLaTeX
- ctex 宏包（中文支持）
- beamer 演示文稿框架
- 以下 LaTeX 宏包：amsmath, xcolor, booktabs, graphicx, pstricks, listings 等

## 致谢

本模版改造自[清华大学 Beamer 模版](https://github.com/YangLaTeX/thubeamer)。

更多 Beamer 模板参考：[LaTeX Studio](https://www.latexstudio.net/archives/4051.html)
