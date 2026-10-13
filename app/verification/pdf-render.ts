import { createCanvas, DOMMatrix, ImageData, Path2D } from "@napi-rs/canvas";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

Object.assign(globalThis, { DOMMatrix, ImageData, Path2D });
const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
const input = resolve(process.argv[2]);
const output = resolve(process.argv[3]);
const task = pdfjs.getDocument({ data: new Uint8Array(await readFile(input)), cMapUrl: resolve("node_modules/pdfjs-dist/cmaps") + "/", cMapPacked: true, standardFontDataUrl: resolve("node_modules/pdfjs-dist/standard_fonts") + "/", useSystemFonts: true });
const document = await task.promise;
const page = await document.getPage(Number(process.argv[4] ?? 1));
const viewport = page.getViewport({ scale: process.argv[5] ? Number(process.argv[5]) / page.getViewport({ scale: 1 }).width : 2 });
const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
await page.render({ canvasContext: canvas.getContext("2d") as never, viewport, canvas: canvas as never }).promise;
await writeFile(output, canvas.toBuffer("image/png"));
await task.destroy();
