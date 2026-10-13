import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { createDefaultPaper, serializePaper } from "../src/domain/paper";
import { encodeNjub } from "../src/domain/njub";
import { richText } from "../src/domain/deck";
import type { DocumentAsset } from "../src/domain/document";

const root = resolve("../.tmp/papers");
mkdirSync(root, { recursive: true });
for (const template of ["bachelor", "master", "doctor", "report"] as const) {
  const paper = createDefaultPaper(template);
  paper.metadata = { ...paper.metadata, title: "南京大学论文排版示例", englishTitle: "Nanjing University Thesis Example", author: "张同学", department: "数学学院", major: "数学", supervisor: "李教授,教授", studentId: "20260001" };
  if (template === "report") { paper.settings.header = "南京大学 · 课程研究"; paper.settings.footer = "学术报告"; }
  if (template === "master") paper.settings.bibliographyStyle = "author-year";
  paper.bibliography = [{ key: "cayley1889", type: "article", fields: { author: "Arthur Cayley", title: "A theorem on trees", year: "1889", journal: "Quarterly Journal of Mathematics" } }];
  paper.sections[0].blocks.push({ id: "reference-text", type: "text", hidden: false, appearance: "none", fontSize: "normal", content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "树的计数参见 " }, { type: "citation", attrs: { key: "cayley1889" } }] }] } });
  paper.sections[0].blocks.push({ id: "figure", type: "image", source: "pic/commutative.png", width: 0.65, alt: "交换图", caption: "交换图示例", label: "fig:diagram", hidden: false, appearance: "none", fontSize: "normal" });
  paper.sections[0].blocks.push({ id: "equation", type: "formula", latex: "T_n=n^{n-2}", numbered: true, layout: "single", label: "eq:cayley", hidden: false, appearance: "none", fontSize: "normal" });
  paper.sections[0].blocks.push({ id: "table", type: "table", columns: ["顶点数", "树的数量"], rows: [["3", "3"], ["4", "16"]], header: true, caption: "计数结果", label: "tab:counts", hidden: false, appearance: "none", fontSize: "normal" });
  paper.sections[0].blocks.push({ id: "references", type: "text", hidden: false, appearance: "none", fontSize: "normal", content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "参见图 " }, { type: "reference", attrs: { key: "fig:diagram" } }, { type: "text", text: " 及公式 " }, { type: "reference", attrs: { key: "eq:cayley" } }, { type: "footnote", attrs: { text: "图片随 NJUB 文稿存储。" } }] }] } });
  paper.sections.push({ id: "appendix", title: "补充材料", level: "appendix", label: "app:supplement", blocks: [{ id: "proof", type: "callout", style: "proof", title: "", content: richText("这里填写证明的补充细节。"), hidden: false, appearance: "none", fontSize: "normal" }] });
  paper.sections.push({ id: "acknowledgement", title: "致谢", level: "acknowledgement", label: "", blocks: [{ id: "thanks", type: "text", content: richText("感谢 NJUThesis、TikZ Editor 与开源社区。"), hidden: false, appearance: "none", fontSize: "normal" }] });
  const assets: DocumentAsset[] = [{ path: "pic/commutative.png", mimeType: "image/png", content: Array.from(readFileSync("../examples/assets/commutative.png")) }];
  paper.sections[0].blocks[0] = { ...paper.sections[0].blocks[0], type: "text", content: richText("这是中文正文。内嵌公式 \\(E=mc^2\\) 支持连续排版。") };
  const directory = `${root}/${template}`;
  mkdirSync(directory, { recursive: true });
  writeFileSync(`${directory}/paper.tex`, serializePaper(paper));
  mkdirSync(`${directory}/pic`, { recursive: true });
  writeFileSync(`${directory}/pic/commutative.png`, Uint8Array.from(assets[0].content));
  writeFileSync(resolve(`../examples/nju-${template}.njub`), encodeNjub(paper, assets));
  execFileSync("/Library/TeX/texbin/latexmk", ["-xelatex", "-interaction=nonstopmode", "-halt-on-error", "-latexoption=-no-shell-escape", "paper.tex"], { cwd: directory, env: { ...process.env, PATH: `/Library/TeX/texbin:${process.env.PATH}`, TEXINPUTS: `${resolve("../templates/nju")}//:` }, stdio: "ignore" });
  process.stdout.write(`${template} compiled\n`);
  execFileSync(process.execPath, ["--import", "tsx", "verification/pdf-render.ts", `${directory}/paper.pdf`, resolve(`public/presets/paper-${template}.png`)], { stdio: "ignore" });
}
