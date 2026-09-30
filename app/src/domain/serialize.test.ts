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
    expect(first).toContain("\\usepackage{unicode-math}");
    expect(first).toContain("\\setmathfont{latinmodern-math.otf}");
    expect(first).toContain("\\section{第一部分}");
    expect(first).toContain("\\end{document}");
    expect(first.indexOf("\\titlepage")).toBeLessThan(first.indexOf("\\section{第一部分}"));
    expect(first).toContain("\\AtBeginSection[]{}");
  });

  it("serializes Times-style math, custom Beamer themes and an overriding preamble", () => {
    const deck = createDefaultDeck();
    deck.settings.mathFont = { preset: "times", customName: "" };
    deck.settings.theme = {
      mode: "custom",
      name: "Madrid",
      colorTheme: "dolphin",
      fontTheme: "professionalfonts",
      innerTheme: "circles",
      outerTheme: "miniframes",
    };
    deck.settings.documentClassOptions = "aspectratio=169";
    deck.settings.preamble = "\\setbeamertemplate{navigation symbols}{}";

    const source = serializeDeck(deck);

    expect(source).toContain("\\documentclass[aspectratio=169]{beamer}");
    expect(source).toContain("\\setmathfont{texgyretermes-math.otf}");
    expect(source).toContain("\\usetheme{Madrid}");
    expect(source).toContain("\\usecolortheme{dolphin}");
    expect(source).toContain("\\usefonttheme{professionalfonts}");
    expect(source).toContain("\\useinnertheme{circles}");
    expect(source).toContain("\\useoutertheme{miniframes}");
    expect(source).toContain("\\setbeamertemplate{navigation symbols}{}\n\\AtBeginSection");
    expect(source).not.toContain("\\usepackage{NJU}");
    expect(source).not.toContain("pic/NJU_Logo.png");
  });

  it("supports an explicitly named OpenType math font", () => {
    const deck = createDefaultDeck();
    deck.settings.mathFont = { preset: "custom", customName: "STIX Two Math" };

    expect(serializeDeck(deck)).toContain("\\setmathfont{STIX Two Math}");
  });

  it("loads math extension packages before unicode-math", () => {
    const deck = createDefaultDeck();
    deck.settings.packages = [{ name: "mathtools", options: "" }];
    const source = serializeDeck(deck);

    expect(source.indexOf("\\usepackage{mathtools}")).toBeLessThan(source.indexOf("\\usepackage{unicode-math}"));
  });

  it("escapes user text while leaving formulas as TeX", () => {
    const deck = createDefaultDeck();
    deck.metadata.title = "A&B_1\\2";
    deck.sections[0].slides[1].blocks = [
      { id: "formula", type: "formula", hidden: false, fontSize: "normal", appearance: "none", latex: "x_1 = 50\\%", layout: "single", numbered: false },
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
      fontSize: "normal", appearance: "none",
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
      fontSize: "normal", appearance: "none",
      content: { type: "doc", content: [{ type: "paragraph", content: [
        { type: "text", text: "南京大学", marks: [{ type: "link", attrs: { href: "https://www.nju.edu.cn/" } }] },
        { type: "text", text: "树的计数", marks: [{ type: "link", attrs: { href: "https://example.com/a%20b#trees" } }] },
        { type: "text", text: "危险链接", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] },
      ] }] },
    }];

    const source = serializeDeck(deck);

    expect(source).toContain("\\setCJKsansfont{FandolHei-Regular.otf}[BoldFont=FandolHei-Bold.otf,ItalicFont=FandolKai-Regular.otf");
    expect(source).toContain("\\href{https://www.nju.edu.cn/}{南京大学}");
    expect(source).toContain("\\href{https://example.com/a\\%20b\\#trees}{树的计数}");
    expect(source).not.toContain("javascript:");
  });

  it("centers every manually wrapped long-formula line", () => {
    const deck = createDefaultDeck();
    deck.sections[0].slides[1].blocks = [{
      id: "long-formula",
      type: "formula",
      hidden: false,
      fontSize: "normal", appearance: "none",
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
      fontSize: "small", appearance: "none",
      language: "Python",
      content: "print('NJU')",
    }];

    const source = serializeDeck(deck);

    expect(source).toContain("\\begin{frame}[fragile]\n\\frametitle{代码}\n{\\small");
    expect(source).not.toContain("\\begin{frame}[fragile]{代码}");
  });

  it("serializes presentation features from one model", () => {
    const deck = createDefaultDeck();
    deck.settings.sectionTitleSlides = true;
    deck.settings.packages = [{ name: "siunitx", options: "" }];
    deck.settings.tikzLibraries = ["arrows.meta", "positioning"];
    deck.sections[0].slides[1].blocks = [
      {
        id: "rich",
        type: "text",
        hidden: false,
        fontSize: "small", appearance: "none",
        content: { type: "doc", content: [{ type: "paragraph", content: [
          { type: "text", text: "红字", marks: [{ type: "textStyle", attrs: { color: "#ff0000" } }] },
          { type: "footnote", attrs: { text: "脚注" } },
        ] }] },
      },
      { id: "list", type: "list", hidden: false, fontSize: "normal", appearance: "none", ordered: false, reveal: "overlay-alert", items: ["一", "二"] },
      { id: "formula", type: "formula", hidden: false, fontSize: "normal", appearance: "none", latex: "a&=b\\\\\nc&=d", layout: "aligned", numbered: true },
      { id: "table", type: "table", hidden: false, fontSize: "footnotesize", appearance: "none", columns: ["甲", "乙"], rows: [["1", "2"]], header: true },
      { id: "tikz", type: "tikz", hidden: false, fontSize: "normal", appearance: "none", source: "\\draw (0,0) -- (1,1);" },
      { id: "hidden", type: "rawTex", hidden: true, fontSize: "normal", appearance: "none", source: "SHOULD_NOT_RENDER" },
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

  it("serializes mixed math, block overlays, callouts, columns and frame options", () => {
    const deck = createDefaultDeck();
    const slide = deck.sections[0].slides[1];
    slide.frame = { plain: true, allowFrameBreaks: false, shrink: true, label: "proof" };
    slide.notes = "先讲 $n$ 个点";
    slide.blocks = [
      { id: "text", type: "text", hidden: false, fontSize: "normal", appearance: "uncover", content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "设 $T_n=n^{n-2}$，于是 $$T_4=16$$。" }] }] } },
      { id: "callout", type: "callout", hidden: false, fontSize: "normal", appearance: "only", style: "theorem", title: "凯莱公式", content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "共有 \\(n^{n-2}\\) 棵树。" }] }] } },
      { id: "columns", type: "columns", hidden: false, fontSize: "normal", appearance: "none", alignment: "top", columns: [
        { id: "left", width: 0.48, blocks: [{ id: "list", type: "list", hidden: false, fontSize: "normal", appearance: "none", ordered: false, reveal: "none", items: ["左侧 $x$"] }] },
        { id: "right", width: 0.48, blocks: [{ id: "table", type: "table", hidden: false, fontSize: "normal", appearance: "none", columns: ["$n$"], rows: [["$$n^2$$"]], header: true }] },
      ] },
    ];

    const source = serializeDeck(deck);

    expect(source).toContain("\\begin{frame}[plain,shrink,label=proof]");
    expect(source).toContain("\\begin{uncoverenv}<+->");
    expect(source).toContain("\\begin{onlyenv}<+->");
    expect(source).toContain("\\begin{theorem}[凯莱公式]");
    expect(source).toContain("\\begin{columns}[T]");
    expect(source).toContain("设 \\(T_n=n^{n-2}\\)，于是 \\[T_4=16\\]。");
    expect(source).toContain("\\(\\displaystyle n^2\\)");
    expect(source).toContain("\\note{先讲 \\(n\\) 个点}");
  });
});
