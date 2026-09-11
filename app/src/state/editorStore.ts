import { create } from "zustand";
import { createDefaultDeck, createId, richText, type Block, type Deck, type Slide } from "../domain/deck";
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
  updateSlide: (slideId: string, update: Partial<Pick<Slide, "title" | "kind">>) => void;
  addSection: () => void;
  addSlide: (sectionId?: string) => void;
  moveSlide: (direction: -1 | 1) => void;
  removeSlide: () => void;
  addBlock: (type: InsertableBlockType) => void;
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
  switch (type) {
    case "text": return { id, type, hidden: false, fontSize: "normal", content: richText("文本") };
    case "list": return { id, type, hidden: false, fontSize: "normal", ordered: false, reveal: "none", items: ["列表项"] };
    case "formula": return { id, type, hidden: false, fontSize: "normal", latex: "E = mc^2", layout: "single", numbered: false };
    case "table": return { id, type, hidden: false, fontSize: "normal", columns: ["列 1", "列 2"], rows: [["内容", "内容"]], header: true };
    case "tikz": return { id, type, hidden: false, fontSize: "normal", source: "\\draw[->] (0,0) -- (2,0);" };
    case "code": return { id, type, hidden: false, fontSize: "normal", language: "Python", content: "print(\"Hello, NJU\")" };
    case "rawTex": return { id, type, hidden: false, fontSize: "normal", source: "\\begin{block}{标题}\n内容\n\\end{block}" };
  }
};

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
    const slide: Slide = { id: createId(), title: "新幻灯片", kind: "content", blocks: [] };
    return {
      deck: { ...state.deck, sections: [...state.deck.sections, { id: createId(), title: "新章节", slides: [slide] }] },
      selectedSlideId: slide.id,
      revision: state.revision + 1,
    };
  }),
  addSlide: (sectionId) => set((state) => {
    const slide: Slide = { id: createId(), title: "新幻灯片", kind: "content", blocks: [] };
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
  addImage: (asset, alt = "图片") => set((state) => ({
    assets: [...state.assets.filter((item) => item.path !== asset.path), asset],
    deck: mapSelectedSlide(state.deck, state.selectedSlideId, (slide) => ({ ...slide, blocks: [...slide.blocks, { id: createId(), type: "image", hidden: false, fontSize: "normal", source: asset.path, width: 0.8, alt }] })),
    revision: state.revision + 1,
  })),
  updateBlock: (blockId, block) => set((state) => ({ deck: mapSelectedSlide(state.deck, state.selectedSlideId, (slide) => ({ ...slide, blocks: slide.blocks.map((item) => item.id === blockId ? block : item) })), revision: state.revision + 1 })),
  reorderBlock: (activeId, overId) => set((state) => ({ deck: mapSelectedSlide(state.deck, state.selectedSlideId, (slide) => {
    const index = slide.blocks.findIndex((block) => block.id === activeId);
    const target = slide.blocks.findIndex((block) => block.id === overId);
    if (index < 0 || target < 0 || index === target) return slide;
    const blocks = [...slide.blocks];
    const [active] = blocks.splice(index, 1);
    blocks.splice(target, 0, active);
    return { ...slide, blocks };
  }), revision: state.revision + 1 })),
  removeBlock: (blockId) => set((state) => ({ deck: mapSelectedSlide(state.deck, state.selectedSlideId, (slide) => ({ ...slide, blocks: slide.blocks.filter((item) => item.id !== blockId) })), revision: state.revision + 1 })),
}));
