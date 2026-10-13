import { createId, richText, type Block } from "./deck";

export type InsertableBlockType = Exclude<Block["type"], "image">;

export const newBlock = (type: InsertableBlockType): Block => {
  const id = createId();
  const base = { id, hidden: false, fontSize: "normal" as const, appearance: "none" as const };
  switch (type) {
    case "text": return { ...base, type, content: richText("文本") };
    case "list": return { ...base, type, ordered: false, reveal: "none", items: ["列表项"] };
    case "formula": return { ...base, type, latex: "E = mc^2", layout: "single", numbered: false };
    case "table": return { ...base, type, columns: ["列 1", "列 2"], rows: [["内容", "内容"]], header: true };
    case "tikz": return { ...base, type, source: "\\draw[->] (0,0) -- (2,0);" };
    case "code": return { ...base, type, language: "Python", content: "print(\"Hello, NJU\")" };
    case "rawTex": return { ...base, type, source: "\\textbf{TeX 内容}" };
    case "callout": return { ...base, type, style: "block", title: "提示", content: richText("内容") };
    case "columns": return { ...base, type, alignment: "top", columns: [
      { id: createId(), width: 0.48, blocks: [newBlock("text")] },
      { id: createId(), width: 0.48, blocks: [newBlock("text")] },
    ] };
  }
};

export const updateNestedBlock = (blocks: Block[], blockId: string, replacement?: Block): Block[] => blocks.flatMap((block) => {
  if (block.id === blockId) return replacement ? [replacement] : [];
  if (block.type !== "columns") return [block];
  return [{ ...block, columns: block.columns.map((column) => ({ ...column, blocks: updateNestedBlock(column.blocks, blockId, replacement) })) }];
});

export const blockContainer = (blocks: Block[], blockId: string): Block[] | undefined => {
  if (blocks.some((block) => block.id === blockId)) return blocks;
  for (const block of blocks) if (block.type === "columns") for (const column of block.columns) {
    const found = blockContainer(column.blocks, blockId);
    if (found) return found;
  }
  return undefined;
};

export const appendToColumn = (blocks: Block[], columnId: string, block: Block): Block[] => blocks.map((item) => item.type === "columns" ? {
  ...item,
  columns: item.columns.map((column) => column.id === columnId
    ? { ...column, blocks: [...column.blocks, block] }
    : { ...column, blocks: appendToColumn(column.blocks, columnId, block) }),
} : item);

export const cloneBlock = (block: Block): Block => block.type === "columns"
  ? { ...structuredClone(block), id: createId(), label: undefined, columns: block.columns.map((column) => ({ ...column, id: createId(), blocks: column.blocks.map(cloneBlock) })) }
  : { ...structuredClone(block), id: createId(), label: undefined };

export const duplicateContentBlock = (blocks: Block[], id: string): Block[] => blocks.flatMap((block) => block.id === id ? [block, cloneBlock(block)] : block.type === "columns" ? [{ ...block, columns: block.columns.map((column) => ({ ...column, blocks: duplicateContentBlock(column.blocks, id) })) }] : [block]);

export const moveContentBlock = (input: Block[], activeId: string, overId: string): Block[] => {
  if (activeId === overId) return input;
  const blocks = structuredClone(input);
  const source = blockContainer(blocks, activeId);
  const target = blockContainer(blocks, overId);
  if (!source || !target) return input;
  const index = source.findIndex((block) => block.id === activeId);
  const contains = (block: Block): boolean => block.id === overId || (block.type === "columns" && block.columns.some((column) => column.blocks.some(contains)));
  if (contains(source[index])) return input;
  const [active] = source.splice(index, 1);
  const targetIndex = target.findIndex((block) => block.id === overId);
  if (targetIndex < 0) return input;
  target.splice(targetIndex, 0, active);
  return blocks;
};
