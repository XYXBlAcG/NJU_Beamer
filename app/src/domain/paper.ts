import { z } from "zod";
import { blockSchema, bodyFontSchema, createId, richText, richTextSchema, type Block } from "./deck";
import { cjkFontSetup, thesisCoverFontSetup } from "./fonts";
import { escapeText, serializeBlock, serializeRichNode } from "./serialize";
import { bibliographyEntrySchema, serializeBibliography } from "./bibliography";
import { parseMixedText } from "./mixedText";
import type { RichTextNode } from "./deck";
import { documentColorsTex } from "./typography";

export const paperSchema = z.object({
  kind: z.literal("paper"), formatVersion: z.literal(1),
  metadata: z.object({ title: z.string(), englishTitle: z.string(), author: z.string(), department: z.string(), major: z.string(), supervisor: z.string(), studentId: z.string(), grade: z.string() }),
  settings: z.object({ template: z.enum(["bachelor", "master", "doctor", "report"]), bodyFont: bodyFontSchema, marginMm: z.number().min(10).max(50), lineSpacing: z.number().min(1).max(2), tableOfContents: z.boolean(), preamble: z.string(), tikzLibraries: z.array(z.string().regex(/^[A-Za-z0-9._-]+$/)), header: z.string().default(""), footer: z.string().default(""), bibliographyStyle: z.enum(["numeric", "author-year"]).default("numeric") }),
  abstract: richTextSchema, englishAbstract: richTextSchema, keywords: z.string(), englishKeywords: z.string(),
  sections: z.array(z.object({ id: z.string().min(1), title: z.string(), level: z.enum(["chapter", "section", "subsection", "appendix", "acknowledgement"]), label: z.string().regex(/^[A-Za-z0-9:._-]*$/), blocks: z.array(blockSchema) })).min(1),
  bibliography: z.array(bibliographyEntrySchema),
}).strict().superRefine((paper, context) => {
  const keys = new Set<string>();
  paper.bibliography.forEach((reference, index) => {
    if (keys.has(reference.key)) context.addIssue({ code: "custom", path: ["bibliography", index, "key"], message: "文献标识重复" });
    keys.add(reference.key);
  });
  const labels = new Set<string>();
  const nodes: RichTextNode[] = [];
  const ids = new Set<string>();
  const checkId = (id: string) => { if (ids.has(id)) context.addIssue({ code: "custom", message: `内容标识重复：${id}` }); ids.add(id); };
  const checkLabel = (label?: string) => {
    if (!label) return;
    if (labels.has(label)) context.addIssue({ code: "custom", message: `标签重复：${label}` });
    labels.add(label);
  };
  const visit = (blocks: Block[], parentVisible = true) => blocks.forEach((block) => {
    checkId(block.id);
    const visible = parentVisible && !block.hidden;
    if (visible) checkLabel(block.label);
    if (block.appearance !== "none" || block.type === "list" && block.reveal !== "none") context.addIssue({ code: "custom", message: "论文不支持幻灯片逐步显示" });
    if (block.type === "columns") block.columns.forEach((column) => { checkId(column.id); visit(column.blocks, visible); });
    if (visible && (block.type === "text" || block.type === "callout")) nodes.push(block.content);
    if (visible && (block.type === "list" || block.type === "table")) {
      const values = block.type === "list" ? block.items : [...block.columns, ...block.rows.flat()];
      values.forEach((value) => parseMixedText(value).issues.forEach((issue) => context.addIssue({ code: "custom", message: issue.message })));
    }
  });
  paper.sections.forEach((section) => { checkId(section.id); checkLabel(section.label); visit(section.blocks); });
  nodes.push(paper.abstract, paper.englishAbstract);
  const checkNode = (node: RichTextNode) => {
    if (node.type === "citation" && !keys.has(String(node.attrs?.key))) context.addIssue({ code: "custom", message: `文献不存在：${node.attrs?.key}` });
    if (node.type === "reference" && !labels.has(String(node.attrs?.key))) context.addIssue({ code: "custom", message: `引用标签不存在：${node.attrs?.key}` });
    if (node.text) parseMixedText(node.text).issues.forEach((issue) => context.addIssue({ code: "custom", message: issue.message }));
    if (node.type === "footnote") parseMixedText(String(node.attrs?.text ?? "")).issues.forEach((issue) => context.addIssue({ code: "custom", message: issue.message }));
    node.content?.forEach(checkNode);
  };
  nodes.forEach(checkNode);
});
export type Paper = z.infer<typeof paperSchema>;
export const createDefaultPaper = (template: Paper["settings"]["template"] = "bachelor"): Paper => ({
  kind: "paper", formatVersion: 1,
  metadata: { title: "论文标题", englishTitle: "Thesis Title", author: "作者", department: "院系", major: "专业", supervisor: "导师,教授", studentId: "", grade: String(new Date().getFullYear()) },
  settings: { template, bodyFont: "song", marginMm: 25, lineSpacing: 1.3, tableOfContents: true, preamble: "", tikzLibraries: [], header: "", footer: "", bibliographyStyle: "numeric" },
  abstract: richText("在此填写中文摘要。"), englishAbstract: richText("Write the English abstract here."), keywords: "关键词", englishKeywords: "Keywords",
  sections: [{ id: createId(), title: "引言", level: "chapter", label: "ch:introduction", blocks: [{ id: createId(), type: "text", hidden: false, fontSize: "normal", appearance: "none", content: richText("介绍研究背景与问题。") }] }], bibliography: [],
});

