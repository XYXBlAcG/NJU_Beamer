import type { Block, Deck, RichTextNode, Slide } from "./deck";
import { parseMixedText } from "./mixedText";
import { pageSizes } from "./pageSize";
import { blockFontSetup, cjkFontSetup } from "./fonts";
import { documentColorsTex } from "./typography";

const escapedCharacters: Record<string, string> = {
  "\\": "\\textbackslash{}", "&": "\\&", "%": "\\%", "$": "\\$", "#": "\\#", "_": "\\_",
  "{": "\\{", "}": "\\}", "~": "\\textasciitilde{}", "^": "\\textasciicircum{}",
};

export const escapeText = (value: string) => Array.from(value, (character) => escapedCharacters[character] ?? character).join("");

const serializeMixedText = (value: string, compact = false) => parseMixedText(value).segments.map((segment) => {
  if (segment.type === "text") return escapeText(segment.value);
  if (segment.type === "inlineMath") return `\\(${segment.value}\\)`;
  return compact ? `\\(\\displaystyle ${segment.value}\\)` : `\\[${segment.value}\\]`;
}).join("");


const safeHref = (value: unknown) => {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    return ["https:", "http:", "mailto:"].includes(url.protocol)
      ? url.href.replace(/[%#]/g, "\\$&")
      : undefined;
  } catch {
    return undefined;
  }
};

export const serializeRichNode = (node: RichTextNode): string => {
  if (node.type === "citation" || node.type === "reference") {
    const key = String(node.attrs?.key ?? "");
    return /^[A-Za-z0-9:._-]+$/.test(key) ? `\\${node.type === "citation" ? "cite" : "ref"}{${key}}` : "";
  }
  if (node.type === "footnote") return `\\footnote{${serializeMixedText(String(node.attrs?.text ?? ""), true)}}`;
  if (node.type === "hardBreak") return "\\\\\n";
  let value = node.text !== undefined ? serializeMixedText(node.text) : (node.content ?? []).map(serializeRichNode).join("");
  for (const mark of node.marks ?? []) {
    if (mark.type === "bold") value = `\\textbf{${value}}`;
    else if (mark.type === "italic") value = `\\textit{${value}}`;
    else if (mark.type === "strike") value = `\\sout{${value}}`;
    else if (mark.type === "code") value = `\\texttt{${value}}`;
    else if (mark.type === "link") {
      const href = safeHref(mark.attrs?.href);
      if (href) value = `\\href{${href}}{${value}}`;
    }
    else if (mark.type === "textStyle" && typeof mark.attrs?.color === "string") {
      const color = mark.attrs.color.replace(/^#/, "").toUpperCase();
      if (/^[0-9A-F]{6}$/.test(color)) value = `\\textcolor[HTML]{${color}}{${value}}`;
    }
  }
  return node.type === "paragraph" ? `${value}\n\n` : value;
};

const fontSized = (block: Block, content: string) => block.fontSize === "normal" ? content : `{\\${block.fontSize}\n${content}\n\\par}`;

const appear = (block: Block, content: string) => block.appearance === "none"
  ? content
  : `\\begin{${block.appearance === "only" ? "onlyenv" : "uncoverenv"}}<+->\n${content}\n\\end{${block.appearance === "only" ? "onlyenv" : "uncoverenv"}}`;

export const serializeBlock = (block: Block, target: "presentation" | "paper" = "presentation"): string => {
  let content: string;
  switch (block.type) {
    case "text":
      content = (block.content.content ?? []).map(serializeRichNode).join("").trimEnd();
      break;
    case "list": {
      const environment = block.ordered ? "enumerate" : "itemize";
      const overlay = block.reveal === "overlay-alert" ? "[<+-| alert@+>]" : "";
      const separator = block.reveal === "pause" ? "\n  \\pause\n" : "\n";
      content = `\\begin{${environment}}${overlay}\n${block.items.map((item) => `  \\item ${serializeMixedText(item, true)}`).join(separator)}\n\\end{${environment}}`;
      break;
    }
    case "formula": {
      const environment = block.layout === "aligned" ? (block.numbered ? "align" : "align*")
        : (block.numbered ? "equation" : "equation*");
      const formula = block.layout === "multline" ? `\\begin{gathered}\n${block.latex}\n\\end{gathered}` : block.latex;
      content = `\\begin{${environment}}\n${formula}${block.label ? `\n\\label{${block.label}}` : ""}\n\\end{${environment}}`;
      break;
    }
    case "table": {
      const columnCount = Math.max(block.columns.length, ...block.rows.map((row) => row.length));
      const row = (cells: string[]) => Array.from({ length: columnCount }, (_, index) => serializeMixedText(cells[index] ?? "", true)).join(" & ") + " \\\\";
      const lines = ["\\toprule", row(block.columns)];
      if (block.header) lines.push("\\midrule");
      lines.push(...block.rows.map(row), "\\bottomrule");
      content = `\\begin{table}\n  \\centering\n  \\begin{tabular}{${"l".repeat(columnCount)}}\n  ${lines.join("\n  ")}\n  \\end{tabular}${target === "paper" && block.caption ? `\n\\caption{${escapeText(block.caption)}}` : ""}${block.label ? `\n\\label{${block.label}}` : ""}\n\\end{table}`;
      break;
    }
    case "tikz": content = target === "paper" ? `\\begin{figure}\n\\centering\n\\begin{tikzpicture}\n${block.source}\n\\end{tikzpicture}${block.caption ? `\n\\caption{${escapeText(block.caption)}}` : ""}${block.label ? `\n\\label{${block.label}}` : ""}\n\\end{figure}` : `\\begin{center}\n\\begin{tikzpicture}\n${block.source}\n\\end{tikzpicture}\n\\end{center}`; break;
    case "image": content = `\\begin{figure}\n  \\centering\n  \\includegraphics[width=${block.width}\\linewidth]{${block.source}}${target === "paper" && block.caption ? `\n\\caption{${escapeText(block.caption)}}` : ""}${block.label ? `\n\\label{${block.label}}` : ""}\n\\end{figure}`; break;
    case "code": content = `\\begin{lstlisting}[language=${block.language}${block.fontSize === "normal" ? "" : `,basicstyle=\\ttfamily\\${block.fontSize}`}]\n${block.content}\n\\end{lstlisting}`; break;
    case "rawTex": content = block.source; break;
    case "callout": {
      if (target === "paper" && !["theorem", "proof"].includes(block.style)) {
        content = `\\begin{quote}\\textbf{${escapeText(block.title)}}\\par\n${(block.content.content ?? []).map(serializeRichNode).join("")}\\end{quote}`;
        break;
      }
      const environment = block.style === "alert" ? "alertblock" : block.style === "example" ? "exampleblock" : block.style;
      const title = block.style === "block" || block.style === "alert" || block.style === "example"
        ? `{${escapeText(block.title)}}`
        : block.title ? `[${escapeText(block.title)}]` : "";
      content = `\\begin{${environment}}${title}\n${(block.content.content ?? []).map(serializeRichNode).join("").trimEnd()}\n\\end{${environment}}`;
      break;
    }
    case "columns": {
      if (target === "paper") {
        content = block.columns.map((column) => `\\begin{minipage}[t]{${column.width}\\linewidth}\n${column.blocks.filter((item) => !item.hidden).map((item) => serializeBlock(item, target)).join("\n")}\n\\end{minipage}`).join("\\hfill\n");
        break;
      }
      const alignment = block.alignment === "top" ? "[T]" : "[c]";
      content = `\\begin{columns}${alignment}\n${block.columns.map((column) => `\\begin{column}{${column.width}\\textwidth}\n${column.blocks.filter((item) => !item.hidden).map((item) => serializeBlock(item)).join("\n\n")}\n\\end{column}`).join("\n")}\n\\end{columns}`;
      break;
    }
  }
  const styled = fontSized(block, block.font ? `{${blockFontSetup(block.font)}\n${content}\n}` : content);
  return target === "paper" ? `${block.pageBreakBefore ? "\\clearpage\n" : ""}${styled}` : appear(block, styled);
};

const someBlock = (blocks: Block[], predicate: (block: Block) => boolean): boolean => blocks.some((block) => predicate(block)
  || (block.type === "columns" && block.columns.some((column) => someBlock(column.blocks, predicate))));

const frameOptions = (slide: Slide, fragile: boolean) => {
  const options = [fragile && "fragile", slide.frame.plain && "plain", slide.frame.allowFrameBreaks && "allowframebreaks", slide.frame.shrink && "shrink", slide.frame.label && `label=${slide.frame.label}`].filter(Boolean);
  return options.length ? `[${options.join(",")}]` : "";
};

const notes = (slide: Slide) => slide.notes.trim() ? `\n\\note{${serializeMixedText(slide.notes, true)}}` : "";

const serializeSlide = (slide: Slide, showNjuLogo: boolean): string => {
  if (slide.kind === "title") {
    const logo = showNjuLogo ? "\n  \\begin{center}\n    \\includegraphics[width=0.2\\linewidth]{pic/NJU_Logo.png}\n  \\end{center}" : "";
    return `\\begin{frame}${frameOptions(slide, false)}\n  \\titlepage${logo}${notes(slide)}\n\\end{frame}`;
  }
  if (slide.kind === "contents") return `\\begin{frame}${frameOptions(slide, false)}{目录}\n  \\tableofcontents${notes(slide)}\n\\end{frame}`;
  const visible = slide.blocks.filter((block) => !block.hidden);
  const options = frameOptions(slide, someBlock(visible, (block) => block.type === "code"));
  if (slide.kind === "ending") return `\\begin{frame}${options}\n\\vfill\n\\centering\\LARGE\n${visible.map((block) => serializeBlock(block)).join("\n\n")}\n\\vfill${notes(slide)}\n\\end{frame}`;
  return `\\begin{frame}${options}\n\\frametitle{${escapeText(slide.title)}}\n${visible.map((block) => serializeBlock(block)).join("\n\n")}${notes(slide)}\n\\end{frame}`;
};

export const serializeDeck = (deck: Deck): string => {
  const blocks = deck.sections.flatMap((section) => section.slides).filter((slide) => !slide.hidden).flatMap((slide) => slide.blocks);
  const needsTikz = deck.settings.tikzLibraries.length > 0 || someBlock(blocks, (block) => block.type === "tikz");
  const customPackages = deck.settings.packages.map(({ name, options }) => `\\usepackage${options ? `[${options}]` : ""}{${name}}`).join("\n");
  const tikz = needsTikz ? `\\usepackage{tikz}\n${deck.settings.tikzLibraries.length ? `\\usetikzlibrary{${deck.settings.tikzLibraries.join(",")}}` : ""}` : "";
  const mathFontName = deck.settings.mathFont.preset === "times"
    ? "texgyretermes-math.otf"
    : deck.settings.mathFont.preset === "custom" && deck.settings.mathFont.customName.trim()
      ? deck.settings.mathFont.customName.trim()
      : "latinmodern-math.otf";
  const theme = deck.settings.theme.mode === "nju"
    ? "\\usepackage{NJU}"
    : deck.settings.theme.mode === "custom"
      ? [
        deck.settings.theme.name && `\\usetheme{${deck.settings.theme.name}}`,
        deck.settings.theme.colorTheme && `\\usecolortheme{${deck.settings.theme.colorTheme}}`,
        deck.settings.theme.fontTheme && `\\usefonttheme{${deck.settings.theme.fontTheme}}`,
        deck.settings.theme.innerTheme && `\\useinnertheme{${deck.settings.theme.innerTheme}}`,
        deck.settings.theme.outerTheme && `\\useoutertheme{${deck.settings.theme.outerTheme}}`,
      ].filter(Boolean).join("\n")
      : "";
  const ratio = pageSizes.find((entry) => entry.value === deck.settings.pageSize.preset)?.tex;
  const classOptions = [ratio && `aspectratio=${ratio}`, deck.settings.documentClassOptions.trim()].filter(Boolean).join(",");
  const sectionFrames = deck.settings.sectionTitleSlides ? "\\AtBeginSection[]{\n  \\begin{frame}\n    \\centering\\LARGE\\insertsection\n  \\end{frame}\n}" : "\\AtBeginSection[]{}";
  const showNjuLogo = deck.settings.theme.mode === "nju";
  const prelude = deck.sections.flatMap((section) => section.slides).filter((slide) => !slide.hidden && (slide.kind === "title" || slide.kind === "contents")).map((slide) => serializeSlide(slide, showNjuLogo)).join("\n\n");
  const sections = deck.sections.map((section) => {
    const slides = section.slides.filter((slide) => !slide.hidden && (slide.kind === "content" || slide.kind === "ending")).map((slide) => serializeSlide(slide, showNjuLogo)).join("\n\n");
    return slides ? `\\section{${escapeText(section.title)}}\n\n${slides}` : "";
  }).filter(Boolean).join("\n\n");
  return `\\documentclass${classOptions ? `[${classOptions}]` : ""}{beamer}
\\usepackage[fontset=fandol]{ctex}
${deck.settings.themeFiles.map((file) => `\\begin{filecontents*}[overwrite]{${file.path.slice(6)}}\n${file.content}\n\\end{filecontents*}`).join("\n")}
${deck.settings.pageSize.preset === "custom" ? `\\geometry{paperwidth=${deck.settings.pageSize.widthMm}mm,paperheight=${deck.settings.pageSize.heightMm}mm}` : ""}
\\usepackage{hyperref}
\\usepackage{latexsym,amsmath,xcolor,multicol,booktabs,calligra}
${documentColorsTex}
\\usepackage{graphicx,pstricks,listings,stackengine}
\\usepackage[normalem]{ulem}
\\usepackage{pgfpages}
${customPackages}
\\usepackage{unicode-math}
${tikz}
${cjkFontSetup(deck.settings.bodyFont)}
\\setmathfont{${mathFontName}}
\\setmonofont{lmmonolt10-regular.otf}[BoldFont=lmmonolt10-bold.otf,ItalicFont=lmmonolt10-oblique.otf,BoldItalicFont=lmmonolt10-boldoblique.otf]
\\setCJKmonofont{FandolFang-Regular.otf}
\\lstset{basicstyle=\\ttfamily\\small,columns=fullflexible,keepspaces=true,showstringspaces=false,breaklines=true}
${theme}
${deck.settings.themePreamble}
\\author{${escapeText(deck.metadata.author)}}
\\title{${escapeText(deck.metadata.title)}}
\\subtitle{${escapeText(deck.metadata.subtitle)}}
\\institute{${escapeText(deck.metadata.institute)}}
\\date{${deck.metadata.date}}
${deck.settings.preamble}
${sectionFrames}
\\AtBeginSubsection[]{}
\\begin{document}

${prelude}

${sections}

\\end{document}
`;
};
