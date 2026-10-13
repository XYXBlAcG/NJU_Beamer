import { expect, it } from "vitest";
import { composeAuthoringSpec } from "./authoring";
import { decodeNjub, encodeNjub } from "./njub";
import { serializeDeck } from "./serialize";

it("keeps an editable ending in document order with an archive-owned block font", async () => {
  const document = await composeAuthoringSpec({ specVersion: 2, metadata: { title: "报告" }, sections: [{ title: "内容", slides: [
    { title: "正文", blocks: [{ type: "text", content: "正文" }] },
    { kind: "ending", title: "结束", blocks: [{ type: "text", content: "Thanks", font: { preset: "hei" } }] },
  ] }] }, async () => { throw new Error("No image expected"); });
  const restored = decodeNjub(encodeNjub(document.deck, document.assets));
  if (!("deck" in restored)) throw new Error("Expected presentation");
  expect(restored.deck.sections[0].slides[1].blocks[0].font).toMatchObject({ preset: "hei" });
  const source = serializeDeck(restored.deck);
  expect(source.indexOf("Thanks")).toBeGreaterThan(source.indexOf("\\frametitle{正文}"));
  expect(source).not.toContain("\\frametitle{结束}");
  expect(source).toMatch(/\\CJKfontspec\[[^\]]+\]\{FandolHei-Regular.otf\}/);
});

it("scopes fonts to individual blocks and preserves italic faces", async () => {
  const document = await composeAuthoringSpec({ specVersion: 2, metadata: { title: "字体" }, sections: [{ title: "内容", slides: [{ blocks: [
    { type: "text", content: "默认" },
    { type: "text", paragraphs: [[{ text: "宋体斜体", italic: true }]], font: { preset: "song" } },
    { type: "text", content: "Latin", font: { preset: "custom", customName: "TeX Gyre Termes" } },
  ] }] }] }, async () => { throw new Error("No image expected"); });
  const source = serializeDeck(document.deck);
  expect(source).toContain("ItalicFont=FandolSong-Regular.otf,ItalicFeatures={FakeSlant=0.2}");
  expect(source).toContain("\\fontspec{TeX Gyre Termes}");
  expect(source).not.toContain("ItalicFont=FandolKai-Regular.otf");
});
