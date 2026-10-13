import { createDefaultDeck, createId, defaultFrameOptions, defaultTheme, richText, type Block } from "./deck";
import { extensionSchema, type FormulaPreset, type TemplatePreset, type ThemePreset, type TikzPreset } from "./extensions";
import { kuangTemplate, kuangTheme } from "./kuangTemplate";

const base = { hidden: false, fontSize: "normal" as const, appearance: "none" as const };
const text = (value: string): Block => ({ ...base, id: createId(), type: "text", content: richText(value) });
const list = (items: string[]): Block => ({ ...base, id: createId(), type: "list", ordered: false, reveal: "none", items });
const formula = (latex: string): Block => ({ ...base, id: createId(), type: "formula", latex, numbered: false, layout: "single" });
const callout = (title: string, value: string): Block => ({ ...base, id: createId(), type: "callout", style: "block", title, content: richText(value) });

export const themes: ThemePreset[] = ["NJU", "Madrid", "Boadilla", "CambridgeUS", "AnnArbor", "Berlin", "Darmstadt", "Frankfurt", "Ilmenau", "Singapore", "Warsaw", "Rochester", "Pittsburgh", "Montpellier", "Malmoe", "Bergen"].map((name) => ({
  id: name.toLowerCase(), name: name === "NJU" ? "南京大学" : name, category: name === "NJU" ? "学术" : "Beamer", tags: [name],
  theme: name === "NJU" ? { ...defaultTheme } : { ...defaultTheme, mode: "custom", name }, preamble: "", files: [],
}));

const recipes: Array<{ id: string; name: string; titles: string[]; blocks: Block[][] }> = [
  { id: "lecture", name: "课程讲义", titles: ["学习目标", "核心概念", "例题与练习"], blocks: [list(["理解基本概念", "掌握推导方法", "应用于实际问题"])].map((block) => [block]).concat([[callout("定义", "在此介绍核心概念。")], [formula("a^2+b^2=c^2"), text("请解释公式，并给出一个应用。")]]) },
  { id: "research", name: "学术报告", titles: ["研究问题", "方法", "结果", "结论"], blocks: [[text("介绍问题背景、相关工作和研究动机。")], [list(["建模假设", "算法设计", "实验设置"])], [{ ...base, id: createId(), type: "table", columns: ["方法", "准确率"], rows: [["基线", "90%"], ["本文", "95%"]], header: true }], [callout("结论", "总结贡献与下一步工作。")]] },
  { id: "defense", name: "毕业答辩", titles: ["研究背景", "研究内容", "创新点", "展望"], blocks: [[text("介绍选题意义。")], [list(["理论分析", "系统实现", "实验验证"])], [callout("创新点", "说明与已有工作的区别。")], [text("未来研究方向。")]] },
  { id: "proof", name: "数学证明", titles: ["命题", "证明思路", "推导", "结论"], blocks: [[callout("定理", "对于标号树，数量为 \\(n^{n-2}\\)。")], [list(["选择计数对象", "从两个角度计数", "比较所得表达式"])], [formula("n^{n-2}=\\frac{n^{n-1}}{n}")], [text("讨论边界条件与应用。")]] },
  { id: "project", name: "项目汇报", titles: ["目标与范围", "计划", "当前进展", "风险"], blocks: [[list(["目标", "交付物", "时间安排"])], [text("里程碑与责任分工。")], [callout("进展", "记录已完成事项。")], [text("风险与应对措施。")]] },
  { id: "workshop", name: "技术工作坊", titles: ["准备", "操作演示", "动手实践", "总结"], blocks: [[list(["环境准备", "数据准备"])], [{ ...base, id: createId(), type: "code", language: "Python", content: "def square(x):\n    return x * x\n\nprint(square(3))" }], [text("完成练习并分享结果。")], [callout("要点", "总结关键操作。")]] },
  { id: "minimal", name: "极简演示", titles: ["一个观点", "三个理由", "下一步"], blocks: [[text("用一句话表达核心观点。")], [list(["理由一", "理由二", "理由三"])], [text("明确下一步行动。")]] },
  { id: "comparison", name: "双栏比较", titles: ["方案比较", "决策"], blocks: [[{ ...base, id: createId(), type: "columns", alignment: "top", columns: [{ id: createId(), width: 0.48, blocks: [callout("方案 A", "优点与限制。")] }, { id: createId(), width: 0.48, blocks: [callout("方案 B", "优点与限制。")] }] }], [callout("建议", "根据比较结果选择方案。")]] },
  { id: "poster", name: "宽屏简报", titles: ["概览", "数据与发现"], blocks: [[list(["背景", "发现", "建议"])], [formula("P(A\\mid B)=\\frac{P(B\\mid A)P(A)}{P(B)}")]] },
];
export const templates: TemplatePreset[] = recipes.map((recipe, index) => {
  const deck = createDefaultDeck();
  deck.metadata.title = recipe.name;
  deck.metadata.subtitle = "";
  deck.settings.pageSize = { preset: "16:9", widthMm: 160, heightMm: 90 };
  if (index === 6) deck.settings.theme = { ...defaultTheme, mode: "default" };
  deck.sections[0].title = recipe.name;
  deck.sections[0].slides = [deck.sections[0].slides[0], ...recipe.titles.map((title, slideIndex) => ({ id: createId(), title, kind: "content" as const, frame: { ...defaultFrameOptions }, notes: "", blocks: recipe.blocks[slideIndex] }))];
  return { id: recipe.id, name: recipe.name, category: "文稿", tags: recipe.titles, deck, assets: [] };
});

