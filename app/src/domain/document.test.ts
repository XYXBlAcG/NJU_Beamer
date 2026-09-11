import { describe, expect, it } from "vitest";
import { createDefaultDeck } from "./deck";
import { referencedAssets, type DocumentAsset } from "./document";

describe("referencedAssets", () => {
  it("keeps only assets referenced by image blocks", () => {
    const deck = createDefaultDeck();
    deck.sections[0].slides[1].blocks = [
      { id: "image", type: "image", hidden: false, fontSize: "normal", source: "pic/used.png", width: 0.5, alt: "used" },
    ];
    const assets: DocumentAsset[] = [
      { path: "pic/used.png", mimeType: "image/png", content: [1] },
      { path: "pic/unused.jpg", mimeType: "image/jpeg", content: [2] },
    ];

    expect(referencedAssets(deck, assets)).toEqual([assets[0]]);
  });
});
