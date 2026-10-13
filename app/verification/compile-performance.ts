import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { decodeNjub, encodeNjub } from "../src/domain/njub";
import { serializeDeck } from "../src/domain/serialize";
import { kuangTheme } from "../src/domain/kuangTemplate";
import { createDefaultDeck, createId, defaultFrameOptions, richText } from "../src/domain/deck";
import { fontSizeSchema } from "../src/domain/typography";

const root = resolve("../.tmp/compile-performance");
mkdirSync(root, { recursive: true });
const document = decodeNjub(readFileSync(resolve("../examples/stl-sequence-containers-code.njub")));
if (!("deck" in document)) throw new Error("Expected presentation");
document.deck.settings.theme = kuangTheme.theme;
document.deck.settings.themeFiles = kuangTheme.files;
writeFileSync(resolve("../examples/stl-kuang-yaming.njub"), encodeNjub(document.deck, document.assets));
writeFileSync(`${root}/after.tex`, serializeDeck(document.deck));
writeFileSync(`${root}/assets.json`, JSON.stringify(document.assets));
const baseline = process.argv[2];
if (baseline) {
  const old = structuredClone(document.deck);
  old.settings.themeFiles = old.settings.themeFiles.map(file => file.path.endsWith(".sty") ? { ...file, content: readFileSync(resolve(baseline), "utf8") } : file);
  writeFileSync(`${root}/before.tex`, serializeDeck(old));
}
const sizes = createDefaultDeck();
sizes.settings.pageSize = { preset: "16:9", widthMm: 160, heightMm: 90 };
sizes.sections[0].slides = fontSizeSchema.options.map(fontSize => ({ id: createId(), kind: "content", title: fontSize, frame: { ...defaultFrameOptions }, notes: "", blocks: [{ id: createId(), type: "text", hidden: false, appearance: "none", fontSize, content: richText("中文 ABC 123") }] }));
writeFileSync(`${root}/sizes.njub`, encodeNjub(sizes, []));
