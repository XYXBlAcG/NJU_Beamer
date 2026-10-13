import { z } from "zod";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { blockSchema, createId, deckSchema, themeSchema, themeFileSchema } from "./deck";
import { cloneBlock } from "./blocks";
import { documentAssetSchema, referencedAssetPaths, type NjubDocument } from "./document";

const identifier = z.string().regex(/^[a-z0-9][a-z0-9._-]*$/).max(100);
const entry = { id: identifier, name: z.string().min(1).max(120), category: z.string().min(1), tags: z.array(z.string()).default([]) };
export const themePresetSchema = z.object({ ...entry, theme: themeSchema, preamble: z.string(), files: z.array(themeFileSchema) });
export const templatePresetSchema = z.object({ ...entry, deck: deckSchema, assets: z.array(documentAssetSchema) }).superRefine((template, context) => {
  const paths = new Set(template.assets.map((asset) => asset.path));
  if ([...referencedAssetPaths(template.deck)].some((path) => !paths.has(path))) context.addIssue({ code: "custom", message: "模板缺少引用的图片" });
  if (paths.size !== template.assets.length) context.addIssue({ code: "custom", message: "模板图片资源重复" });
});
export const parameterSchema = z.object({ key: identifier, name: z.string(), value: z.string(), kind: z.enum(["text", "number", "color"]) });
export const tikzPresetSchema = z.object({ ...entry, source: z.string(), libraries: z.array(z.string().regex(/^[A-Za-z0-9._-]+$/)), parameters: z.array(parameterSchema) });
export const formulaPresetSchema = z.object({ ...entry, latex: z.string(), preview: z.string() });
export const extensionSchema = z.object({
  apiVersion: z.literal(1), id: identifier, name: z.string().min(1), version: z.string().min(1), author: z.string(),
  themes: z.array(themePresetSchema).default([]), templates: z.array(templatePresetSchema).default([]),
  tikz: z.array(tikzPresetSchema).default([]), formulas: z.array(formulaPresetSchema).default([]),
}).strict().superRefine((extension, context) => {
  for (const kind of ["themes", "templates", "tikz", "formulas"] as const) {
    const ids = new Set<string>();
    extension[kind].forEach((item, index) => {
      if (ids.has(item.id)) context.addIssue({ code: "custom", path: [kind, index, "id"], message: "素材标识重复" });
      ids.add(item.id);
    });
  }
});
export type Extension = z.infer<typeof extensionSchema>;
export type ThemePreset = z.infer<typeof themePresetSchema>;
export type TemplatePreset = z.infer<typeof templatePresetSchema>;
export type TikzPreset = z.infer<typeof tikzPresetSchema>;
export type FormulaPreset = z.infer<typeof formulaPresetSchema>;
export type ThemeFile = z.infer<typeof themeFileSchema>;

export const encodeExtension = (extension: Extension) => zipSync({ "manifest.json": strToU8(JSON.stringify(extensionSchema.parse(extension))) });
export const decodeExtension = (bytes: Uint8Array): Extension => {
  if (bytes.length > 32 * 1024 * 1024) throw new Error("扩展包不能超过 32 MB");
  const archive = unzipSync(bytes, { filter: (file) => {
    if (file.originalSize > 64 * 1024 * 1024) throw new Error("扩展内容过大");
    return true;
  } });
  if (Object.keys(archive).length !== 1 || !archive["manifest.json"]) throw new Error("扩展包应仅包含 manifest.json");
  return extensionSchema.parse(JSON.parse(strFromU8(archive["manifest.json"])));
};

export const instantiateTemplate = (template: TemplatePreset): NjubDocument => ({
  deck: { ...structuredClone(template.deck), sections: template.deck.sections.map((section) => ({ ...section, id: createId(), slides: section.slides.map((slide) => ({ ...slide, id: createId(), frame: { ...slide.frame }, blocks: slide.blocks.map(cloneBlock) })) })) },
  assets: structuredClone(template.assets),
});
export const renderSnippet = (source: string, selection = "") => source.replaceAll("{{selection}}", selection || "x");
export const renderTikz = (preset: TikzPreset, values: Record<string, string>): string => {
  const parameters = new Map(preset.parameters.map((parameter) => [parameter.key, parameter]));
  return preset.source.replace(/\{\{([a-z0-9._-]+)\}\}/g, (_, key: string) => {
    const parameter = parameters.get(key);
    if (!parameter) throw new Error(`未定义的参数：${key}`);
    const value = values[key] ?? parameter.value;
    if (parameter.kind === "number" && (!Number.isFinite(Number(value)) || Number(value) < 0.1 || Number(value) > 100)) throw new Error("数值参数应在 0.1–100 之间");
    if (parameter.kind === "color" && !/^[A-Za-z]+(?:!\d{1,3})?$/.test(value)) throw new Error("请输入 TikZ 颜色，如 blue!60");
    if (parameter.kind === "text" && /[{}\\%]/.test(value)) throw new Error("标签不能含 TeX 控制字符");
    return value;
  });
};
export const tikzBlock = (source: string) => blockSchema.parse({ id: createId(), type: "tikz", source, hidden: false, fontSize: "normal", appearance: "none" });
