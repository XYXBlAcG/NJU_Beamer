import { z } from "zod";

const id = z.string().min(1);
const fontSizeSchema = z.enum(["normal", "small", "footnotesize", "scriptsize", "tiny"]);
export const blockAppearanceSchema = z.enum(["none", "uncover", "only"]);
export const bodyFontSchema = z.enum(["song", "hei", "kai", "fangsong"]);
export const mathFontPresetSchema = z.enum(["latin-modern", "times", "custom"]);
export const themeModeSchema = z.enum(["nju", "default", "custom"]);
export const texIdentifierSchema = z.string().regex(/^[A-Za-z0-9._-]*$/);
export const customMathFontNameSchema = z.string().regex(/^[^{}\\\r\n]*$/);
const blockBase = { id, hidden: z.boolean(), fontSize: fontSizeSchema, appearance: blockAppearanceSchema };

const richMarkSchema = z.object({ type: z.string(), attrs: z.record(z.string(), z.unknown()).optional() });

export type RichTextNode = {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
  content?: RichTextNode[];
};

const richNodeSchema: z.ZodType<RichTextNode> = z.lazy(() => z.object({
  type: z.string(),
  text: z.string().optional(),
  attrs: z.record(z.string(), z.unknown()).optional(),
  marks: z.array(richMarkSchema).optional(),
  content: z.array(richNodeSchema).optional(),
}));

export const richTextSchema = z.object({ type: z.literal("doc"), content: z.array(richNodeSchema).optional() });
export type RichTextDocument = z.infer<typeof richTextSchema>;
export type FontSize = z.infer<typeof fontSizeSchema>;
export type BlockAppearance = z.infer<typeof blockAppearanceSchema>;

type BlockBase = { id: string; hidden: boolean; fontSize: FontSize; appearance: BlockAppearance };
export type Block = BlockBase & (
  | { type: "text"; content: RichTextDocument }
  | { type: "list"; ordered: boolean; reveal: "none" | "overlay-alert" | "pause"; items: string[] }
  | { type: "formula"; latex: string; layout: "single" | "aligned" | "multline"; numbered: boolean }
  | { type: "table"; columns: string[]; rows: string[][]; header: boolean }
  | { type: "tikz"; source: string }
  | { type: "image"; source: string; width: number; alt: string }
  | { type: "code"; language: string; content: string }
  | { type: "rawTex"; source: string }
  | { type: "callout"; style: "block" | "alert" | "example" | "theorem" | "proof"; title: string; content: RichTextDocument }
  | { type: "columns"; alignment: "top" | "center"; columns: Array<{ id: string; width: number; blocks: Block[] }> }
);

export const blockSchema: z.ZodType<Block> = z.lazy(() => z.discriminatedUnion("type", [
  z.object({ ...blockBase, type: z.literal("text"), content: richTextSchema }),
  z.object({ ...blockBase, type: z.literal("list"), ordered: z.boolean(), reveal: z.enum(["none", "overlay-alert", "pause"]), items: z.array(z.string()) }),
  z.object({ ...blockBase, type: z.literal("formula"), latex: z.string(), layout: z.enum(["single", "aligned", "multline"]), numbered: z.boolean() }),
  z.object({ ...blockBase, type: z.literal("table"), columns: z.array(z.string()).min(1), rows: z.array(z.array(z.string())), header: z.boolean() }),
  z.object({ ...blockBase, type: z.literal("tikz"), source: z.string() }),
  z.object({ ...blockBase, type: z.literal("image"), source: z.string(), width: z.number().min(0.05).max(1), alt: z.string() }),
  z.object({ ...blockBase, type: z.literal("code"), language: z.string(), content: z.string() }),
  z.object({ ...blockBase, type: z.literal("rawTex"), source: z.string() }),
  z.object({ ...blockBase, type: z.literal("callout"), style: z.enum(["block", "alert", "example", "theorem", "proof"]), title: z.string(), content: richTextSchema }),
  z.object({
    ...blockBase,
    type: z.literal("columns"),
    alignment: z.enum(["top", "center"]),
    columns: z.array(z.object({ id, width: z.number().min(0.1).max(0.9), blocks: z.array(blockSchema) })).min(2).max(3),
  }),
]));

export const frameOptionsSchema = z.object({
  plain: z.boolean(),
  allowFrameBreaks: z.boolean(),
  shrink: z.boolean(),
  label: z.string().regex(/^[A-Za-z0-9:._-]*$/),
});
export type FrameOptions = z.infer<typeof frameOptionsSchema>;

export const defaultFrameOptions: FrameOptions = { plain: false, allowFrameBreaks: false, shrink: false, label: "" };
export const slideSchema = z.object({
  id,
  title: z.string(),
  kind: z.enum(["title", "contents", "content"]),
  blocks: z.array(blockSchema),
  frame: frameOptionsSchema,
  notes: z.string(),
});
export type Slide = z.infer<typeof slideSchema>;
export const sectionSchema = z.object({ id, title: z.string(), slides: z.array(slideSchema) });

const packageName = texIdentifierSchema.min(1);