export const serializePaper = (input: Paper): string => {
  const paper = paperSchema.parse(input);
  const report = paper.settings.template === "report";
  const text = (content: Paper["abstract"]) => (content.content ?? []).map(serializeRichNode).join("");
  const info = paper.metadata;
  const bibliography = serializeBibliography(paper.bibliography);
  return `${!report && bibliography ? `\\begin{filecontents*}[overwrite]{references.bib}\n${bibliography}\n\\end{filecontents*}\n` : ""}\\documentclass[${report ? "a4paper,UTF8,fontset=fandol" : `type=${paper.settings.template},fontset=fandol,oneside` }]{${report ? "ctexrep" : "njuthesis"}}
\\usepackage{graphicx,booktabs,tikz,listings,ulem,setspace,fancyhdr}
${documentColorsTex}
${report ? "\\usepackage{hyperref,amsmath,amsthm}\n\\newtheorem{theorem}{定理}" : ""}
${report ? "" : "\\njusetup[theorem]{define}"}
\\usepackage{geometry}
\\geometry{margin=${paper.settings.marginMm}mm}
\\setstretch{${paper.settings.lineSpacing}}
${cjkFontSetup(paper.settings.bodyFont)}
${!report && paper.settings.template !== "bachelor" ? thesisCoverFontSetup : ""}
\\setmonofont{lmmonolt10-regular.otf}[BoldFont=lmmonolt10-bold.otf,ItalicFont=lmmonolt10-oblique.otf]
\\lstset{basicstyle=\\ttfamily\\small,breaklines=true,columns=fullflexible}
${paper.settings.tikzLibraries.length ? `\\usetikzlibrary{${paper.settings.tikzLibraries.join(",")}}` : ""}
${report ? `\\title{${escapeText(info.title)}}\n\\author{${escapeText(info.author)}\\\\南京大学 · ${escapeText(info.department)}}` : `\\njusetup[info]{title={${escapeText(info.title)}},title*={${escapeText(info.englishTitle)}},author={${escapeText(info.author)}},department={${escapeText(info.department)}},major={${escapeText(info.major)}},supervisor={${escapeText(info.supervisor)}},student-id={${escapeText(info.studentId)}},grade={${escapeText(info.grade)}},keywords={${escapeText(paper.keywords)}},keywords*={${escapeText(paper.englishKeywords)}}}\n${bibliography ? `\\njusetup[bib]{resource={references.bib},style=${paper.settings.bibliographyStyle}}` : ""}`}
${paper.settings.preamble}
\\begin{document}
\\maketitle
${report ? `\\chapter*{摘要}\n${text(paper.abstract)}\n\\chapter*{Abstract}\n${text(paper.englishAbstract)}` : `\\begin{abstract}\n${text(paper.abstract)}\\end{abstract}\n\\begin{abstract*}\n${text(paper.englishAbstract)}\\end{abstract*}`}
${paper.settings.tableOfContents ? "\\tableofcontents" : ""}
${report ? "" : "\\mainmatter"}
${paper.settings.header || paper.settings.footer ? `\\fancypagestyle{njugui}{\\fancyhf{}\\fancyhead[C]{${escapeText(paper.settings.header)}}\\fancyfoot[C]{${paper.settings.footer ? escapeText(paper.settings.footer) : "\\thepage"}}}\n\\pagestyle{njugui}\n\\fancypagestyle{plain}{\\fancyhf{}\\fancyhead[C]{${escapeText(paper.settings.header)}}\\fancyfoot[C]{${paper.settings.footer ? escapeText(paper.settings.footer) : "\\thepage"}}}` : ""}
${paper.sections.map((section, index) => `${section.level === "appendix" && !paper.sections.slice(0, index).some((item) => item.level === "appendix") ? "\\appendix\n" : ""}\\${section.level === "acknowledgement" ? "chapter*" : section.level === "appendix" ? "chapter" : section.level}{${escapeText(section.title)}}${section.label ? `\\label{${section.label}}` : ""}\n${section.blocks.filter((block) => !block.hidden).map((block) => serializeBlock(block, "paper")).join("\n\n")}`).join("\n\n")}
${paper.bibliography.length ? report ? `\\begin{thebibliography}{99}\n${paper.bibliography.map((reference) => `\\bibitem{${reference.key}} ${reference.fields.author ?? ""}. ${reference.fields.title ?? ""}. ${reference.fields.year ?? ""}.`).join("\n")}\n\\end{thebibliography}` : "\\printbibliography" : ""}
\\end{document}
`;
};
