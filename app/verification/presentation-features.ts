import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { composeAuthoringSpec } from "../src/domain/authoring";
import { encodeNjub } from "../src/domain/njub";
import { instantiateTemplate } from "../src/domain/extensions";
import { kuangTemplate } from "../src/domain/kuangTemplate";
import { bodyFontSchema } from "../src/domain/deck";
import { DOMMatrix, ImageData, Path2D } from "@napi-rs/canvas";

const template = instantiateTemplate(kuangTemplate);
writeFileSync(resolve("../examples/kuang-yaming.njub"), encodeNjub(template.deck, template.assets));
const document = await composeAuthoringSpec({ specVersion: 2, metadata: { title: "块级字体" }, settings: { theme: template.deck.settings.theme, themeFiles: template.deck.settings.themeFiles }, sections: [{ title: "字体", slides: [
  { kind: "title" },
  ...bodyFontSchema.options.map(preset => ({ title: preset, blocks: [{ type: "text" as const, paragraphs: [[{ text: "字体示例 " }, { text: "中文粗体", bold: true }, { text: " 中文斜体", italic: true }]], font: { preset } }] })),
  { title: "自定义字体", blocks: [{ type: "text", content: "Custom Latin font", font: { preset: "custom", customName: "texgyretermes-regular.otf", cjkName: "FandolSong-Regular.otf" } }] },
  { kind: "ending", blocks: [{ type: "text", content: "Thanks", font: { preset: "hei" } }] },
] }] }, async () => { throw new Error("No image expected"); });
const root = resolve("../.tmp/features");
mkdirSync(root, { recursive: true });
const fontPath = resolve(root, "block-fonts.njub");
writeFileSync(fontPath, encodeNjub(document.deck, document.assets));
for (const path of [resolve("../examples/kuang-yaming.njub"), fontPath]) execFileSync(process.execPath, ["--import", "tsx", "verification/document.ts", path], { stdio: "inherit" });
for (const name of ["kuang-yaming", "block-fonts"]) {
  const log = readFileSync(resolve("../.tmp/documents", name, "document.log"), "utf8");
  if (/Overfull|Missing character|^!/m.test(log)) throw new Error(`Rendering diagnostics in ${name}`);
}
Object.assign(globalThis, { DOMMatrix, ImageData, Path2D });
const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
for (const [name, expected] of [["kuang-yaming", 3], ["block-fonts", 7]] as const) {
  const task = pdfjs.getDocument({ data: new Uint8Array(readFileSync(resolve("../.tmp/documents", name, "document.pdf"))) });
  const pdf = await task.promise;
  if (pdf.numPages !== expected) throw new Error(`${name}: expected ${expected} pages, got ${pdf.numPages}`);
  await task.destroy();
}
