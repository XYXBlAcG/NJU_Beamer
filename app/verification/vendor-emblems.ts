import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const directory = dirname(execFileSync("/Library/TeX/texbin/kpsewhich", ["njuvisual.sty"], { encoding: "utf8" }).trim());
if (!readFileSync(resolve(directory, "njuvisual.sty"), "utf8").includes("njuvisual.dtx 0.3.0 ")) throw new Error("Expected NJUVisual 0.3.0");
const emblems = Object.fromEntries(["nju", "dii"].map(department => {
  const source = readFileSync(resolve(directory, `njuvisual-emblem-${department}.def`), "utf8");
  return [department, { source, sha256: createHash("sha256").update(source).digest("hex") }];
}));
mkdirSync(resolve("src/domain/vendor"), { recursive: true });
writeFileSync(resolve("src/domain/vendor/nju-emblems.json"), JSON.stringify({ source: "https://ctan.org/pkg/njuvisual", version: "0.3.0", license: "LPPL-1.3c", emblems }, null, 2) + "\n");
cpSync(resolve(directory, "../../../doc/latex/njuvisual/LICENSE"), resolve("src/domain/vendor/NJUVisual.LICENSE"));
