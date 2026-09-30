import { create } from "zustand";
import { createDefaultDeck, createId, defaultFrameOptions, richText, type Block, type Deck, type Slide } from "../domain/deck";
import type { DocumentAsset } from "../domain/document";

type InsertableBlockType = Exclude<Block["type"], "image">;

type EditorState = {
  deck: Deck;
  assets: DocumentAsset[];
  revision: number;
  selectedSlideId: string;
  documentPath?: string;
  workspace: string;
  setDocument: (deck: Deck, assets: DocumentAsset[], documentPath?: string) => void;
  setWorkspace: (workspace: string) => void;
  selectSlide: (id: string) => void;
  updateMetadata: (key: keyof Deck["metadata"], value: string) => void;
  updateSettings: (settings: Partial<Deck["settings"]>) => void;
  updateSection: (sectionId: string, title: string) => void;
  updateSlide: (slideId: string, update: Partial<Pick<Slide, "title" | "kind" | "frame" | "notes">>) => void;
  addSection: () => void;
  addSlide: (sectionId?: string) => void;
  moveSlide: (direction: -1 | 1) => void;
  removeSlide: () => void;
  addBlock: (type: InsertableBlockType) => void;
  addBlockToColumn: (columnId: string, type: InsertableBlockType) => void;
  addImage: (asset: DocumentAsset, alt?: string) => void;
  updateBlock: (blockId: string, block: Block) => void;
  reorderBlock: (activeId: string, overId: string) => void;
  removeBlock: (blockId: string) => void;
  setDocumentPath: (path: string) => void;
};

const initialDeck = createDefaultDeck();

const mapSelectedSlide = (deck: Deck, selectedSlideId: string, update: (slide: Slide) => Slide): Deck => ({
  ...deck,
  sections: deck.sections.map((section) => ({
    ...section,
    slides: section.slides.map((slide) => (slide.id === selectedSlideId ? update(slide) : slide)),
  })),
});

const newBlock = (type: InsertableBlockType): Block => {
  const id = createId();
  const base = { id, hidden: false, fontSize: "normal" as const, appearance: "none" as const };
  switch (type) {
    case "text": return { ...base, type, content: richText("文本") };
    case "list": return { ...base, type, ordered: false, reveal: "none", items: ["列表项"] };
    case "formula": return { ...base, type, latex: "E = mc^2", layout: "single", numbered: false };
    case "table": return { ...base, type, columns: ["列 1", "列 2"], rows: [["内容", "内容"]], header: true };
    case "tikz": return { ...base, type, source: "\\draw[->] (0,0) -- (2,0);" };
    case "code": return { ...base, type, language: "Python", content: "print(\"Hello, NJU\")" };
    case "rawTex": return { ...base, type, source: "\\begin{block}{标题}\n内容\n\\end{block}" };
    case "callout": return { ...base, type, style: "block", title: "提示", content: richText("内容") };
    case "columns": return { ...base, type, alignment: "top", columns: [
      { id: createId(), width: 0.48, blocks: [newBlock("text")] },
      { id: createId(), width: 0.48, blocks: [newBlock("text")] },
    ] };
  }
};

const updateNestedBlock = (blocks: Block[], blockId: string, replacement?: Block): Block[] => blocks.flatMap((block) => {
  if (block.id === blockId) return replacement ? [replacement] : [];
  if (block.type !== "columns") return [block];
  return [{ ...block, columns: block.columns.map((column) => ({ ...column, blocks: updateNestedBlock(column.blocks, blockId, replacement) })) }];
});

const blockContainer = (blocks: Block[], blockId: string): Block[] | undefined => {
  if (blocks.some((block) => block.id === blockId)) return blocks;
  for (const block of blocks) if (block.type === "columns") for (const column of block.columns) {
    const found = blockContainer(column.blocks, blockId);
    if (found) return found;
  }
  return undefined;
};

const appendToColumn = (blocks: Block[], columnId: string, block: Block): Block[] => blocks.map((item) => item.type === "columns" ? {
  ...item,
  columns: item.columns.map((column) => column.id === columnId
    ? { ...column, blocks: [...column.blocks, block] }
    : { ...column, blocks: appendToColumn(column.blocks, columnId, block) }),
} : item);

