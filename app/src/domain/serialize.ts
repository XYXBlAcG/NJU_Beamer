import type { Block, Deck, RichTextNode, Slide } from "./deck";
import { parseMixedText } from "./mixedText";

const escapedCharacters: Record<string, string> = {
  "\\": "\\textbackslash{}", "&": "\\&", "%": "\\%", "$": "\\$", "#": "\\#", "_": "\\_",
  "{": "\\{", "}": "\\}", "~": "\\textasciitilde{}", "^": "\\textasciicircum{}",
};

const escapeText = (value: string) => Array.from(value, (character) => escapedCharacters[character] ?? character).join("");

const serializeMixedText = (value: string, compact = false) => parseMixedText(value).segments.map((segment) => {
  if (segment.type === "text") return escapeText(segment.value);
  if (segment.type === "inlineMath") return `\\(${segment.value}\\)`;
  return compact ? `\\(\\displaystyle ${segment.value}\\)` : `\\[${segment.value}\\]`;
}).join("");

const cjkBodyFonts: Record<Deck["settings"]["bodyFont"], string> = {
  song: "\\setCJKmainfont{FandolSong-Regular.otf}[BoldFont=FandolSong-Bold.otf,ItalicFont=FandolKai-Regular.otf,BoldItalicFont=FandolHei-Bold.otf,BoldItalicFeatures={FakeSlant=0.2}]\n\\setCJKsansfont{FandolSong-Regular.otf}[BoldFont=FandolSong-Bold.otf,ItalicFont=FandolKai-Regular.otf,BoldItalicFont=FandolHei-Bold.otf,BoldItalicFeatures={FakeSlant=0.2}]",
  hei: "\\setCJKmainfont{FandolHei-Regular.otf}[BoldFont=FandolHei-Bold.otf,ItalicFont=FandolKai-Regular.otf,BoldItalicFont=FandolHei-Bold.otf,BoldItalicFeatures={FakeSlant=0.2}]\n\\setCJKsansfont{FandolHei-Regular.otf}[BoldFont=FandolHei-Bold.otf,ItalicFont=FandolKai-Regular.otf,BoldItalicFont=FandolHei-Bold.otf,BoldItalicFeatures={FakeSlant=0.2}]",
  kai: "\\setCJKmainfont{FandolKai-Regular.otf}[BoldFont=FandolKai-Regular.otf,BoldFeatures={FakeBold=2},ItalicFont=FandolKai-Regular.otf,ItalicFeatures={FakeSlant=0.2},BoldItalicFont=FandolKai-Regular.otf,BoldItalicFeatures={FakeBold=2,FakeSlant=0.2}]\n\\setCJKsansfont{FandolKai-Regular.otf}[BoldFont=FandolKai-Regular.otf,BoldFeatures={FakeBold=2},ItalicFont=FandolKai-Regular.otf,ItalicFeatures={FakeSlant=0.2},BoldItalicFont=FandolKai-Regular.otf,BoldItalicFeatures={FakeBold=2,FakeSlant=0.2}]",
  fangsong: "\\setCJKmainfont{FandolFang-Regular.otf}[BoldFont=FandolFang-Regular.otf,BoldFeatures={FakeBold=2},ItalicFont=FandolKai-Regular.otf,BoldItalicFont=FandolHei-Bold.otf,BoldItalicFeatures={FakeSlant=0.2}]\n\\setCJKsansfont{FandolFang-Regular.otf}[BoldFont=FandolFang-Regular.otf,BoldFeatures={FakeBold=2},ItalicFont=FandolKai-Regular.otf,BoldItalicFont=FandolHei-Bold.otf,BoldItalicFeatures={FakeSlant=0.2}]",
};

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

