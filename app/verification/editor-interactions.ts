import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { decodeNjub, encodeNjub } from "../src/domain/njub";
import { archiveContent } from "../src/domain/document";
import { copyPages, documentPages, pastePages } from "../src/domain/pages";
import { serializeDeck } from "../src/domain/serialize";
import { serializePaper } from "../src/domain/paper";

for (const name of ["nju-demo", "nju-bachelor", "nju-master", "nju-doctor", "nju-report"]) {
  const archive = decodeNjub(new Uint8Array(readFileSync(resolve(`../examples/${name}.njub`))));
  const source = archiveContent(archive);
  const page = documentPages(source).find((item) => item.blocks.some((block) => block.type === "image")) ?? documentPages(source)[0];
  const result = pastePages(source, archive.assets, copyPages(source, archive.assets, [page.id]), page.id);
  const roundTrip = decodeNjub(encodeNjub(result.content, result.assets));
  const content = archiveContent(roundTrip);
  const root = resolve("../.tmp/editor-interactions", name);
  mkdirSync(root, { recursive: true });
  for (const asset of roundTrip.assets) {
    const path = resolve(root, asset.path); mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, Uint8Array.from(asset.content));
  }
  writeFileSync(`${root}/document.tex`, "kind" in content ? serializePaper(content) : serializeDeck(content));
  execFileSync("/Library/TeX/texbin/latexmk", ["-g", "-xelatex", "-interaction=nonstopmode", "-halt-on-error", "-latexoption=-no-shell-escape", "document.tex"], { cwd: root, env: { ...process.env, PATH: `/Library/TeX/texbin:${process.env.PATH}`, TEXINPUTS: `${resolve("../templates/nju")}//:` }, stdio: "ignore" });
  process.stdout.write(`${name}: archive round-trip and duplicated pages compiled\n`);
}
