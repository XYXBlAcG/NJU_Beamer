import type { Deck } from "./deck";

export type SupportedImageMimeType = "image/png" | "image/jpeg";

export type DocumentAsset = {
  path: string;
  mimeType: SupportedImageMimeType;
  content: number[];
};

export const referencedAssets = (deck: Deck, assets: DocumentAsset[]) => {
  const paths = new Set(
    deck.sections.flatMap((section) => section.slides).flatMap((slide) => slide.blocks)
      .filter((block) => block.type === "image")
      .map((block) => block.source),
  );
  return assets.filter((asset) => paths.has(asset.path));
};

export const documentJson = (deck: Deck) => `${JSON.stringify(deck, null, 2)}\n`;
