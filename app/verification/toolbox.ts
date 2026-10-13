import { readFileSync, writeFileSync } from "node:fs";
import { createDefaultDeck, createId, defaultFrameOptions, richText } from "../src/domain/deck";
import { encodeExtension, extensionSchema } from "../src/domain/extensions";
import { defaultTheme } from "../src/domain/deck";
import { tikzPresets } from "../src/domain/presets";

const deck = createDefaultDeck();
deck.metadata = { ...deck.metadata, title: "数学研究工具箱", subtitle: "猜想 · 证明 · 可视化" };
deck.settings.pageSize = { preset: "16:9", widthMm: 160, heightMm: 90 };
deck.settings.theme = { ...defaultTheme, mode: "custom", name: "Madrid" };
deck.settings.themePreamble = "\\definecolor{ResearchPurple}{HTML}{63065F}\n\\setbeamercolor{structure}{fg=ResearchPurple}";
const bytes = readFileSync("../examples/assets/commutative.png");
deck.sections[0].slides = [deck.sections[0].slides[0], { id: createId(), title: "从图形到证明", kind: "content", frame: { ...defaultFrameOptions }, notes: "这张图片随文稿保存，卸载扩展不会影响它。", blocks: [{ id: createId(), type: "image", source: "pic/commutative.png", width: 0.55, alt: "交换图", hidden: false, fontSize: "normal", appearance: "none" }, { id: createId(), type: "callout", style: "theorem", title: "研究命题", content: richText("在此陈述假设与结论。"), hidden: false, fontSize: "normal", appearance: "uncover" }] }];
const extension = extensionSchema.parse({
  apiVersion: 1, id: "math-research-toolbox", name: "数学研究工具箱", version: "1.0.0", author: "NJU Beamer 示例",
  themes: [{ id: "purple", name: "研究紫", category: "学术", tags: ["数学", "研究"], theme: deck.settings.theme, preamble: deck.settings.themePreamble, files: [] }],
  templates: [{ id: "research", name: "猜想与证明", category: "数学研究", tags: ["图片", "证明"], deck, assets: [{ path: "pic/commutative.png", mimeType: "image/png", content: Array.from(bytes) }] }],
  tikz: tikzPresets.filter((item) => ["commutative", "binary", "flow-4", "cycle-5"].includes(item.id)),
  formulas: [{ id: "double-count", name: "双重计数", category: "组合数学", tags: ["求和"], latex: "\\sum_{x\\in X}\\deg(x)=\\sum_{y\\in Y}\\deg(y)", preview: "\\sum_{x\\in X}\\deg(x)=\\sum_{y\\in Y}\\deg(y)" }, { id: "cayley", name: "凯莱公式", category: "组合数学", tags: ["树"], latex: "T_n=n^{n-2}", preview: "T_n=n^{n-2}" }, { id: "induction", name: "归纳假设", category: "证明结构", tags: ["归纳"], latex: "P(k)\\Longrightarrow P(k+1)", preview: "P(k)\\Longrightarrow P(k+1)" }],
});
writeFileSync("../examples/math-research-toolbox.njup", encodeExtension(extension));
