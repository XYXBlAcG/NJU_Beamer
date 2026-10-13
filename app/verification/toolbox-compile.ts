import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { decodeExtension } from "../src/domain/extensions";
import { presetPreviewDocument, type PresetEntry } from "../src/domain/presetPreview";
import { serializeDeck } from "../src/domain/serialize";
import { encodeNjub, decodeNjub } from "../src/domain/njub";

const extension = decodeExtension(new Uint8Array(readFileSync("../examples/math-research-toolbox.njup")));
const root = resolve("../.tmp/toolbox");
const entries: PresetEntry[] = (["themes", "templates", "tikz"] as const).flatMap((kind) => extension[kind].map((item) => ({ key: `${extension.id}/${kind}/${item.id}`, kind, item })));
for (const entry of entries) {
  const document = presetPreviewDocument(entry);
  const reopened = decodeNjub(encodeNjub(document.deck, document.assets));
  if (!("deck" in reopened)) throw new Error("插件文稿类型错误");
  const directory = resolve(root, `${entry.kind}-${entry.item.id}`);
  mkdirSync(directory, { recursive: true });
  for (const asset of reopened.assets) { mkdirSync(resolve(directory, "pic"), { recursive: true }); writeFileSync(resolve(directory, asset.path), Uint8Array.from(asset.content)); }
  writeFileSync(resolve(directory, "slide.tex"), serializeDeck(reopened.deck));
  execFileSync("/Library/TeX/texbin/latexmk", ["-xelatex", "-interaction=nonstopmode", "-halt-on-error", "-latexoption=-no-shell-escape", "slide.tex"], { cwd: directory, env: { ...process.env, PATH: `/Library/TeX/texbin:${process.env.PATH}`, TEXINPUTS: `${resolve("../templates/nju")}//:` }, stdio: "ignore" });
  process.stdout.write(`${entry.key} compiled after archive roundtrip\n`);
}
