import { createId, type Slide } from "./deck";
import { referencedAssets, type DocumentAsset, type DocumentContent } from "./document";
import type { Paper } from "./paper";

export type DocumentPage = Slide | Paper["sections"][number];
export type PageClipboard = { content: DocumentContent; assets: DocumentAsset[] };
export const documentPages = (content: DocumentContent): DocumentPage[] => "kind" in content ? content.sections : content.sections.flatMap((section) => section.slides);

export function copyPages(content: DocumentContent, assets: DocumentAsset[], ids: string[]): PageClipboard {
  const selected = new Set(ids);
  const copy = "kind" in content
    ? { ...content, sections: content.sections.filter((page) => selected.has(page.id)) }
    : { ...content, sections: content.sections.map((section) => ({ ...section, slides: section.slides.filter((page) => selected.has(page.id)) })) };
  return structuredClone({ content: copy, assets: referencedAssets(copy, assets) });
}

export function deletePages(content: DocumentContent, ids: string[]): DocumentContent {
  const selected = new Set(ids);
  if (documentPages(content).every((page) => selected.has(page.id))) return content;
  return "kind" in content ? { ...content, sections: content.sections.filter((page) => !selected.has(page.id)) }
    : { ...content, sections: content.sections.map((section) => ({ ...section, slides: section.slides.filter((page) => !selected.has(page.id)) })) };
}

export function movePages(content: DocumentContent, ids: string[], beforeId?: string, sectionId?: string): DocumentContent {
  const selected = new Set(ids);
  if (beforeId && selected.has(beforeId)) return content;
  if ("kind" in content) {
    const moving = content.sections.filter((page) => selected.has(page.id));
    const remaining = content.sections.filter((page) => !selected.has(page.id));
    const index = beforeId ? remaining.findIndex((page) => page.id === beforeId) : remaining.length;
    if (index < 0) return content;
    return { ...content, sections: [...remaining.slice(0, index), ...moving, ...remaining.slice(index)] };
  }
  const target = sectionId ?? content.sections.find((section) => section.slides.some((page) => page.id === beforeId))?.id;
  if (!target || !content.sections.some((section) => section.id === target)) return content;
  const moving = content.sections.flatMap((section) => section.slides).filter((page) => selected.has(page.id));
  return { ...content, sections: content.sections.map((section) => {
    const remaining = section.slides.filter((page) => !selected.has(page.id));
    if (section.id !== target) return { ...section, slides: remaining };
    const index = beforeId ? remaining.findIndex((page) => page.id === beforeId) : remaining.length;
    return { ...section, slides: [...remaining.slice(0, index), ...moving, ...remaining.slice(index)] };
  }) };
}

