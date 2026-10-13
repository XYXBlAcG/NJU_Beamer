import { expect, it } from "vitest";
import { createDefaultPaper, paperSchema, serializePaper } from "./paper";
import { createId, richText } from "./deck";
import { newBlock } from "./blocks";

it("generates continuous NJU thesis chapters, not frames", () => {
  const paper = createDefaultPaper();
  paper.sections[0].blocks.push({ id: createId(), type: "text", content: richText("中文 \\(x^2\\)"), hidden: false, fontSize: "normal", appearance: "none" });
  const source = serializePaper(paper);
  expect(source).toContain("{njuthesis}");
  expect(source).toContain("\\chapter{引言}");
  expect(source).toContain("\\(x^2\\)");
  expect(source).not.toContain("\\begin{frame}");
});
it("rejects presentation effects in a paper", () => {
  const paper = createDefaultPaper();
  paper.sections[0].blocks[0].appearance = "only";
  expect(paperSchema.safeParse(paper).success).toBe(false);
});
it("reports duplicate citation keys", () => {
  const paper = createDefaultPaper();
  paper.bibliography = [{ key: "ref", type: "book", fields: {} }, { key: "ref", type: "book", fields: {} }];
  expect(paperSchema.safeParse(paper).success).toBe(false);
});

it("serializes page breaks, headers and author-year bibliography", () => {
  const paper = createDefaultPaper("master");
  paper.settings.header = "南京大学 · 研究";
  paper.settings.footer = "内部报告";
  paper.settings.bibliographyStyle = "author-year";
  paper.bibliography = [{ key: "ref", type: "book", fields: { title: "Book", year: "2026" } }];
  paper.sections[0].blocks[0].pageBreakBefore = true;
  const source = serializePaper(paper);
  expect(source).toContain("style=author-year");
  expect(source).toContain("\\fancyhead[C]{南京大学 · 研究}");
  expect(source).toContain("\\fancyfoot[C]{内部报告}");
  expect(source).toContain("\\clearpage");
});

it("rejects missing sections and references into hidden containers", () => {
  const paper = createDefaultPaper();
  expect(paperSchema.safeParse({ ...paper, sections: [] }).success).toBe(false);
  const columns = newBlock("columns");
  if (columns.type !== "columns") throw new Error("Unexpected block");
  columns.hidden = true;
  columns.columns[0].blocks[0].label = "hidden-target";
  paper.sections[0].blocks.push(columns, { ...newBlock("text"), type: "text", content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "reference", attrs: { key: "hidden-target" } }] }] } });
  expect(paperSchema.safeParse(paper).success).toBe(false);
});
