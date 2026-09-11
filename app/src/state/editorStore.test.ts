import { beforeEach, describe, expect, it } from "vitest";
import { createDefaultDeck } from "../domain/deck";
import { useEditorStore } from "./editorStore";

describe("editorStore sections", () => {
  beforeEach(() => useEditorStore.getState().setDocument(createDefaultDeck(), []));

  it("creates a section with a selected initial slide", () => {
    useEditorStore.getState().addSection();

    const state = useEditorStore.getState();
    expect(state.deck.sections).toHaveLength(2);
    expect(state.deck.sections[1].slides).toHaveLength(1);
    expect(state.selectedSlideId).toBe(state.deck.sections[1].slides[0].id);
  });

  it("adds a slide to the selected section", () => {
    useEditorStore.getState().addSection();
    const firstSection = useEditorStore.getState().deck.sections[0];
    useEditorStore.getState().selectSlide(firstSection.slides[0].id);
    useEditorStore.getState().addSlide();

    expect(useEditorStore.getState().deck.sections[0].slides).toHaveLength(3);
    expect(useEditorStore.getState().deck.sections[1].slides).toHaveLength(1);
  });

  it("adds a slide to the last section when selection is unavailable", () => {
    useEditorStore.setState({ selectedSlideId: "missing-slide" });
    useEditorStore.getState().addSlide();

    const sections = useEditorStore.getState().deck.sections;
    expect(sections.at(-1)?.slides).toHaveLength(3);
    expect(sections.at(-1)?.slides.at(-1)?.id).toBe(useEditorStore.getState().selectedSlideId);
  });
});

describe("editorStore document assets", () => {
  beforeEach(() => useEditorStore.getState().setDocument(createDefaultDeck(), []));

  it("adds an imported asset and image block as one edit", () => {
    const state = useEditorStore.getState();
    state.selectSlide(state.deck.sections[0].slides[1].id);
    state.addImage({ path: "pic/new.png", mimeType: "image/png", content: [1, 2, 3] });

    const result = useEditorStore.getState();
    expect(result.assets).toHaveLength(1);
    expect(result.deck.sections[0].slides[1].blocks.at(-1)).toMatchObject({ type: "image", source: "pic/new.png" });
    expect(result.revision).toBe(1);
  });

  it("reorders blocks directly by source and target ids", () => {
    const state = useEditorStore.getState();
    state.selectSlide(state.deck.sections[0].slides[1].id);
    state.addBlock("formula");
    state.addBlock("tikz");
    const blocks = useEditorStore.getState().deck.sections[0].slides[1].blocks;

    useEditorStore.getState().reorderBlock(blocks[2].id, blocks[0].id);

    expect(useEditorStore.getState().deck.sections[0].slides[1].blocks.map((block) => block.id)).toEqual([blocks[2].id, blocks[0].id, blocks[1].id]);
  });

  it("resets the revision when loading a document", () => {
    useEditorStore.getState().addSection();
    expect(useEditorStore.getState().revision).toBe(1);

    useEditorStore.getState().setDocument(createDefaultDeck(), [], "/tmp/deck.njub");
    expect(useEditorStore.getState().revision).toBe(0);
  });
});
