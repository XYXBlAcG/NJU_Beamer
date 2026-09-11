import type { Block, Deck, RichTextNode, Slide } from "./deck";

const escapedCharacters: Record<string, string> = {
  "\\": "\\textbackslash{}", "&": "\\&", "%": "\\%", "$": "\\$", "#": "\\#", "_": "\\_",
  "{": "\\{", "}": "\\}", "~": "\\textasciitilde{}", "^": "\\textasciicircum{}",
};

const escapeText = (value: string) => Array.from(value, (character) => escapedCharacters[character] ?? character).join("");

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
    return ["https:", "http:", "mailto:"].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
};

const serializeRichNode = (node: RichTextNode): string => {
  if (node.type === "footnote") return `\\footnote{${escapeText(String(node.attrs?.text ?? ""))}}`;
  if (node.type === "hardBreak") return "\\\\\n";
  let value = node.text !== undefined ? escapeText(node.text) : (node.content ?? []).map(serializeRichNode).join("");
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
      content = `\\begin{${environment}}${overlay}\n${block.items.map((item) => `  \\item ${escapeText(item)}`).join(separator)}\n\\end{${environment}}`;
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
      const row = (cells: string[]) => Array.from({ length: columnCount }, (_, index) => escapeText(cells[index] ?? "")).join(" & ") + " \\\\";
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
  }
  return fontSized(block, content);
};

const serializeSlide = (slide: Slide): string => {
  if (slide.kind === "title") return "\\begin{frame}\n  \\titlepage\n  \\begin{center}\n    \\includegraphics[width=0.2\\linewidth]{pic/NJU_Logo.png}\n  \\end{center}\n\\end{frame}";
  if (slide.kind === "contents") return "\\begin{frame}{目录}\n  \\tableofcontents\n\\end{frame}";
  const visible = slide.blocks.filter((block) => !block.hidden);
  const fragile = visible.some((block) => block.type === "code") ? "[fragile]" : "";
  return `\\begin{frame}${fragile}\n\\frametitle{${escapeText(slide.title)}}\n${visible.map(serializeBlock).join("\n\n")}\n\\end{frame}`;
};

export const serializeDeck = (deck: Deck): string => {
  const blocks = deck.sections.flatMap((section) => section.slides).flatMap((slide) => slide.blocks);
  const needsTikz = deck.settings.tikzLibraries.length > 0 || blocks.some((block) => block.type === "tikz");
  const customPackages = deck.settings.packages.map(({ name, options }) => `\\usepackage${options ? `[${options}]` : ""}{${name}}`).join("\n");
  const tikz = needsTikz ? `\\usepackage{tikz}\n${deck.settings.tikzLibraries.length ? `\\usetikzlibrary{${deck.settings.tikzLibraries.join(",")}}` : ""}` : "";
  const sectionFrames = deck.settings.sectionTitleSlides ? "\\AtBeginSection[]{\n  \\begin{frame}\n    \\centering\\LARGE\\insertsection\n  \\end{frame}\n}" : "\\AtBeginSection[]{}";
  const prelude = deck.sections.flatMap((section) => section.slides).filter((slide) => slide.kind !== "content").map(serializeSlide).join("\n\n");
  const sections = deck.sections.map((section) => {
    const slides = section.slides.filter((slide) => slide.kind === "content").map(serializeSlide).join("\n\n");
    return slides ? `\\section{${escapeText(section.title)}}\n\n${slides}` : "";
  }).filter(Boolean).join("\n\n");
  return `\\documentclass{beamer}
\\usepackage[fontset=fandol]{ctex}
\\usepackage{hyperref}
\\usepackage{latexsym,amsmath,xcolor,multicol,booktabs,calligra}
\\usepackage{graphicx,pstricks,listings,stackengine}
\\usepackage[normalem]{ulem}
${customPackages}
${tikz}
${cjkBodyFonts[deck.settings.bodyFont]}
\\setmonofont{lmmonolt10-regular.otf}[BoldFont=lmmonolt10-bold.otf,ItalicFont=lmmonolt10-oblique.otf,BoldItalicFont=lmmonolt10-boldoblique.otf]
\\setCJKmonofont{FandolFang-Regular.otf}
\\lstset{basicstyle=\\ttfamily\\small,columns=fullflexible,keepspaces=true,showstringspaces=false,breaklines=true}
\\author{${escapeText(deck.metadata.author)}}
\\title{${escapeText(deck.metadata.title)}}
\\subtitle{${escapeText(deck.metadata.subtitle)}}
\\institute{${escapeText(deck.metadata.institute)}}
\\date{${deck.metadata.date}}
\\usepackage{NJU}
${sectionFrames}
\\AtBeginSubsection[]{}
\\begin{document}

${prelude}

${sections}

\\end{document}
`;
};
