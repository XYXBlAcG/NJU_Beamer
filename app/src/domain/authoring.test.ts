import { describe, expect, it } from "vitest";
import { composeAuthoringSpec } from "./authoring";

const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

describe("composeAuthoringSpec", () => {
  it("normalizes concise agent input into the canonical Deck model", async () => {
    const result = await composeAuthoringSpec({
      specVersion: 2,
      metadata: { title: "双重计数" },
      sections: [{
        title: "方法",
        slides: [
          { kind: "title" },
          {
            title: "一次对象，两种数法",
            blocks: [
              { type: "text", content: "数同一个有限集合。" },
              { type: "list", items: ["第一种", "第二种"], reveal: "overlay-alert" },
            ],
          },
        ],
      }],
    }, async () => { throw new Error("unexpected asset"); });

    expect(result.deck).toMatchObject({
      formatVersion: 4,
      metadata: { title: "双重计数", subtitle: "", author: "", institute: "南京大学", date: "\\today" },
      settings: { sectionTitleSlides: false, bodyFont: "song", packages: [], tikzLibraries: [] },
    });
    expect(result.deck.sections[0].id).toBe("section-1");
    expect(result.deck.sections[0].slides[1].id).toBe("slide-1-2");
    expect(result.deck.sections[0].slides[1].blocks[0]).toMatchObject({
      id: "block-1-2-1",
      hidden: false,
      fontSize: "normal",
      appearance: "none",
      content: { type: "doc" },
    });
    expect(result.deck.sections[0].slides[1]).toMatchObject({ frame: { plain: false, allowFrameBreaks: false, shrink: false, label: "" }, notes: "" });
    expect(result.assets).toEqual([]);
  });

  it("maps rich inline content and imports deduplicated images", async () => {
    const result = await composeAuthoringSpec({
      specVersion: 2,
      metadata: { title: "富文本" },
      sections: [{
        title: "示例",
        slides: [{
          title: "内容",
          blocks: [
            { type: "text", paragraphs: [[
              { text: "重点", bold: true, italic: true, color: "#63065F" },
              { text: "链接", href: "https://www.nju.edu.cn/" },
              { footnote: "来源" },
            ]] },
            { type: "image", file: "chart.png", alt: "图一" },
            { type: "image", file: "chart-copy.png", alt: "图二" },
          ],
        }],
      }],
    }, async () => png);

    const blocks = result.deck.sections[0].slides[0].blocks;
    expect(blocks[0]).toMatchObject({
      type: "text",
      content: { content: [{ content: [
        { text: "重点", marks: [{ type: "bold" }, { type: "italic" }, { type: "textStyle", attrs: { color: "#63065F" } }] },
        { text: "链接", marks: [{ type: "link", attrs: { href: "https://www.nju.edu.cn/" } }] },
        { type: "footnote", attrs: { text: "来源" } },
      ] }] },
    });
    expect(result.assets).toHaveLength(1);
    expect(blocks[1]).toMatchObject({ type: "image", source: result.assets[0].path, width: 0.8 });
    expect(blocks[2]).toMatchObject({ type: "image", source: result.assets[0].path, width: 0.8 });
  });

  it("rejects image bytes that do not match a supported format", async () => {
    await expect(composeAuthoringSpec({
      specVersion: 2,
      metadata: { title: "错误图片" },
      sections: [{ title: "示例", slides: [{ title: "内容", blocks: [{ type: "image", file: "fake.png" }] }] }],
    }, async () => new Uint8Array([1, 2, 3]))).rejects.toThrow("PNG 或 JPEG");
  });

  it("maps TeX customization settings into the canonical document", async () => {
    const result = await composeAuthoringSpec({
      specVersion: 2,
      metadata: { title: "定制" },
      settings: {
        mathFont: { preset: "times" },
        theme: { mode: "custom", name: "Madrid", colorTheme: "dolphin" },
        documentClassOptions: "aspectratio=169",
        preamble: "\\setbeamertemplate{navigation symbols}{}",
      },
      sections: [{ title: "示例", slides: [{ kind: "title" }] }],
    }, async () => { throw new Error("unexpected asset"); });

    expect(result.deck.settings).toMatchObject({
      mathFont: { preset: "times", customName: "" },
      theme: { mode: "custom", name: "Madrid", colorTheme: "dolphin" },
      documentClassOptions: "aspectratio=169",
      preamble: "\\setbeamertemplate{navigation symbols}{}",
    });
  });

  it("maps frame options, callouts and recursive columns", async () => {
    const result = await composeAuthoringSpec({
      specVersion: 2,
      metadata: { title: "结构化页面" },
      sections: [{ title: "示例", slides: [{
        title: "分栏",
        frame: { plain: true, label: "columns" },
        notes: "讲者备注",
        blocks: [{ type: "columns", columns: [
          { width: 0.48, blocks: [{ type: "callout", style: "theorem", title: "结论", content: "公式 $x$", appearance: "uncover" }] },
          { width: 0.48, blocks: [{ type: "list", items: ["一", "二"] }] },
        ] }],
      }] }],
    }, async () => { throw new Error("unexpected asset"); });

    const slide = result.deck.sections[0].slides[0];
    expect(slide).toMatchObject({ frame: { plain: true, allowFrameBreaks: false, shrink: false, label: "columns" }, notes: "讲者备注" });
    expect(slide.blocks[0]).toMatchObject({ type: "columns", columns: [
      { id: "block-1-1-1-column-1", blocks: [{ type: "callout", appearance: "uncover" }] },
      { id: "block-1-1-1-column-2", blocks: [{ type: "list" }] },
    ] });
  });
});
