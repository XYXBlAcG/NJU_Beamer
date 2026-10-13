import { describe, expect, it } from "vitest";
import { createDefaultDeck, deckSchema } from "./deck";
import { serializeDeck } from "./serialize";

describe("page dimensions", () => {
  it("migrates a v4 aspectratio into structured dimensions", () => {
    const source = { ...createDefaultDeck(), formatVersion: 4 };
    source.settings.documentClassOptions = "aspectratio=169,handout";
    const deck = deckSchema.parse(source);
    expect(deck.settings.pageSize.preset).toBe("16:9");
    expect(deck.settings.documentClassOptions).toBe("handout");
  });

  it("emits one authoritative ratio and custom millimetre dimensions", () => {
    const deck = createDefaultDeck();
    deck.settings.pageSize = { preset: "16:9", widthMm: 160, heightMm: 90 };
    expect(serializeDeck(deck)).toContain("\\documentclass[aspectratio=169]{beamer}");
    deck.settings.pageSize = { preset: "custom", widthMm: 180, heightMm: 100 };
    expect(serializeDeck(deck)).toContain("\\geometry{paperwidth=180mm,paperheight=100mm}");
  });
});
