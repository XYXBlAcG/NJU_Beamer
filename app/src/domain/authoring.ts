import { z } from "zod";
import {
  bodyFontSchema,
  blockAppearanceSchema,
  customMathFontNameSchema,
  defaultMathFont,
  defaultTheme,
  mathFontPresetSchema,
  texIdentifierSchema,
  themeModeSchema,
  type Block,
  type Deck,
  type RichTextDocument,
  type RichTextNode,
  frameOptionsSchema,
  defaultFrameOptions,
  deckSchema,
} from "./deck";
import type { DocumentAsset, SupportedImageMimeType } from "./document";

const fontSizeSchema = z.enum(["normal", "small", "footnotesize", "scriptsize", "tiny"]);
const packageNameSchema = texIdentifierSchema.min(1);
const colorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/);
const hrefSchema = z.url().refine((value) => ["https:", "http:", "mailto:"].includes(new URL(value).protocol));

const textSegmentSchema = z.union([
  z.object({
    text: z.string(),
    bold: z.boolean().optional(),
    italic: z.boolean().optional(),
    strike: z.boolean().optional(),
    code: z.boolean().optional(),
    color: colorSchema.optional(),
    href: hrefSchema.optional(),
  }),
  z.object({ footnote: z.string() }),
]);

const blockBase = {
  hidden: z.boolean().optional().default(false),
  fontSize: fontSizeSchema.optional().default("normal"),
  appearance: blockAppearanceSchema.optional().default("none"),
};

type TextSegment = z.output<typeof textSegmentSchema>;
type AuthoringBlockBase = { hidden: boolean; fontSize: Block["fontSize"]; appearance: Block["appearance"] };
type AuthoringBlock = AuthoringBlockBase & (
  | { type: "text"; content?: string; paragraphs?: TextSegment[][] }
  | { type: "list"; ordered: boolean; reveal: "none" | "overlay-alert" | "pause"; items: string[] }
  | { type: "formula"; latex: string; layout: "single" | "aligned" | "multline"; numbered: boolean }
  | { type: "table"; columns: string[]; rows: string[][]; header: boolean }
  | { type: "tikz"; source: string }
  | { type: "image"; file: string; width: number; alt: string }
  | { type: "code"; language: string; content: string }
  | { type: "rawTex"; source: string }
  | { type: "callout"; style: "block" | "alert" | "example" | "theorem" | "proof"; title: string; content?: string; paragraphs?: TextSegment[][] }
  | { type: "columns"; alignment: "top" | "center"; columns: Array<{ width: number; blocks: AuthoringBlock[] }> }
);

const authoringBlockSchema: z.ZodType<AuthoringBlock> = z.lazy(() => z.discriminatedUnion("type", [
  z.object({ ...blockBase, type: z.literal("text"), content: z.string().optional(), paragraphs: z.array(z.array(textSegmentSchema)).optional() }),
  z.object({ ...blockBase, type: z.literal("list"), ordered: z.boolean().optional().default(false), reveal: z.enum(["none", "overlay-alert", "pause"]).optional().default("none"), items: z.array(z.string()) }),
  z.object({ ...blockBase, type: z.literal("formula"), latex: z.string(), layout: z.enum(["single", "aligned", "multline"]).optional().default("single"), numbered: z.boolean().optional().default(false) }),
  z.object({ ...blockBase, type: z.literal("table"), columns: z.array(z.string()).min(1), rows: z.array(z.array(z.string())), header: z.boolean().optional().default(true) }),
  z.object({ ...blockBase, type: z.literal("tikz"), source: z.string() }),
  z.object({ ...blockBase, type: z.literal("image"), file: z.string().min(1), width: z.number().min(0.05).max(1).optional().default(0.8), alt: z.string().optional().default("图片") }),
  z.object({ ...blockBase, type: z.literal("code"), language: z.string().optional().default("text"), content: z.string() }),
  z.object({ ...blockBase, type: z.literal("rawTex"), source: z.string() }),
  z.object({ ...blockBase, type: z.literal("callout"), style: z.enum(["block", "alert", "example", "theorem", "proof"]), title: z.string().optional().default(""), content: z.string().optional(), paragraphs: z.array(z.array(textSegmentSchema)).optional() }),
  z.object({
    ...blockBase,
    type: z.literal("columns"),
    alignment: z.enum(["top", "center"]).optional().default("top"),
    columns: z.array(z.object({ width: z.number().min(0.1).max(0.9), blocks: z.array(authoringBlockSchema) })).min(2).max(3),
  }),
]));

