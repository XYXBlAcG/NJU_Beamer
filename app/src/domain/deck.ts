import { z } from "zod";

const id = z.string().min(1);
const fontSizeSchema = z.enum(["normal", "small", "footnotesize", "scriptsize", "tiny"]);
const bodyFontSchema = z.enum(["song", "hei", "kai", "fangsong"]);
const blockBase = { id, hidden: z.boolean(), fontSize: fontSizeSchema };

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

export const blockSchema = z.discriminatedUnion("type", [
  z.object({ ...blockBase, type: z.literal("text"), content: richTextSchema }),
  z.object({ ...blockBase, type: z.literal("list"), ordered: z.boolean(), reveal: z.enum(["none", "overlay-alert", "pause"]), items: z.array(z.string()) }),
  z.object({ ...blockBase, type: z.literal("formula"), latex: z.string(), layout: z.enum(["single", "aligned", "multline"]), numbered: z.boolean() }),
  z.object({ ...blockBase, type: z.literal("table"), columns: z.array(z.string()).min(1), rows: z.array(z.array(z.string())), header: z.boolean() }),
  z.object({ ...blockBase, type: z.literal("tikz"), source: z.string() }),
  z.object({ ...blockBase, type: z.literal("image"), source: z.string(), width: z.number().min(0.05).max(1), alt: z.string() }),
  z.object({ ...blockBase, type: z.literal("code"), language: z.string(), content: z.string() }),
  z.object({ ...blockBase, type: z.literal("rawTex"), source: z.string() }),
]);

export type Block = z.infer<typeof blockSchema>;

export const slideSchema = z.object({ id, title: z.string(), kind: z.enum(["title", "contents", "content"]), blocks: z.array(blockSchema) });
export type Slide = z.infer<typeof slideSchema>;
export const sectionSchema = z.object({ id, title: z.string(), slides: z.array(slideSchema) });

const packageName = z.string().regex(/^[A-Za-z0-9._-]+$/);

export const deckSchema = z.object({
  formatVersion: z.literal(3),
  metadata: z.object({ title: z.string(), subtitle: z.string(), author: z.string(), institute: z.string(), date: z.string() }),
  settings: z.object({
    sectionTitleSlides: z.boolean(),
    bodyFont: bodyFontSchema,
    packages: z.array(z.object({ name: packageName, options: z.string() })),
    tikzLibraries: z.array(packageName),
  }),
  sections: z.array(sectionSchema),
});

export type Deck = z.infer<typeof deckSchema>;
export type BodyFont = z.infer<typeof bodyFontSchema>;
export const createId = () => crypto.randomUUID();

export const richText = (text: string): RichTextDocument => ({
  type: "doc",
  content: [{ type: "paragraph", content: text ? [{ type: "text", text }] : [] }],
});

export const createDefaultDeck = (): Deck => ({
  formatVersion: 3,
  metadata: { title: "标题", subtitle: "副标题", author: "作者", institute: "南京大学", date: "\\today" },
  settings: { sectionTitleSlides: false, bodyFont: "song", packages: [], tikzLibraries: [] },
  sections: [{
    id: createId(),
    title: "第一部分",
    slides: [
      { id: createId(), title: "", kind: "title", blocks: [] },
      { id: createId(), title: "第一张幻灯片", kind: "content", blocks: [{ id: createId(), type: "text", hidden: false, fontSize: "normal", content: richText("从这里开始创作。") }] },
    ],
  }],
});