const serializeRichNode = (node: RichTextNode): string => {
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

const fontSized = (block: Block, content: string) => block.fontSize === "normal" ? content : `{\\${block.fontSize}\n${content}\n}`;

const appear = (block: Block, content: string) => block.appearance === "none"
  ? content
  : `\\begin{${block.appearance === "only" ? "onlyenv" : "uncoverenv"}}<+->\n${content}\n\\end{${block.appearance === "only" ? "onlyenv" : "uncoverenv"}}`;

const serializeBlock = (block: Block): string => {
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
      content = `\\begin{${environment}}\n${formula}\n\\end{${environment}}`;
      break;
    }
    case "table": {
      const columnCount = Math.max(block.columns.length, ...block.rows.map((row) => row.length));
      const row = (cells: string[]) => Array.from({ length: columnCount }, (_, index) => serializeMixedText(cells[index] ?? "", true)).join(" & ") + " \\\\";
      const lines = ["\\toprule", row(block.columns)];
      if (block.header) lines.push("\\midrule");
      lines.push(...block.rows.map(row), "\\bottomrule");
      content = `\\begin{table}\n  \\centering\n  \\begin{tabular}{${"l".repeat(columnCount)}}\n  ${lines.join("\n  ")}\n  \\end{tabular}\n\\end{table}`;
      break;
    }
    case "tikz": content = `\\begin{center}\n\\begin{tikzpicture}\n${block.source}\n\\end{tikzpicture}\n\\end{center}`; break;
    case "image": content = `\\begin{figure}\n  \\centering\n  \\includegraphics[width=${block.width}\\linewidth]{${block.source}}\n\\end{figure}`; break;
    case "code": content = `\\begin{lstlisting}[language=${block.language}]\n${block.content}\n\\end{lstlisting}`; break;
    case "rawTex": content = block.source; break;
    case "callout": {
      const environment = block.style === "alert" ? "alertblock" : block.style === "example" ? "exampleblock" : block.style;
      const title = block.style === "block" || block.style === "alert" || block.style === "example"
        ? `{${escapeText(block.title)}}`
        : block.title ? `[${escapeText(block.title)}]` : "";
      content = `\\begin{${environment}}${title}\n${(block.content.content ?? []).map(serializeRichNode).join("").trimEnd()}\n\\end{${environment}}`;
      break;
    }
    case "columns": {
      const alignment = block.alignment === "top" ? "[T]" : "[c]";
      content = `\\begin{columns}${alignment}\n${block.columns.map((column) => `\\begin{column}{${column.width}\\textwidth}\n${column.blocks.filter((item) => !item.hidden).map(serializeBlock).join("\n\n")}\n\\end{column}`).join("\n")}\n\\end{columns}`;
      break;
    }
  }
  return appear(block, fontSized(block, content));
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
  return `\\begin{frame}${options}\n\\frametitle{${escapeText(slide.title)}}\n${visible.map(serializeBlock).join("\n\n")}${notes(slide)}\n\\end{frame}`;
};

export const serializeDeck = (deck: Deck): string => {
  const blocks = deck.sections.flatMap((section) => section.slides).flatMap((slide) => slide.blocks);
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
  const classOptions = deck.settings.documentClassOptions.trim();
  const sectionFrames = deck.settings.sectionTitleSlides ? "\\AtBeginSection[]{\n  \\begin{frame}\n    \\centering\\LARGE\\insertsection\n  \\end{frame}\n}" : "\\AtBeginSection[]{}";
  const showNjuLogo = deck.settings.theme.mode === "nju";
  const prelude = deck.sections.flatMap((section) => section.slides).filter((slide) => slide.kind !== "content").map((slide) => serializeSlide(slide, showNjuLogo)).join("\n\n");
  const sections = deck.sections.map((section) => {
    const slides = section.slides.filter((slide) => slide.kind === "content").map((slide) => serializeSlide(slide, showNjuLogo)).join("\n\n");
    return slides ? `\\section{${escapeText(section.title)}}\n\n${slides}` : "";
  }).filter(Boolean).join("\n\n");
  return `\\documentclass${classOptions ? `[${classOptions}]` : ""}{beamer}
\\usepackage[fontset=fandol]{ctex}
\\usepackage{hyperref}
\\usepackage{latexsym,amsmath,xcolor,multicol,booktabs,calligra}
\\usepackage{graphicx,pstricks,listings,stackengine}
\\usepackage[normalem]{ulem}
\\usepackage{pgfpages}
${customPackages}
\\usepackage{unicode-math}
${tikz}
${cjkBodyFonts[deck.settings.bodyFont]}
\\setmathfont{${mathFontName}}
\\setmonofont{lmmonolt10-regular.otf}[BoldFont=lmmonolt10-bold.otf,ItalicFont=lmmonolt10-oblique.otf,BoldItalicFont=lmmonolt10-boldoblique.otf]
\\setCJKmonofont{FandolFang-Regular.otf}
\\lstset{basicstyle=\\ttfamily\\small,columns=fullflexible,keepspaces=true,showstringspaces=false,breaklines=true}
${theme}
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