export const useEditorStore = create<EditorState>((set) => ({
  deck: initialDeck,
  assets: [],
  revision: 0,
  selectedSlideId: initialDeck.sections[0].slides[0].id,
  workspace: "",
  setDocument: (deck, assets, documentPath) => set({ deck, assets, documentPath, revision: 0, selectedSlideId: deck.sections[0]?.slides[0]?.id ?? "" }),
  setWorkspace: (workspace) => set({ workspace }),
  selectSlide: (selectedSlideId) => set({ selectedSlideId }),
  setDocumentPath: (documentPath) => set({ documentPath }),
  updateMetadata: (key, value) => set((state) => ({ deck: { ...state.deck, metadata: { ...state.deck.metadata, [key]: value } }, revision: state.revision + 1 })),
  updateSettings: (settings) => set((state) => ({ deck: { ...state.deck, settings: { ...state.deck.settings, ...settings } }, revision: state.revision + 1 })),
  updateSection: (sectionId, title) => set((state) => ({ deck: { ...state.deck, sections: state.deck.sections.map((section) => section.id === sectionId ? { ...section, title } : section) }, revision: state.revision + 1 })),
  updateSlide: (slideId, update) => set((state) => ({ deck: mapSelectedSlide(state.deck, slideId, (slide) => ({ ...slide, ...update })), revision: state.revision + 1 })),
  addSection: () => set((state) => {
    const slide: Slide = { id: createId(), title: "新幻灯片", kind: "content", blocks: [], frame: { ...defaultFrameOptions }, notes: "" };
    return {
      deck: { ...state.deck, sections: [...state.deck.sections, { id: createId(), title: "新章节", slides: [slide] }] },
      selectedSlideId: slide.id,
      revision: state.revision + 1,
    };
  }),
  addSlide: (sectionId) => set((state) => {
    const slide: Slide = { id: createId(), title: "新幻灯片", kind: "content", blocks: [], frame: { ...defaultFrameOptions }, notes: "" };
    const selectedSectionId = sectionId
      ?? state.deck.sections.find((section) => section.slides.some((item) => item.id === state.selectedSlideId))?.id
      ?? state.deck.sections.at(-1)?.id;
    const sections = state.deck.sections.length
      ? state.deck.sections.map((section) => section.id === selectedSectionId ? { ...section, slides: [...section.slides, slide] } : section)
      : [{ id: createId(), title: "内容", slides: [slide] }];
    return { deck: { ...state.deck, sections }, selectedSlideId: slide.id, revision: state.revision + 1 };
  }),
  moveSlide: (direction) => set((state) => ({
    deck: {
      ...state.deck,
      sections: state.deck.sections.map((section) => {
        const index = section.slides.findIndex((slide) => slide.id === state.selectedSlideId);
        const target = index + direction;
        if (index < 0 || target < 0 || target >= section.slides.length) return section;
        const slides = [...section.slides];
        [slides[index], slides[target]] = [slides[target], slides[index]];
        return { ...section, slides };
      }),
    },
    revision: state.revision + 1,
  })),
  removeSlide: () => set((state) => {
    const slides = state.deck.sections.flatMap((section) => section.slides);
    if (slides.length <= 1) return state;
    const index = slides.findIndex((slide) => slide.id === state.selectedSlideId);
    const selectedSlideId = slides[index + 1]?.id ?? slides[index - 1].id;
    return {
      deck: { ...state.deck, sections: state.deck.sections.map((section) => ({ ...section, slides: section.slides.filter((slide) => slide.id !== state.selectedSlideId) })) },
      selectedSlideId,
      revision: state.revision + 1,
    };
  }),
  addBlock: (type) => set((state) => ({ deck: mapSelectedSlide(state.deck, state.selectedSlideId, (slide) => ({ ...slide, blocks: [...slide.blocks, newBlock(type)] })), revision: state.revision + 1 })),
  addBlockToColumn: (columnId, type) => set((state) => ({ deck: mapSelectedSlide(state.deck, state.selectedSlideId, (slide) => ({ ...slide, blocks: appendToColumn(slide.blocks, columnId, newBlock(type)) })), revision: state.revision + 1 })),
  addImage: (asset, alt = "图片") => set((state) => ({
    assets: [...state.assets.filter((item) => item.path !== asset.path), asset],
    deck: mapSelectedSlide(state.deck, state.selectedSlideId, (slide) => ({ ...slide, blocks: [...slide.blocks, { id: createId(), type: "image", hidden: false, fontSize: "normal", appearance: "none", source: asset.path, width: 0.8, alt }] })),
    revision: state.revision + 1,
  })),
  updateBlock: (blockId, block) => set((state) => ({ deck: mapSelectedSlide(state.deck, state.selectedSlideId, (slide) => ({ ...slide, blocks: updateNestedBlock(slide.blocks, blockId, block) })), revision: state.revision + 1 })),
  reorderBlock: (activeId, overId) => set((state) => ({ deck: mapSelectedSlide(state.deck, state.selectedSlideId, (slide) => {
    if (activeId === overId) return slide;
    const blocks = structuredClone(slide.blocks);
    const source = blockContainer(blocks, activeId);
    const target = blockContainer(blocks, overId);
    if (!source || !target) return slide;
    const index = source.findIndex((block) => block.id === activeId);
    const [active] = source.splice(index, 1);
    const targetIndex = target.findIndex((block) => block.id === overId);
    if (!active || targetIndex < 0) return slide;
    target.splice(targetIndex, 0, active);
    return { ...slide, blocks };
  }), revision: state.revision + 1 })),
  removeBlock: (blockId) => set((state) => ({ deck: mapSelectedSlide(state.deck, state.selectedSlideId, (slide) => ({ ...slide, blocks: updateNestedBlock(slide.blocks, blockId) })), revision: state.revision + 1 })),
}));
