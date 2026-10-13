import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderTikz } from "../src/domain/extensions";
import { tikzPresets } from "../src/domain/presets";

const preset = tikzPresets.find((item) => item.id === "commutative")!;
const root = resolve("../.tmp/diagram");
mkdirSync(root, { recursive: true });
mkdirSync(resolve("../examples/assets"), { recursive: true });
writeFileSync(`${root}/diagram.tex`, `\\documentclass[tikz,border=8pt]{standalone}\n\\usetikzlibrary{${preset.libraries.join(",")}}\n\\begin{document}\n\\begin{tikzpicture}\n${renderTikz(preset, {})}\n\\end{tikzpicture}\n\\end{document}\n`);
execFileSync("/Library/TeX/texbin/latexmk", ["-xelatex", "-interaction=nonstopmode", "-halt-on-error", "diagram.tex"], { cwd: root, env: { ...process.env, PATH: `/Library/TeX/texbin:${process.env.PATH}` }, stdio: "ignore" });
execFileSync(process.execPath, ["--import", "tsx", "verification/pdf-render.ts", `${root}/diagram.pdf`, resolve("../examples/assets/commutative.png"), "1", "1000"], { stdio: "inherit" });
