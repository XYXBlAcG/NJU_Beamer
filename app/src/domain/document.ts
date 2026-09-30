import type { Block, Deck } from "./deck";

export type SupportedImageMimeType = "image/png" | "image/jpeg";

export type DocumentAsset = {
  path: string;
  mimeType: SupportedImageMimeType;
  content: number[];
};

export const referencedAssetPaths = (deck: Deck) => {
  const imagePaths = (blocks: Block[]): string[] => blocks.flatMap((block) => block.type === "image"
    ? [block.source]
    : block.type === "columns" ? block.columns.flatMap((column) => imagePaths(column.blocks)) : []);
  return new Set(deck.sections.flatMap((section) => section.slides).flatMap((slide) => imagePaths(slide.blocks)));
};

export const referencedAssets = (deck: Deck, assets: DocumentAsset[]) => {
  const paths = referencedAssetPaths(deck);
  return assets.filter((asset) => paths.has(asset.path));
};

export const documentJson = (deck: Deck) => `${JSON.stringify(deck, null, 2)}\n`;
