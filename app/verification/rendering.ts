import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createDefaultDeck, createId, defaultFrameOptions, richText, type Block } from "../src/domain/deck";
import { serializeDeck } from "../src/domain/serialize";

const root = resolve("../.tmp/rendering");
mkdirSync(root, { recursive: true });
const deck = createDefaultDeck();
deck.settings.theme = { ...deck.settings.theme, mode: "custom", name: "Boadilla" };
deck.sections[0].slides = ["block", "alert", "example", "theorem", "proof"].map((style) => ({ id: createId(), title: style, kind: "content", frame: { ...defaultFrameOptions }, notes: "", blocks: [{ id: createId(), type: "callout", hidden: false, appearance: "none", fontSize: "normal", style, title: "语义块", content: richText("普通中文与 \\(E=mc^2\\) 公式。") } as Block] }));
writeFileSync(`${root}/boadilla.tex`, serializeDeck(deck));
execFileSync("/Library/TeX/texbin/latexmk", ["-xelatex", "-interaction=nonstopmode", "-halt-on-error", "boadilla.tex"], { cwd: root, env: { ...process.env, PATH: `/Library/TeX/texbin:${process.env.PATH}` }, stdio: "ignore" });
execFileSync("pdftoppm", ["-f", "1", "-singlefile", "-scale-to", "1000", "-png", `${root}/boadilla.pdf`, `${root}/boadilla-poppler`]);
process.stdout.write(`${root}/boadilla.pdf\n`);