export function pastePages(target: DocumentContent, assets: DocumentAsset[], clipboard: PageClipboard, afterId?: string) {
  if (("kind" in target) !== ("kind" in clipboard.content)) throw new Error("幻灯片和论文章节不能互相粘贴");
  const sourcePreamble = clipboard.content.settings.preamble;
  if (sourcePreamble.trim() && target.settings.preamble.trim() && sourcePreamble !== target.settings.preamble) throw new Error("自定义 TeX 头不同，请先统一两个文稿的 TeX 头后粘贴");
  const preamble = target.settings.preamble || sourcePreamble;
  const pages = structuredClone(documentPages(clipboard.content));
  const labels = new Map<string, string>();
  const citations = new Map<string, string>();
  const paths = new Map<string, string>();
  const mergedAssets = [...assets];
  for (const asset of clipboard.assets) {
    const existing = assets.find((item) => item.path === asset.path);
    if (existing && JSON.stringify(existing) === JSON.stringify(asset)) continue;
    const path = existing ? `pic/${createId()}.${asset.path.split(".").at(-1)}` : asset.path;
    paths.set(asset.path, path);
    mergedAssets.push({ ...asset, path });
  }
  const visit = (value: unknown, transform: (record: Record<string, unknown>) => void) => {
    if (Array.isArray(value)) { value.forEach((item) => visit(item, transform)); return; }
    if (!value || typeof value !== "object") return;
    const record = value as Record<string, unknown>;
    transform(record);
    Object.values(record).forEach((item) => visit(item, transform));
  };
  visit(pages, (record) => {
    if (typeof record.id === "string") record.id = createId();
    if (typeof record.label === "string" && record.label) {
      const replacement = `${record.label}-${createId().slice(0, 8)}`;
      labels.set(record.label, replacement); record.label = replacement;
    }
  });
  let content = target;
  if ("kind" in target && "kind" in clipboard.content) {
    const bibliography = [...target.bibliography];
    for (const entry of clipboard.content.bibliography) {
      const existing = bibliography.find((item) => item.key === entry.key);
      if (existing && JSON.stringify(existing) === JSON.stringify(entry)) continue;
      const key = existing ? `${entry.key}-${createId().slice(0, 8)}` : entry.key;
      citations.set(entry.key, key); bibliography.push({ ...entry, key });
    }
    content = { ...target, bibliography };
  }
  visit(pages, (record) => {
    if ((record.type === "reference" || record.type === "citation") && record.attrs && typeof record.attrs === "object") {
      const attrs = record.attrs as Record<string, unknown>;
      if (typeof attrs.key === "string") attrs.key = (record.type === "reference" ? labels : citations).get(attrs.key) ?? attrs.key;
    }
    if (typeof record.source === "string") record.source = paths.get(record.source) ?? record.source.replace(/\\(label|ref|eqref|pageref|cite|hyperlink)\{([^}]+)\}/g, (_, command: string, key: string) => `\\${command}{${(command === "cite" ? citations : labels).get(key) ?? key}}`).replace(/\\includegraphics(\[[^\]]*\])?\{([^}]+)\}/g, (_, options: string | undefined, path: string) => `\\includegraphics${options ?? ""}{${paths.get(path) ?? path}}`);
  });
  const libraries = [...new Set([...target.settings.tikzLibraries, ...clipboard.content.settings.tikzLibraries])];
  if ("kind" in content) {
    const index = afterId ? content.sections.findIndex((page) => page.id === afterId) + 1 : content.sections.length;
    content = { ...content, settings: { ...content.settings, tikzLibraries: libraries, preamble }, sections: [...content.sections.slice(0, index), ...pages as Paper["sections"], ...content.sections.slice(index)] };
  } else {
    const targetSection = content.sections.find((section) => section.slides.some((page) => page.id === afterId)) ?? content.sections.at(-1);
    const imported = clipboard.content;
    if ("kind" in imported) throw new Error("不能将论文章节粘贴到幻灯片");
    const packages = [...content.settings.packages];
    for (const item of imported.settings.packages) {
      const existing = packages.find((entry) => entry.name === item.name);
      if (existing && existing.options !== item.options) throw new Error(`LaTeX 包选项冲突：${item.name}`);
      if (!existing) packages.push(item);
    }
    const themeFiles = [...content.settings.themeFiles];
    for (const file of imported.settings.themeFiles) {
      const existing = themeFiles.find((entry) => entry.path === file.path);
      if (existing && existing.content !== file.content) throw new Error(`主题资源冲突：${file.path}`);
      if (!existing) themeFiles.push(file);
    }
    content = { ...content, settings: { ...content.settings, tikzLibraries: libraries, packages, themeFiles, preamble }, sections: content.sections.map((section) => {
      if (section.id !== targetSection?.id) return section;
      const index = afterId ? section.slides.findIndex((page) => page.id === afterId) + 1 : section.slides.length;
      return { ...section, slides: [...section.slides.slice(0, index), ...pages as Slide[], ...section.slides.slice(index)] };
    }) };
  }
  return { content, assets: mergedAssets, ids: pages.map((page) => page.id) };
}
