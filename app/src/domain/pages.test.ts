import { describe, expect, it } from "vitest";
import { createDefaultDeck, richText } from "./deck";
import { createDefaultPaper, paperSchema } from "./paper";
import { copyPages, pastePages, movePages, deletePages } from "./pages";
import { serializeDeck } from "./serialize";

describe("document page operations", () => {
  it("duplicates a chapter while remapping labels, references and IDs", () => {
    const paper = createDefaultPaper();
    paper.sections[0].blocks[0] = { ...paper.sections[0].blocks[0], type: "text", content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "reference", attrs: { key: "ch:introduction" } }] }] } };
    const result = pastePages(paper, [], copyPages(paper, [], [paper.sections[0].id]), paper.sections[0].id);
    expect(result.content.sections).toHaveLength(2);
    expect(paperSchema.safeParse(result.content).success).toBe(true);
    if (!("kind" in result.content)) throw new Error("Expected paper");
    const copy = result.content.sections[1];
    expect(copy.label).not.toBe("ch:introduction");
    const block = copy.blocks[0];
    expect(block.id).not.toBe(paper.sections[0].blocks[0].id);
    expect(block.type === "text" && block.content.content?.[0].content?.[0].attrs?.key).toBe(copy.label);
  });
  it("moves pages across sections and refuses deletion of every page", () => {
    const deck = createDefaultDeck();
    const first = deck.sections[0].slides[0];
    const second = deck.sections[0].slides[1];
    deck.sections.push({ id: "target", title: "Target", slides: [] });
    const moved = movePages(deck, [first.id], undefined, "target");
    expect("kind" in moved ? [] : moved.sections[1].slides.map((page) => page.id)).toEqual([first.id]);
    expect(deletePages(deck, [first.id, second.id])).toBe(deck);
  });
  it("carries image bytes and renames colliding assets", () => {
    const source = createDefaultDeck();
    source.sections[0].slides[1].blocks = [{ id: "image", type: "image", hidden: false, fontSize: "normal", appearance: "none", source: "pic/test.png", width: 0.8, alt: "test" }];
    const asset = { path: "pic/test.png", mimeType: "image/png" as const, content: [137, 80, 78, 71, 13, 10, 26, 10] };
    const target = createDefaultDeck();
    const result = pastePages(target, [{ ...asset, content: [...asset.content, 1] }], copyPages(source, [asset], [source.sections[0].slides[1].id]), target.sections[0].slides[0].id);
    expect(result.assets).toHaveLength(2);
    if ("kind" in result.content) throw new Error("Expected slides");
    const block = result.content.sections[0].slides[1].blocks[0];
    expect(block.type === "image" && block.source).toBe(result.assets[1].path);
  });
  it("omits skipped slides and their generated chapter page", () => {
    const deck = createDefaultDeck();
    deck.settings.sectionTitleSlides = true;
    deck.sections[0].title = "Skipped section";
    deck.sections[0].slides.forEach((page) => { page.hidden = true; });
    expect(serializeDeck(deck).split("\\begin{document}")[1]).not.toContain("\\begin{frame}");
    expect(serializeDeck(deck)).not.toContain("Skipped section");
  });
  it("imports bibliography dependencies without conflicting keys", () => {
    const source = createDefaultPaper();
    source.bibliography = [{ key: "book", type: "book", fields: { title: "Source" } }];
    source.sections[0].blocks[0] = { ...source.sections[0].blocks[0], type: "text", content: { ...richText(""), content: [{ type: "citation", attrs: { key: "book" } }] } };
    const target = createDefaultPaper();
    target.bibliography = [{ key: "book", type: "book", fields: { title: "Target" } }];
    const result = pastePages(target, [], copyPages(source, [], [source.sections[0].id]), target.sections[0].id);
    expect(paperSchema.safeParse(result.content).success).toBe(true);
    expect("kind" in result.content && result.content.bibliography).toHaveLength(2);
  });
  it("preserves custom TeX resources and refuses conflicting definitions", () => {
    const source = createDefaultDeck();
    source.settings.preamble = "\\newcommand{\\custom}{test}";
    source.settings.themeFiles = [{ path: "theme/custom.sty", content: "\\ProvidesPackage{custom}" }];
    const target = createDefaultDeck();
    const clipboard = copyPages(source, [], [source.sections[0].slides[1].id]);
    const result = pastePages(target, [], clipboard);
    expect(result.content.settings.preamble).toBe(source.settings.preamble);
    expect(!("kind" in result.content) && result.content.settings.themeFiles).toEqual(source.settings.themeFiles);
    target.settings.preamble = "\\newcommand{\\custom}{different}";
    expect(() => pastePages(target, [], clipboard)).toThrow("TeX 头");
  });
});
