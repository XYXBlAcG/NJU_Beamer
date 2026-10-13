import { createDefaultDeck, createId, defaultFrameOptions, richText } from "./deck";
import { instantiateTemplate, renderTikz, tikzBlock, type TemplatePreset, type ThemePreset, type TikzPreset } from "./extensions";
import type { NjubDocument } from "./document";

export type PresetEntry = { key: string; kind: "templates" | "themes" | "tikz"; item: ThemePreset | TemplatePreset | TikzPreset };
export const presetPreviewDocument = (entry: PresetEntry, parameters: Record<string, string> = {}): NjubDocument => {
  if (entry.kind === "templates") return instantiateTemplate(entry.item as TemplatePreset);
  const deck = createDefaultDeck();
  deck.settings.pageSize = { preset: "16:9", widthMm: 160, heightMm: 90 };
  deck.settings.sectionTitleSlides = false;
  if (entry.kind === "themes") {
    const preset = entry.item as ThemePreset;
    deck.settings.theme = preset.theme;
    deck.settings.themePreamble = preset.preamble;
    deck.settings.themeFiles = preset.files;
    deck.metadata.title = preset.name;
    deck.metadata.subtitle = "";
    deck.sections[0].title = "主题预览";
    deck.sections[0].slides = [{ ...deck.sections[0].slides[1], title: preset.name, blocks: ([
      ["block", "主题主色", "中文与数学 \\(E=mc^2\\)"],
      ["example", "示例色", "清晰呈现定义、示例与证明"],
      ["alert", "强调色", "用于突出关键结论"],
    ] as const).map(([style, title, value]) => ({ id: createId(), type: "callout" as const, hidden: false, fontSize: "small" as const, appearance: "none" as const, style, title, content: richText(value) })) }];
  } else {
    const preset = entry.item as TikzPreset;
    deck.settings.theme.mode = "default";
    deck.settings.tikzLibraries = preset.libraries;
    deck.sections[0].slides = [{ id: createId(), title: preset.name, kind: "content", frame: { ...defaultFrameOptions }, notes: "", blocks: [tikzBlock(renderTikz(preset, parameters))] }];
  }
  return { deck, assets: [] };
};