const slideBase = { frame: frameOptionsSchema.partial().optional(), notes: z.string().optional().default("") };
const titleSlideSchema = z.object({ ...slideBase, kind: z.literal("title"), title: z.string().optional(), blocks: z.array(z.never()).optional() });
const contentsSlideSchema = z.object({ ...slideBase, kind: z.literal("contents"), title: z.string().optional(), blocks: z.array(z.never()).optional() });
const contentSlideSchema = z.object({ ...slideBase, kind: z.literal("content").optional().default("content"), title: z.string().optional().default(""), blocks: z.array(authoringBlockSchema).optional().default([]) });
const mathFontInputSchema = z.object({
  preset: mathFontPresetSchema.optional().default("latin-modern"),
  customName: customMathFontNameSchema.optional().default(""),
});
const themeInputSchema = z.object({
  mode: themeModeSchema.optional().default("nju"),
  name: texIdentifierSchema.optional().default(""),
  colorTheme: texIdentifierSchema.optional().default(""),
  fontTheme: texIdentifierSchema.optional().default(""),
  innerTheme: texIdentifierSchema.optional().default(""),
  outerTheme: texIdentifierSchema.optional().default(""),
});

export const authoringSpecSchema = z.object({
  specVersion: z.literal(2),
  metadata: z.object({
    title: z.string().min(1),
    subtitle: z.string().optional().default(""),
    author: z.string().optional().default(""),
    institute: z.string().optional().default("南京大学"),
    date: z.string().optional().default("\\today"),
  }),
  settings: z.object({
    sectionTitleSlides: z.boolean().optional().default(false),
    bodyFont: bodyFontSchema.optional().default("song"),
    mathFont: mathFontInputSchema.optional().default(defaultMathFont),
    theme: themeInputSchema.optional().default(defaultTheme),
    documentClassOptions: z.string().optional().default(""),
    preamble: z.string().optional().default(""),
    packages: z.array(z.object({ name: packageNameSchema, options: z.string().optional().default("") })).optional().default([]),
    tikzLibraries: z.array(packageNameSchema).optional().default([]),
  }).optional().default({
    sectionTitleSlides: false,
    bodyFont: "song",
    mathFont: defaultMathFont,
    theme: defaultTheme,
    documentClassOptions: "",
    preamble: "",
    packages: [],
    tikzLibraries: [],
  }),
  sections: z.array(z.object({
    title: z.string().min(1),
    slides: z.array(z.union([titleSlideSchema, contentsSlideSchema, contentSlideSchema])).min(1),
  })).min(1),
});

export type AuthoringSpec = z.input<typeof authoringSpecSchema>;
export type AssetLoader = (path: string) => Promise<Uint8Array>;

const hex = (bytes: ArrayBuffer) => Array.from(new Uint8Array(bytes), (value) => value.toString(16).padStart(2, "0")).join("");

const imageType = (content: Uint8Array): { mimeType: SupportedImageMimeType; extension: "png" | "jpg" } => {
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => content[index] === value)) return { mimeType: "image/png", extension: "png" };
  if (content[0] === 255 && content[1] === 216 && content[2] === 255) return { mimeType: "image/jpeg", extension: "jpg" };
  throw new Error("图片必须是有效的 PNG 或 JPEG 文件");
};