export const defaultMathFont = { preset: "latin-modern" as const, customName: "" };
export const defaultTheme = { mode: "nju" as const, name: "", colorTheme: "", fontTheme: "", innerTheme: "", outerTheme: "" };

export const mathFontSchema = z.object({
  preset: mathFontPresetSchema,
  customName: customMathFontNameSchema,
});

export const themeSchema = z.object({
  mode: themeModeSchema,
  name: texIdentifierSchema,
  colorTheme: texIdentifierSchema,
  fontTheme: texIdentifierSchema,
  innerTheme: texIdentifierSchema,
  outerTheme: texIdentifierSchema,
});

const hasOverlay = (block: Block): boolean => block.appearance !== "none"
  || (block.type === "list" && block.reveal !== "none")
  || (block.type === "columns" && block.columns.some((column) => column.blocks.some(hasOverlay)));

const visitBlocks = (blocks: Block[], visit: (block: Block) => void) => {
  for (const block of blocks) {
    visit(block);
    if (block.type === "columns") block.columns.forEach((column) => visitBlocks(column.blocks, visit));
  }
};

const deckV4Schema = z.object({
  formatVersion: z.literal(4),
  metadata: z.object({ title: z.string(), subtitle: z.string(), author: z.string(), institute: z.string(), date: z.string() }),
  settings: z.object({
    sectionTitleSlides: z.boolean(),
    bodyFont: bodyFontSchema,
    mathFont: mathFontSchema.default(defaultMathFont),
    theme: themeSchema.default(defaultTheme),
    documentClassOptions: z.string().default(""),
    preamble: z.string().default(""),
    packages: z.array(z.object({ name: packageName, options: z.string() })),
    tikzLibraries: z.array(packageName),
  }),
  sections: z.array(sectionSchema),
}).superRefine((deck, context) => {
  deck.sections.forEach((section, sectionIndex) => section.slides.forEach((slide, slideIndex) => {
    if (slide.frame.allowFrameBreaks && slide.blocks.some(hasOverlay)) {
      context.addIssue({ code: "custom", path: ["sections", sectionIndex, "slides", slideIndex, "frame", "allowFrameBreaks"], message: "自动分页页面不能使用逐项或逐块显示" });
    }
    visitBlocks(slide.blocks, (block) => {
      if (block.type === "columns" && block.columns.reduce((sum, column) => sum + column.width, 0) > 1.001) {
        context.addIssue({ code: "custom", path: ["sections", sectionIndex, "slides", slideIndex, "blocks"], message: "分栏宽度总和不能超过 1" });
      }
    });
  }));
});

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const migrateBlock = (value: unknown): unknown => {
  if (!isRecord(value)) return value;
  const block: Record<string, unknown> = { ...value, appearance: typeof value.appearance === "string" ? value.appearance : "none" };
  if (block.type === "columns" && Array.isArray(block.columns)) {
    block.columns = block.columns.map((column) => isRecord(column) && Array.isArray(column.blocks)
      ? { ...column, blocks: column.blocks.map(migrateBlock) }
      : column);
  }
  return block;
};
const migrateDocument = (value: unknown) => {
  if (!isRecord(value) || value.formatVersion !== 3 || !Array.isArray(value.sections)) return value;
  return {
    ...value,
    formatVersion: 4,
    sections: value.sections.map((section) => isRecord(section) && Array.isArray(section.slides)
      ? {
        ...section,
        slides: section.slides.map((slide) => isRecord(slide)
          ? {
            ...slide,
            blocks: Array.isArray(slide.blocks) ? slide.blocks.map(migrateBlock) : slide.blocks,
            frame: slide.frame ?? { ...defaultFrameOptions },
            notes: slide.notes ?? "",
          }
          : slide),
      }
      : section),
  };
};

export const deckSchema = z.preprocess(migrateDocument, deckV4Schema);
export type Deck = z.infer<typeof deckV4Schema>;
export type BodyFont = z.infer<typeof bodyFontSchema>;
export type MathFontPreset = z.infer<typeof mathFontPresetSchema>;
export type ThemeMode = z.infer<typeof themeModeSchema>;
export const createId = () => crypto.randomUUID();

export const richText = (text: string): RichTextDocument => ({
  type: "doc",
  content: [{ type: "paragraph", content: text ? [{ type: "text", text }] : [] }],
});

export const createDefaultDeck = (): Deck => ({
  formatVersion: 4,
  metadata: { title: "标题", subtitle: "副标题", author: "作者", institute: "南京大学", date: "\\today" },
  settings: {
    sectionTitleSlides: false,
    bodyFont: "song",
    mathFont: { ...defaultMathFont },
    theme: { ...defaultTheme },
    documentClassOptions: "",
    preamble: "",
    packages: [],
    tikzLibraries: [],
  },
  sections: [{
    id: createId(),
    title: "第一部分",
    slides: [
      { id: createId(), title: "", kind: "title", blocks: [], frame: { ...defaultFrameOptions }, notes: "" },
      { id: createId(), title: "第一张幻灯片", kind: "content", blocks: [{ id: createId(), type: "text", hidden: false, fontSize: "normal", appearance: "none", content: richText("从这里开始创作。") }], frame: { ...defaultFrameOptions }, notes: "" },
    ],
  }],
});
