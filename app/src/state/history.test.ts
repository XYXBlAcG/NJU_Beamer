import { beforeEach, expect, it } from "vitest";
import { createDefaultDeck } from "../domain/deck";
import { createDefaultPaper } from "../domain/paper";
import { newBlock } from "../domain/blocks";
import { copyPages, pastePages } from "../domain/pages";
import { useEditorStore } from "./editorStore";

beforeEach(() => useEditorStore.getState().setDocument(createDefaultDeck(), []));
it("undoes document edits and truncates redo on a new edit", () => {
  const title = useEditorStore.getState().deck.metadata.title;
  useEditorStore.getState().updateMetadata("title", "新标题");
  useEditorStore.getState().undo();
  expect(useEditorStore.getState().deck.metadata.title).toBe(title);
  useEditorStore.getState().redo();
  expect(useEditorStore.getState().deck.metadata.title).toBe("新标题");
  useEditorStore.getState().undo();
  useEditorStore.getState().addSection();
  expect(useEditorStore.getState().future).toHaveLength(0);
});
it("duplicates slides with independent nested identifiers", () => {
  const state = useEditorStore.getState();
  state.selectSlide(state.deck.sections[0].slides[1].id);
  const result = pastePages(state.deck, state.assets, copyPages(state.deck, state.assets, [state.deck.sections[0].slides[1].id]), state.deck.sections[0].slides[1].id);
  state.applyContent(result.content, result.assets, result.ids[0]);
  const slides = useEditorStore.getState().deck.sections[0].slides;
  expect(slides).toHaveLength(3);
  expect(slides[2].blocks[0].id).not.toBe(slides[1].blocks[0].id);
  useEditorStore.getState().undo();
  expect(useEditorStore.getState().deck.sections[0].slides).toHaveLength(2);
});

it("inserts shared presets into papers and undoes their library changes", () => {
  const paper = createDefaultPaper();
  const deck = useEditorStore.getState().deck;
  useEditorStore.getState().setPaperDocument(paper, []);
  const block = newBlock("tikz");
  useEditorStore.getState().insertBlock(block, ["arrows.meta"]);
  expect(useEditorStore.getState().paper?.sections[0].blocks.at(-1)).toEqual(block);
  expect(useEditorStore.getState().paper?.settings.tikzLibraries).toEqual(["arrows.meta"]);
  expect(useEditorStore.getState().deck).toBe(deck);
  useEditorStore.getState().undo();
  expect(useEditorStore.getState().paper).toEqual(paper);
});
