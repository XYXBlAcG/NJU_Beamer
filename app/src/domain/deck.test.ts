import { describe, expect, it } from "vitest";
import { createDefaultDeck, deckSchema } from "./deck";

describe("deckSchema v4", () => {
  it("migrates an existing v3 document at the single read boundary", () => {
    const existing = structuredClone(createDefaultDeck()) as unknown as {
      formatVersion: number;
      settings: Record<string, unknown>;
      sections: Array<{ slides: Array<Record<string, unknown> & { blocks: Array<Record<string, unknown>> }> }>;
    };
    existing.formatVersion = 3;
    delete existing.settings.mathFont;
    delete existing.settings.theme;
    delete existing.settings.documentClassOptions;
    delete existing.settings.preamble;
    for (const section of existing.sections) for (const slide of section.slides) {
      delete slide.frame;
      delete slide.notes;
      for (const block of slide.blocks) delete block.appearance;
    }

    const migrated = deckSchema.parse(existing);

    expect(migrated.formatVersion).toBe(4);
    expect(migrated.sections[0].slides[0]).toMatchObject({ frame: { plain: false, allowFrameBreaks: false, shrink: false, label: "" }, notes: "" });
    expect(migrated.sections[0].slides[1].blocks[0]).toMatchObject({ appearance: "none" });
    expect(migrated.settings).toMatchObject({
      mathFont: { preset: "latin-modern", customName: "" },
      theme: { mode: "nju", name: "", colorTheme: "", fontTheme: "", innerTheme: "", outerTheme: "" },
      documentClassOptions: "",
      preamble: "",
    });
  });

  it("rejects overlays on automatically split frames", () => {
    const deck = createDefaultDeck();
    deck.sections[0].slides[1].frame.allowFrameBreaks = true;
    deck.sections[0].slides[1].blocks[0].appearance = "uncover";

    expect(() => deckSchema.parse(deck)).toThrow("自动分页页面不能使用逐项或逐块显示");
  });

  it("rejects column widths whose sum exceeds the frame width", () => {
    const deck = createDefaultDeck();
    deck.sections[0].slides[1].blocks = [{
      id: "columns",
      type: "columns",
      hidden: false,
      fontSize: "normal",
      appearance: "none",
      alignment: "top",
      columns: [
        { id: "left", width: 0.6, blocks: [] },
        { id: "right", width: 0.6, blocks: [] },
      ],
    }];

    expect(() => deckSchema.parse(deck)).toThrow("分栏宽度总和不能超过 1");
  });
});