const parameter = { key: "color", name: "颜色", kind: "color" as const, value: "blue!65" };
const diagram = (id: string, name: string, category: string, source: string, libraries: string[] = []): TikzPreset => ({ id, name, category, tags: [category], source, libraries, parameters: [parameter, { key: "label", name: "标签", kind: "text" as const, value: "A" }, { key: "scale", name: "缩放", kind: "number" as const, value: "1" }].filter((item) => source.includes(`{{${item.key}}}`)) });
export const tikzPresets: TikzPreset[] = [];
for (let n = 3; n <= 10; n++) {
  const nodes = Array.from({ length: n }, (_, i) => `\\node[circle,draw={{color}},inner sep=2pt] (v${i}) at (${360 * i / n}:1.5) {${i + 1}};`).join("\n");
  const cycle = Array.from({ length: n }, (_, i) => `\\draw[{{color}}] (v${i}) -- (v${(i + 1) % n});`).join("\n");
  const complete = Array.from({ length: n }, (_, i) => Array.from({ length: i }, (_, j) => `\\draw[{{color}},opacity=.5] (v${i}) -- (v${j});`).join("\n")).join("\n");
  tikzPresets.push(diagram(`cycle-${n}`, `循环图 C${n}`, "图论", `\\begin{scope}[scale={{scale}}]\n${nodes}\n${cycle}\n\\end{scope}`));
  tikzPresets.push(diagram(`complete-${n}`, `完全图 K${n}`, "图论", `\\begin{scope}[scale={{scale}}]\n${nodes}\n${complete}\n\\end{scope}`));
  tikzPresets.push(diagram(`star-${n}`, `${n} 叶星形树`, "树", `${nodes}\n\\node[circle,draw={{color}}] (root) at (0,0) {{{label}}};\n${Array.from({ length: n }, (_, i) => `\\draw[{{color}}] (root) -- (v${i});`).join("\n")}`));
}
for (let n = 2; n <= 7; n++) {
  tikzPresets.push(diagram(`flow-${n}`, `${n} 步流程`, "流程", Array.from({ length: n }, (_, i) => `\\node[draw={{color}},rounded corners] (s${i}) at (${i * 1.25},0) {${i + 1}};${i ? `\n\\draw[->,{{color}}] (s${i - 1}) -- (s${i});` : ""}`).join("\n")));
  tikzPresets.push(diagram(`timeline-${n}`, `${n} 点时间线`, "时间线", `\\draw[->,{{color}}] (-.3,0) -- (${n},0);\n${Array.from({ length: n }, (_, i) => `\\fill[{{color}}] (${i},0) circle (2pt);\\node[above] at (${i},0) {${i + 1}};`).join("\n")}`));
  tikzPresets.push(diagram(`state-${n}`, `${n} 状态环`, "状态机", Array.from({ length: n }, (_, i) => `\\node[circle,draw={{color}}] (q${i}) at (${360 * i / n}:1.5) {$q_${i}$};`).join("\n") + "\n" + Array.from({ length: n }, (_, i) => `\\draw[->,{{color}},bend left=20] (q${i}) to (q${(i + 1) % n});`).join("\n")));
}
const geometry: Array<[string, string, string]> = [
  ["triangle", "三角形", "\\draw[{{color}}] (0,0)--(3,0)--(1,2)--cycle;"],
  ["right-triangle", "直角三角形", "\\draw[{{color}}] (0,0)--(3,0)--(0,2)--cycle;\\draw (0,.25)--(.25,.25)--(.25,0);"],
  ["circle", "圆与半径", "\\draw[{{color}}] (0,0) circle (1.5);\\draw[->] (0,0)--node[above] {$r$}(1.5,0);"],
  ["ellipse", "椭圆", "\\draw[{{color}}] (0,0) ellipse (2 and 1);\\fill (-1.73,0) circle (2pt);\\fill (1.73,0) circle (2pt);"],
  ["parabola", "抛物线", "\\draw[->] (-2,0)--(2,0);\\draw[->] (0,-.3)--(0,3);\\draw[{{color}},domain=-1.7:1.7,samples=60] plot (\\x,{\\x*\\x});"],
  ["sine", "正弦曲线", "\\draw[->] (0,0)--(6.5,0);\\draw[{{color}},domain=0:6.28,samples=100] plot (\\x,{sin(\\x r)});"],
  ["cosine", "余弦曲线", "\\draw[->] (0,0)--(6.5,0);\\draw[{{color}},domain=0:6.28,samples=100] plot (\\x,{cos(\\x r)});"],
  ["axes", "笛卡尔坐标系", "\\draw[->,{{color}}] (-2,0)--(2,0) node[right] {$x$};\\draw[->,{{color}}] (0,-2)--(0,2) node[above] {$y$};"],
  ["vector", "向量与投影", "\\draw[->] (0,0)--(3,0);\\draw[->] (0,0)--(0,2.5);\\draw[->,thick,{{color}}] (0,0)--(2,2);\\draw[dashed] (2,2)--(2,0);"],
  ["venn", "韦恩图", "\\fill[{{color}},opacity=.25] (0,0) circle (1.2);\\draw (0,0) circle (1.2);\\draw (1.4,0) circle (1.2);\\node at (-.5,0) {$A$};\\node at (1.9,0) {$B$};"],
  ["commutative", "交换图", "\\node (a) at (0,1.5) {$A$};\\node (b) at (3,1.5) {$B$};\\node (c) at (0,0) {$C$};\\node (d) at (3,0) {$D$};\\draw[->,{{color}}] (a)--node[above] {$f$}(b);\\draw[->] (a)--(c);\\draw[->] (b)--(d);\\draw[->] (c)--(d);"],
  ["binary", "二叉树", "\\node[circle,draw={{color}}] at (0,0) {1} child {node[circle,draw] {2} child {node {4}} child {node {5}}} child {node[circle,draw] {3} child {node {6}} child {node {7}}};"],
  ["bar", "柱状图", "\\draw[->] (0,0)--(4,0);\\draw[->] (0,0)--(0,3);\\foreach \\x/\\h in {1/1,2/2.5,3/1.8} {\\fill[{{color}}] (\\x-.3,0) rectangle (\\x+.3,\\h);}"],
  ["grid", "网格", "\\draw[step=.5,{{color}},thin] (0,0) grid (4,3);"],
  ["cube", "立方体", "\\draw[{{color}}] (0,0) rectangle (2,2);\\draw (1,1) rectangle (3,3);\\foreach \\x/\\y in {0/0,2/0,0/2,2/2} {\\draw (\\x,\\y)--(\\x+1,\\y+1);}"],
  ["decision", "决策流程", "\\node[draw,diamond,aspect=2,draw={{color}}] (a) at (0,0) {条件};\\node[draw] (b) at (-2,-1.5) {是};\\node[draw] (c) at (2,-1.5) {否};\\draw[->] (a)--(b);\\draw[->] (a)--(c);"],
  ["gaussian", "正态分布", "\\draw[->] (-3,0)--(3,0);\\draw[{{color}},domain=-3:3,samples=80] plot (\\x,{2*exp(-\\x*\\x/2)});"],
  ["bipartite", "二部图", "\\foreach \\i in {1,2,3} {\\node[circle,draw={{color}}] (a\\i) at (0,\\i) {\\i};\\node[circle,draw] (b\\i) at (3,\\i) {\\i};}\\foreach \\i in {1,2,3} {\\foreach \\j in {1,2,3} {\\draw (a\\i)--(b\\j);}}"],
];
tikzPresets.push(...geometry.map(([id, name, source]) => diagram(id, name, id === "commutative" ? "代数" : "几何与数据", `\\begin{scope}[scale={{scale}}]\n${source}\n\\end{scope}`, id === "decision" ? ["shapes.geometric"] : [])));

