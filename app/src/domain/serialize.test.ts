import { describe, expect, it } from "vitest";
import { createDefaultDeck } from "./deck";
import { serializeDeck } from "./serialize";

describe("serializeDeck", () => {
  it("produces a complete deterministic XeLaTeX document", () => {
    const deck = createDefaultDeck();
    const first = serializeDeck(deck);
    const second = serializeDeck(deck);

    expect(first).toBe(second);
    expect(first).toContain("\\documentclass{beamer}");
    expect(first).toContain("\\usepackage[fontset=fandol]{ctex}");
    expect(first).toContain("\\section{第一部分}");
    expect(first).toContain("\\end{document}");
    expect(first.indexOf("\\titlepage")).toBeLessThan(first.indexOf("\\section{第一部分}"));
    expect(first).toContain("\\AtBeginSection[]{}");
  });

  it("escapes user text while leaving formulas as TeX", () => {
    const deck = createDefaultDeck();
    deck.metadata.title = "A&B_1\\2";
    deck.sections[0].slides[1].blocks = [
      { id: "formula", type: "formula", hidden: false, fontSize: "normal", latex: "x_1 = 50\\%", layout: "single", numbered: false },
    ];

    const source = serializeDeck(deck);

    expect(source).toContain("\\title{A\\&B\\_1\\textbackslash{}2}");
    expect(source).toContain("x_1 = 50\\%");
  });

  it("uses bundled Latin and CJK monospace fonts for code", () => {
    const source = serializeDeck(createDefaultDeck());

    expect(source).toContain("\\setmonofont{lmmonolt10-regular.otf}[BoldFont=lmmonolt10-bold.otf,ItalicFont=lmmonolt10-oblique.otf,BoldItalicFont=lmmonolt10-boldoblique.otf]");
    expect(source).toContain("\\setCJKmonofont{FandolFang-Regular.otf}");
    expect(source).toContain("columns=fullflexible");
  });

  it("uses distinct CJK faces for regular bold and italic rich text", () => {
    const deck = createDefaultDeck();
    deck.sections[0].slides[1].blocks = [{
      id: "rich",
      type: "text",
      hidden: false,
      fontSize: "normal",
      content: { type: "doc", content: [{ type: "paragraph", content: [
        { type: "text", text: "正文" },
        { type: "text", text: "粗体", marks: [{ type: "bold" }] },
        { type: "text", text: "斜体", marks: [{ type: "italic" }] },
      ] }] },
    }];

    const source = serializeDeck(deck);

    expect(source).toContain("\\setCJKmainfont{FandolSong-Regular.otf}[BoldFont=FandolSong-Bold.otf,ItalicFont=FandolKai-Regular.otf");
    expect(source).toContain("\\setCJKsansfont{FandolSong-Regular.otf}[BoldFont=FandolSong-Bold.otf,ItalicFont=FandolKai-Regular.otf");
    expect(source).toContain("\\textbf{粗体}");
    expect(source).toContain("\\textit{斜体}");
    expect(source).not.toContain("\\kaishu");
  });

  it("serializes the selected CJK body font and safe rich-text links", () => {
    const deck = createDefaultDeck();
    deck.settings.bodyFont = "hei";
    deck.sections[0].slides[1].blocks = [{
      id: "links",
      type: "text",
      hidden: false,
      fontSize: "normal",
      content: { type: "doc", content: [{ type: "paragraph", content: [
        { type: "text", text: "南京大学", marks: [{ type: "link", attrs: { href: "https://www.nju.edu.cn/" } }] },
        { type: "text", text: "危险链接", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] },
      ] }] },
    }];

    const source = serializeDeck(deck);

    expect(source).toContain("\\setCJKsansfont{FandolHei-Regular.otf}[BoldFont=FandolHei-Bold.otf,ItalicFont=FandolKai-Regular.otf");
    expect(source).toContain("\\href{https://www.nju.edu.cn/}{南京大学}");
    expect(source).not.toContain("javascript:");
  });

  it("centers every manually wrapped long-formula line", () => {
    const deck = createDefaultDeck();
    deck.sections[0].slides[1].blocks = [{
      id: "long-formula",
      type: "formula",
      hidden: false,
      fontSize: "normal",
      latex: "a + b \\\\\nc + d",
      layout: "multline",
      numbered: true,
    }];

    const source = serializeDeck(deck);

    expect(source).toContain("\\begin{equation}\n\\begin{gathered}\na + b \\\\\nc + d\n\\end{gathered}\n\\end{equation}");
    expect(source).not.toContain("\\begin{multline}");
  });

  it("keeps a sized leading code block out of Beamer subtitle parsing", () => {
    const deck = createDefaultDeck();
    deck.sections[0].slides[1].title = "代码";
    deck.sections[0].slides[1].blocks = [{
      id: "code",
      type: "code",
      hidden: false,
      fontSize: "small",
      language: "Python",
      content: "print('NJU')",
    }];

    const source = serializeDeck(deck);

    expect(source).toContain("\\begin{frame}[fragile]\n\\frametitle{代码}\n{\\small");
    expect(source).not.toContain("\\begin{frame}[fragile]{代码}");
  });

  it("serializes v3 presentation features from one model", () => {
    const deck = createDefaultDeck();
    deck.settings.sectionTitleSlides = true;
    deck.settings.packages = [{ name: "siunitx", options: "" }];
    deck.settings.tikzLibraries = ["arrows.meta", "positioning"];
    deck.sections[0].slides[1].blocks = [
      {
        id: "rich",
        type: "text",
        hidden: false,
        fontSize: "small",
        content: { type: "doc", content: [{ type: "paragraph", content: [
          { type: "text", text: "红字", marks: [{ type: "textStyle", attrs: { color: "#ff0000" } }] },
          { type: "footnote", attrs: { text: "脚注" } },
        ] }] },
      },
      { id: "list", type: "list", hidden: false, fontSize: "normal", ordered: false, reveal: "overlay-alert", items: ["一", "二"] },
      { id: "formula", type: "formula", hidden: false, fontSize: "normal", latex: "a&=b\\\\\nc&=d", layout: "aligned", numbered: true },
      { id: "table", type: "table", hidden: false, fontSize: "footnotesize", columns: ["甲", "乙"], rows: [["1", "2"]], header: true },
      { id: "tikz", type: "tikz", hidden: false, fontSize: "normal", source: "\\draw (0,0) -- (1,1);" },
      { id: "hidden", type: "rawTex", hidden: true, fontSize: "normal", source: "SHOULD_NOT_RENDER" },
    ];

    const source = serializeDeck(deck);

    expect(source).toContain("\\usepackage{siunitx}");
    expect(source).toContain("\\usetikzlibrary{arrows.meta,positioning}");
    expect(source).toContain("\\AtBeginSection[]");
    expect(source).toContain("\\begin{itemize}[<+-| alert@+>]");
    expect(source).toContain("\\begin{align}");
    expect(source).toContain("\\begin{tabular}");
    expect(source).toContain("\\begin{tikzpicture}");
    expect(source).toContain("\\textcolor[HTML]{FF0000}{红字}\\footnote{脚注}");
    expect(source).toContain("{\\small");
    expect(source).not.toContain("SHOULD_NOT_RENDER");
  });
});
