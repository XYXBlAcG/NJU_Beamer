import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { decodeNjub } from "../src/domain/njub";
import { serializeDeck } from "../src/domain/serialize";
import { serializePaper } from "../src/domain/paper";

const input = resolve(process.argv[2]);
const document = decodeNjub(new Uint8Array(readFileSync(input)));
const root = resolve("../.tmp/documents", basename(input, ".njub"));
mkdirSync(root, { recursive: true });
for (const asset of document.assets) {
  const path = resolve(root, asset.path);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, Uint8Array.from(asset.content));
}
writeFileSync(`${root}/document.tex`, "paper" in document ? serializePaper(document.paper) : serializeDeck(document.deck));
execFileSync("/Library/TeX/texbin/latexmk", ["-xelatex", "-interaction=nonstopmode", "-halt-on-error", "-latexoption=-no-shell-escape", "document.tex"], { cwd: root, env: { ...process.env, PATH: `/Library/TeX/texbin:${process.env.PATH}`, TEXINPUTS: `${resolve("../templates/nju")}//:` }, stdio: "ignore" });
process.stdout.write(`${input} compiled\n`);