const richContent = (content: string | undefined, paragraphs: z.output<typeof textSegmentSchema>[][] | undefined): RichTextDocument => ({
  type: "doc",
  content: (paragraphs ?? [[{ text: content ?? "" }]]).map((segments) => ({
    type: "paragraph",
    content: segments.map((segment): RichTextNode => {
      if ("footnote" in segment) return { type: "footnote", attrs: { text: segment.footnote } };
      const marks: NonNullable<RichTextNode["marks"]> = [];
      if (segment.bold) marks.push({ type: "bold" });
      if (segment.italic) marks.push({ type: "italic" });
      if (segment.strike) marks.push({ type: "strike" });
      if (segment.code) marks.push({ type: "code" });
      if (segment.color) marks.push({ type: "textStyle", attrs: { color: segment.color.toUpperCase() } });
      if (segment.href) marks.push({ type: "link", attrs: { href: segment.href } });
      return { type: "text", text: segment.text, ...(marks.length ? { marks } : {}) };
    }),
  })),
});

export async function composeAuthoringSpec(input: unknown, loadAsset: AssetLoader): Promise<{ deck: Deck; assets: DocumentAsset[] }> {
  const spec = authoringSpecSchema.parse(input);
  const assetsByDigest = new Map<string, DocumentAsset>();
  const sections: Deck["sections"] = [];

  for (const [sectionIndex, section] of spec.sections.entries()) {
    const slides: Deck["sections"][number]["slides"] = [];
    for (const [slideIndex, slide] of section.slides.entries()) {
      const composeBlocks = async (inputBlocks: AuthoringBlock[], prefix: string): Promise<Block[]> => {
        const blocks: Block[] = [];
        for (const [blockIndex, block] of inputBlocks.entries()) {
          const id = `${prefix}-${blockIndex + 1}`;
          const base = { id, hidden: block.hidden, fontSize: block.fontSize, appearance: block.appearance };
          if (block.type === "text") blocks.push({ ...base, type: "text", content: richContent(block.content, block.paragraphs) });
          else if (block.type === "list") blocks.push({ ...base, type: "list", ordered: block.ordered, reveal: block.reveal, items: block.items });
          else if (block.type === "formula") blocks.push({ ...base, type: "formula", latex: block.latex, layout: block.layout, numbered: block.numbered });
          else if (block.type === "table") blocks.push({ ...base, type: "table", columns: block.columns, rows: block.rows, header: block.header });
          else if (block.type === "tikz") blocks.push({ ...base, type: "tikz", source: block.source });
          else if (block.type === "code") blocks.push({ ...base, type: "code", language: block.language, content: block.content });
          else if (block.type === "rawTex") blocks.push({ ...base, type: "rawTex", source: block.source });
          else if (block.type === "callout") blocks.push({ ...base, type: "callout", style: block.style, title: block.title, content: richContent(block.content, block.paragraphs) });
          else if (block.type === "columns") blocks.push({
            ...base,
            type: "columns",
            alignment: block.alignment,
            columns: await Promise.all(block.columns.map(async (column, columnIndex) => ({
              id: `${id}-column-${columnIndex + 1}`,
              width: column.width,
              blocks: await composeBlocks(column.blocks, `${id}-column-${columnIndex + 1}-block`),
            }))),
          });
          else {
            const content = await loadAsset(block.file);
            const digest = hex(await crypto.subtle.digest("SHA-256", content.slice().buffer));
            const type = imageType(content);
            const asset = assetsByDigest.get(digest) ?? { path: `pic/${digest.slice(0, 20)}.${type.extension}`, mimeType: type.mimeType, content: Array.from(content) };
            assetsByDigest.set(digest, asset);
            blocks.push({ ...base, type: "image", source: asset.path, width: block.width, alt: block.alt });
          }
        }
        return blocks;
      };
      const blocks = slide.kind === "content" ? await composeBlocks(slide.blocks, `block-${sectionIndex + 1}-${slideIndex + 1}`) : [];
      slides.push({
        id: `slide-${sectionIndex + 1}-${slideIndex + 1}`,
        title: slide.title ?? "",
        kind: slide.kind,
        blocks,
        frame: { ...defaultFrameOptions, ...slide.frame },
        notes: slide.notes,
      });
    }
    sections.push({ id: `section-${sectionIndex + 1}`, title: section.title, slides });
  }

  return {
    deck: deckSchema.parse({
      formatVersion: 4,
      metadata: spec.metadata,
      settings: spec.settings,
      sections,
    }),
    assets: [...assetsByDigest.values()].sort((left, right) => left.path.localeCompare(right.path)),
  };
}
