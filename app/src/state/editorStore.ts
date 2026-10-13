import { create } from "zustand";
import { createDefaultDeck, createId, defaultFrameOptions, richText, type Block, type Deck, type Slide } from "../domain/deck";
import type { DocumentAsset, DocumentContent } from "../domain/document";
import { documentPages } from "../domain/pages";
import { newBlock, updateNestedBlock, appendToColumn, duplicateContentBlock, moveContentBlock, type InsertableBlockType } from "../domain/blocks";
import type { Paper } from "../domain/paper";

type Snapshot = { deck: Deck; paper?: Paper; assets: DocumentAsset[]; selectedSlideId: string; selectedPageIds: string[] };

type EditorState = {
  hasDocument: boolean;
  applyContent: (content: DocumentContent, assets?: DocumentAsset[], selectedId?: string) => void;
  deck: Deck;
  paper?: Paper;
  setPaperDocument: (paper: Paper, assets: DocumentAsset[], documentPath?: string) => void;
  updatePaper: (paper: Paper, assets?: DocumentAsset[]) => void;
  assets: DocumentAsset[];
  revision: number;
  selectedSlideId: string;
  selectedPageIds: string[];
  selectPages: (ids: string[], primary?: string) => void;
  documentPath?: string;
  workspace: string;
  past: Snapshot[];
  future: Snapshot[];
  undo: () => void;
  redo: () => void;
  duplicateBlock: (id: string) => void;
  insertBlock: (block: Block, libraries?: string[]) => void;
  setDocument: (deck: Deck, assets: DocumentAsset[], documentPath?: string) => void;
  setWorkspace: (workspace: string) => void;
  selectSlide: (id: string) => void;
  updateMetadata: (key: keyof Deck["metadata"], value: string) => void;
  updateSettings: (settings: Partial<Deck["settings"]>) => void;
  updateSection: (sectionId: string, title: string) => void;
  updateSlide: (slideId: string, update: Partial<Pick<Slide, "title" | "kind" | "frame" | "notes" | "hidden">>) => void;
  addSection: () => void;
  addSlide: (sectionId?: string, kind?: "content" | "ending") => void;
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


export const useEditorStore = create<EditorState>((rawSet) => {
  const set: typeof rawSet = (update) => rawSet((state) => {
    const next = typeof update === "function" ? update(state) : update;
    if (next.revision !== undefined && next.revision > state.revision && next.past === undefined) {
      return { ...next, past: [...state.past, { deck: state.deck, paper: state.paper, assets: state.assets, selectedSlideId: state.selectedSlideId, selectedPageIds: state.selectedPageIds }].slice(-100), future: [] };
    }
    return next;
  });
  return {
  hasDocument: false,
  applyContent: (content, assets, selectedId) => set((state) => ({
    ...("kind" in content ? { paper: content } : { deck: content, paper: undefined }),
    assets: assets ?? state.assets,
    selectedSlideId: selectedId ?? (documentPages(content).some((page) => page.id === state.selectedSlideId) ? state.selectedSlideId : documentPages(content)[0]?.id ?? ""),
    selectedPageIds: [selectedId ?? (documentPages(content).some((page) => page.id === state.selectedSlideId) ? state.selectedSlideId : documentPages(content)[0]?.id ?? "")],
    revision: state.revision + 1,
  })),
  deck: initialDeck,
  assets: [],
  revision: 0,
  selectedSlideId: initialDeck.sections[0].slides[0].id,
  selectedPageIds: [],
  selectPages: (selectedPageIds, primary) => set({ selectedPageIds, selectedSlideId: primary ?? selectedPageIds.at(-1) ?? "" }),
  workspace: "",
  past: [], future: [],
  undo: () => rawSet((state) => {
    const snapshot = state.past.at(-1);
    return snapshot ? { ...snapshot, past: state.past.slice(0, -1), future: [...state.future, { deck: state.deck, paper: state.paper, assets: state.assets, selectedSlideId: state.selectedSlideId, selectedPageIds: state.selectedPageIds }], revision: state.revision + 1 } : state;
  }),
  redo: () => rawSet((state) => {
    const snapshot = state.future.at(-1);
    return snapshot ? { ...snapshot, future: state.future.slice(0, -1), past: [...state.past, { deck: state.deck, paper: state.paper, assets: state.assets, selectedSlideId: state.selectedSlideId, selectedPageIds: state.selectedPageIds }], revision: state.revision + 1 } : state;
  }),
  setDocument: (deck, assets, documentPath) => set({ hasDocument: true, deck, paper: undefined, assets, documentPath, revision: 0, past: [], future: [], selectedPageIds: [deck.sections[0]?.slides[0]?.id ?? ""], selectedSlideId: deck.sections[0]?.slides[0]?.id ?? "" }),
  setPaperDocument: (paper, assets, documentPath) => set({ hasDocument: true, paper, assets, documentPath, revision: 0, past: [], future: [], selectedPageIds: [paper.sections[0]?.id ?? ""], selectedSlideId: paper.sections[0]?.id ?? "" }),
  updatePaper: (paper, assets) => set((state) => ({ paper, assets: assets ?? state.assets, revision: state.revision + 1 })),
  duplicateBlock: (id) => set((state) => {
    return { deck: mapSelectedSlide(state.deck, state.selectedSlideId, (slide) => ({ ...slide, blocks: duplicateContentBlock(slide.blocks, id) })), revision: state.revision + 1 };
  }),
  insertBlock: (block, libraries = []) => set((state) => state.paper ? {
    paper: { ...state.paper, sections: state.paper.sections.map((section) => section.id === state.selectedSlideId ? { ...section, blocks: [...section.blocks, block] } : section), settings: { ...state.paper.settings, tikzLibraries: [...new Set([...state.paper.settings.tikzLibraries, ...libraries])] } }, revision: state.revision + 1,
  } : { deck: { ...mapSelectedSlide(state.deck, state.selectedSlideId, (slide) => ({ ...slide, blocks: [...slide.blocks, block] })), settings: { ...state.deck.settings, tikzLibraries: [...new Set([...state.deck.settings.tikzLibraries, ...libraries])] } }, revision: state.revision + 1 }),
  setWorkspace: (workspace) => set({ workspace }),
  selectSlide: (selectedSlideId) => set({ selectedSlideId, selectedPageIds: [selectedSlideId] }),
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
  addSlide: (sectionId, kind = "content") => set((state) => {
    const slide: Slide = { id: createId(), title: kind === "ending" ? "结尾页" : "新幻灯片", kind, blocks: kind === "ending" ? [{ ...newBlock("text"), type: "text", content: richText("Thanks") }] : [], frame: { ...defaultFrameOptions }, notes: "" };
    const selectedSectionId = sectionId
      ?? state.deck.sections.find((section) => section.slides.some((item) => item.id === state.selectedSlideId))?.id
      ?? state.deck.sections.at(-1)?.id;
    const sections = state.deck.sections.length
      ? state.deck.sections.map((section) => section.id === selectedSectionId ? { ...section, slides: [...section.slides, slide] } : section)
      : [{ id: createId(), title: "内容", slides: [slide] }];
    return { deck: { ...state.deck, sections }, selectedSlideId: slide.id, revision: state.revision + 1 };
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
    return { ...slide, blocks: moveContentBlock(slide.blocks, activeId, overId) };
  }), revision: state.revision + 1 })),
  removeBlock: (blockId) => set((state) => ({ deck: mapSelectedSlide(state.deck, state.selectedSlideId, (slide) => ({ ...slide, blocks: updateNestedBlock(slide.blocks, blockId) })), revision: state.revision + 1 })),
  };
});
