import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { presetPreviewDocument, type PresetEntry } from "../src/domain/presetPreview";
import { serializeDeck } from "../src/domain/serialize";

export async function generatePresetThumbnail(entry: PresetEntry) {
  const root = resolve("../.tmp/preset-thumbnails", entry.kind, entry.item.id);
  mkdirSync(root, { recursive: true });
  const document = presetPreviewDocument(entry);
  for (const asset of document.assets) {
    const path = resolve(root, asset.path);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, Uint8Array.from(asset.content));
  }
  writeFileSync(`${root}/preview.tex`, serializeDeck(document.deck));
  execFileSync("/Library/TeX/texbin/latexmk", ["-xelatex", "-interaction=nonstopmode", "-halt-on-error", "-latexoption=-no-shell-escape", "preview.tex"], { cwd: root, env: { ...process.env, PATH: `/Library/TeX/texbin:${process.env.PATH}`, TEXINPUTS: `${resolve("../templates/nju")}//:` }, stdio: "ignore" });
  execFileSync("/usr/bin/sips", ["-s", "format", "png", `${root}/preview.pdf`, "--out", `${root}/preview.png`], { stdio: "ignore" });
  const image = await loadImage(`${root}/preview.png`);
  const canvas = createCanvas(480, Math.round(480 * image.height / image.width));
  const context = canvas.getContext("2d");
  context.fillStyle = "white"; context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  mkdirSync(resolve("public/presets"), { recursive: true });
  writeFileSync(resolve("public/presets", `${entry.kind}-${entry.item.id}.png`), canvas.toBuffer("image/png"));
  process.stdout.write(`${entry.item.name} compiled and rendered\n`);
}
