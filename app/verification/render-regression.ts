import { createCanvas, DOMMatrix, ImageData, Path2D } from "@napi-rs/canvas";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createDefaultDeck, createId, defaultFrameOptions, richText, type Block } from "../src/domain/deck";
import { themes } from "../src/domain/presets";
import { serializeDeck } from "../src/domain/serialize";

Object.assign(globalThis, { DOMMatrix, ImageData, Path2D });
const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
const root = resolve("../.tmp/render-regression");
mkdirSync(root, { recursive: true });
const styles = ["block", "alert", "example", "theorem", "proof"] as const;
for (let offset = 0; offset < themes.length; offset += 4) {
  const montage = createCanvas(1200, 1150);
  const context = montage.getContext("2d");
  context.fillStyle = "#eee"; context.fillRect(0, 0, montage.width, montage.height);
  for (const [column, theme] of themes.slice(offset, offset + 4).entries()) {
    const deck = createDefaultDeck();
    deck.settings.theme = theme.theme;
    deck.settings.sectionTitleSlides = false;
    deck.sections[0].slides = styles.map((style) => ({ id: createId(), title: `${theme.name} / ${style}`, kind: "content", frame: { ...defaultFrameOptions }, notes: "", blocks: [{ id: createId(), type: "callout", hidden: false, appearance: "none", fontSize: "normal", style, title: "语义块", content: richText("普通中文与 \\(E=mc^2\\) 公式。") } as Block] }));
    const directory = `${root}/${theme.id}`;
    mkdirSync(directory, { recursive: true });
    writeFileSync(`${directory}/slide.tex`, serializeDeck(deck));
    execFileSync("/Library/TeX/texbin/latexmk", ["-xelatex", "-interaction=nonstopmode", "-halt-on-error", "slide.tex"], { cwd: directory, env: { ...process.env, PATH: `/Library/TeX/texbin:${process.env.PATH}`, TEXINPUTS: `${resolve("../templates/nju")}//:` }, stdio: "ignore" });
    const task = pdfjs.getDocument({ data: new Uint8Array(readFileSync(`${directory}/slide.pdf`)), cMapUrl: resolve("node_modules/pdfjs-dist/cmaps") + "/", cMapPacked: true });
    const document = await task.promise;
    if (document.numPages !== styles.length) throw new Error(`页数不符：${theme.id}`);
    for (let row = 0; row < styles.length; row++) {
      const page = await document.getPage(row + 1);
      const viewport = page.getViewport({ scale: 300 / page.getViewport({ scale: 1 }).width });
      const canvas = createCanvas(300, Math.ceil(viewport.height));
      await page.render({ canvas: canvas as never, canvasContext: canvas.getContext("2d") as never, viewport }).promise;
      const pixels = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
      for (let y = Math.floor(canvas.height * 0.28); y < canvas.height * 0.75; y++) {
        let run = 0;
        for (let x = 0; x < canvas.width; x++) {
          const i = (y * canvas.width + x) * 4;
          run = pixels[i] < 12 && pixels[i + 1] < 12 && pixels[i + 2] < 12 ? run + 1 : 0;
          if (run > canvas.width * 0.65) throw new Error(`黑条回归：${theme.id}/${styles[row]}`);
        }
      }
      context.drawImage(canvas, column * 300, row * 230);
      page.cleanup();
    }
    await task.destroy();
    process.stdout.write(`${theme.id}: 5 semantic blocks verified\n`);
  }
  writeFileSync(`${root}/matrix-${offset / 4 + 1}.png`, montage.toBuffer("image/png"));
}
const fonts = createDefaultDeck();
fonts.settings.theme.mode = "default";
fonts.settings.sectionTitleSlides = false;
fonts.sections[0].slides = [{ id: createId(), title: "宋体字形", kind: "content", frame: { ...defaultFrameOptions }, notes: "", blocks: [{ id: createId(), type: "text", hidden: false, appearance: "none", fontSize: "normal", content: { type: "doc", content: [[], [{ type: "bold" }], [{ type: "italic" }], [{ type: "bold" }, { type: "italic" }]].map((marks) => ({ type: "paragraph", content: [{ type: "text", text: "宋体字形：学术研究 ABC xyz", marks }] })) } }] }];
writeFileSync(`${root}/fonts.tex`, serializeDeck(fonts));
execFileSync("/Library/TeX/texbin/latexmk", ["-xelatex", "-interaction=nonstopmode", "-halt-on-error", "fonts.tex"], { cwd: root, env: { ...process.env, PATH: `/Library/TeX/texbin:${process.env.PATH}` }, stdio: "ignore" });
execFileSync("sips", ["-s", "format", "png", `${root}/fonts.pdf`, "--out", `${root}/fonts.png`], { stdio: "ignore" });
const fontTask = pdfjs.getDocument({ data: new Uint8Array(readFileSync(`${root}/fonts.pdf`)), cMapUrl: resolve("node_modules/pdfjs-dist/cmaps") + "/", cMapPacked: true });
const fontDocument = await fontTask.promise;
const fontPage = await fontDocument.getPage(1);
const fontViewport = fontPage.getViewport({ scale: 1 });
const fontCanvas = createCanvas(Math.ceil(fontViewport.width), Math.ceil(fontViewport.height));
await fontPage.render({ canvas: fontCanvas as never, canvasContext: fontCanvas.getContext("2d") as never, viewport: fontViewport }).promise;
const operators = await fontPage.getOperatorList();
const names = operators.fnArray.flatMap((operator, index) => operator === pdfjs.OPS.setFont ? [fontPage.commonObjs.get(operators.argsArray[index][0]).name as string] : []);
if (names.some((name) => name.includes("FandolKai")) || !names.some((name) => name.includes("FandolSong"))) throw new Error("宋体字形不正确");
await fontTask.destroy();
process.stdout.write("Song regular/bold/italic/bold-italic compiled\n");