const symbolGroups: Record<string, string> = {
  "希腊字母": "alpha beta gamma delta epsilon varepsilon zeta eta theta vartheta iota kappa lambda mu nu xi pi varpi rho varrho sigma varsigma tau upsilon phi varphi chi psi omega Gamma Delta Theta Lambda Xi Pi Sigma Upsilon Phi Psi Omega",
  "关系": "leq geq neq approx sim simeq equiv cong propto ll gg prec succ preceq succeq subset supset subseteq supseteq in ni notin models vdash dashv parallel perp mid nmid bowtie asymp doteq smile frown lesssim gtrsim",
  "运算": "times div cdot ast star circ bullet oplus ominus otimes oslash odot cap cup uplus sqcap sqcup vee wedge setminus wr diamond triangleleft triangleright bigtriangleup bigtriangledown amalg pm mp dagger ddagger",
  "箭头": "leftarrow rightarrow leftrightarrow Leftarrow Rightarrow Leftrightarrow mapsto longmapsto hookleftarrow hookrightarrow uparrow downarrow updownarrow Uparrow Downarrow Updownarrow nearrow searrow swarrow nwarrow longleftarrow longrightarrow longleftrightarrow Longleftarrow Longrightarrow Longleftrightarrow rightleftharpoons leftharpoonup leftharpoondown rightharpoonup rightharpoondown",
  "其他符号": "infty partial nabla forall exists neg emptyset varnothing aleph hbar ell Re Im wp top bot angle measuredangle sphericalangle triangle square Box Diamond checkmark clubsuit diamondsuit heartsuit spadesuit prime flat natural sharp surd backslash lbrace rbrace langle rangle lceil rceil lfloor rfloor vert Vert ldots cdots vdots ddots",
};
export const formulas: FormulaPreset[] = Object.entries(symbolGroups).flatMap(([category, names]) => names.split(" ").map((name) => ({ id: `symbol-${name.toLowerCase()}-${name === name.toUpperCase() ? "upper" : name[0] === name[0].toUpperCase() ? "capital" : "lower"}`, name: `\\${name}`, category, tags: [name], latex: `\\${name} `, preview: `\\${name}` })));
const snippets: Array<[string, string, string]> = [
  ["fraction", "分数", "\\frac{{{selection}}}{b}"], ["root", "平方根", "\\sqrt{{{selection}}}"], ["nth-root", "n 次根", "\\sqrt[n]{{{selection}}}"],
  ["power", "上标", "{{selection}}^{n}"], ["index", "下标", "{{selection}}_{i}"], ["sum", "求和", "\\sum_{i=1}^{n} {{selection}}"],
  ["product", "连乘", "\\prod_{i=1}^{n} {{selection}}"], ["integral", "积分", "\\int_a^b {{selection}}\\,dx"], ["double-integral", "二重积分", "\\iint_D {{selection}}\\,dx\\,dy"],
  ["limit", "极限", "\\lim_{n\\to\\infty} {{selection}}"], ["matrix", "矩阵", "\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}"],
  ["cases", "分段函数", "\\begin{cases} x & x>0 \\\\ 0 & x\\leq0 \\end{cases}"], ["binomial", "二项式", "\\binom{n}{k}"],
  ["aligned", "对齐", "\\begin{aligned} a&=b+c \\\\ &=d \\end{aligned}"], ["overline", "上划线", "\\overline{{{selection}}}"],
  ["underbrace", "下括号", "\\underbrace{{{selection}}}_{n}"], ["vector", "向量", "\\vec{{{selection}}}"], ["hat", "帽子", "\\hat{{{selection}}}"],
  ["bold", "粗体", "\\mathbf{{{selection}}}"], ["blackboard", "黑板体", "\\mathbb{R}"], ["calligraphic", "花体", "\\mathcal{F}"],
  ["derivative", "导数", "\\frac{d{{{selection}}}}{dx}"], ["partial-derivative", "偏导数", "\\frac{\\partial {{{selection}}}}{\\partial x}"],
  ["norm", "范数", "\\left\\lVert {{{selection}}} \\right\\rVert"], ["absolute", "绝对值", "\\left| {{{selection}}} \\right|"],
  ["parentheses", "括号", "\\left( {{{selection}}} \\right)"], ["brackets", "方括号", "\\left[ {{{selection}}} \\right]"],
  ["expectation", "期望", "\\mathbb{E}[{{{selection}}}]"], ["probability", "概率", "P({{{selection}}}\\mid B)"], ["text", "公式内文字", "\\text{说明}"],
  ["log", "对数", "\\log_2 {{{selection}}}"], ["sin", "正弦", "\\sin {{{selection}}}"], ["det", "行列式", "\\det A"],
  ["max", "最大值", "\\max_{x\\in S} {{{selection}}}"], ["min", "最小值", "\\min_{x\\in S} {{{selection}}}"],
];
formulas.push(...snippets.map(([id, name, latex]) => ({ id, name, category: "结构", tags: [id], latex, preview: latex.replaceAll("{{selection}}", "x") })));

themes.push(kuangTheme);
templates.push(kuangTemplate);
export const builtInExtension = extensionSchema.parse({ apiVersion: 1, id: "builtin", name: "内置素材", version: "1.0.0", author: "NJU Beamer", themes, templates, tikz: tikzPresets, formulas });
