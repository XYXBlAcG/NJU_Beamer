import type { Block, Deck, RichTextNode } from "./deck";
import { parseMixedText } from "./mixedText";

export type DeckDiagnostic = { slideId: string; blockId?: string; message: string };

const richStrings = (nodes: RichTextNode[] = []): string[] => nodes.flatMap((node) => [
  ...(node.text === undefined ? [] : [node.text]),
  ...(node.type === "footnote" ? [String(node.attrs?.text ?? "")] : []),
  ...richStrings(node.content),
]);

const blockStrings = (block: Block): string[] => {
  if (block.type === "text" || block.type === "callout") return richStrings(block.content.content);
  if (block.type === "list") return block.items;
  if (block.type === "table") return [...block.columns, ...block.rows.flat()];
  return [];
};

const inspectBlocks = (slideId: string, blocks: Block[]): DeckDiagnostic[] => blocks.flatMap((block) => [
  ...blockStrings(block).flatMap((value) => parseMixedText(value).issues.map((issue) => ({ slideId, blockId: block.id, message: `${issue.message}（字符 ${issue.offset + 1}）` }))),
  ...(block.type === "columns" ? block.columns.flatMap((column) => inspectBlocks(slideId, column.blocks)) : []),
]);

export const validateDeckContent = (deck: Deck): DeckDiagnostic[] => deck.sections.flatMap((section) => section.slides.flatMap((slide) => [
  ...parseMixedText(slide.notes).issues.map((issue) => ({ slideId: slide.id, message: `备注：${issue.message}（字符 ${issue.offset + 1}）` })),
  ...inspectBlocks(slide.id, slide.blocks),
]));
