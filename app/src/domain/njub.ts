import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { deckSchema, type Deck } from "./deck";
import { documentJson, referencedAssetPaths, referencedAssets, type DocumentAsset, type SupportedImageMimeType } from "./document";

const assetPathPattern = /^pic\/[^/]+\.(png|jpe?g)$/i;

const mimeTypeFor = (path: string): SupportedImageMimeType => path.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";

const validateAsset = (asset: DocumentAsset) => {
  if (!assetPathPattern.test(asset.path)) throw new Error(`无效的图片资源路径：${asset.path}`);
  if (asset.mimeType !== mimeTypeFor(asset.path)) throw new Error(`图片类型与扩展名不一致：${asset.path}`);
  const bytes = asset.content;
  const png = [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value);
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if ((asset.mimeType === "image/png" && !png) || (asset.mimeType === "image/jpeg" && !jpeg)) throw new Error(`图片内容与类型不一致：${asset.path}`);
};

const ensureReferencedAssets = (deck: Deck, assets: DocumentAsset[]) => {
  const available = new Set(assets.map((asset) => asset.path));
  const missing = [...referencedAssetPaths(deck)].filter((path) => !available.has(path));
  if (missing.length) throw new Error(`缺少图片资源：${[...new Set(missing)].join(", ")}`);
};

export const encodeNjub = (input: Deck, inputAssets: DocumentAsset[]): Uint8Array => {
  const deck = deckSchema.parse(input);
  const assets = referencedAssets(deck, inputAssets).sort((left, right) => left.path.localeCompare(right.path));
  assets.forEach(validateAsset);
  ensureReferencedAssets(deck, assets);
  const entries: Record<string, Uint8Array> = {
    "document.json": strToU8(documentJson(deck)),
    "pic/": new Uint8Array(),
  };
  for (const asset of assets) entries[asset.path] = new Uint8Array(asset.content);
  return zipSync(entries, { level: 6 });
};

export const decodeNjub = (content: Uint8Array): { deck: Deck; assets: DocumentAsset[] } => {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(content);
  } catch (error) {
    throw new Error(`无法读取 NJUB ZIP：${error instanceof Error ? error.message : String(error)}`);
  }
  for (const path of Object.keys(entries)) {
    if (path !== "document.json" && path !== "pic/" && !assetPathPattern.test(path)) throw new Error(`不允许的归档条目：${path}`);
  }
  const document = entries["document.json"];
  if (!document) throw new Error("文稿中缺少 document.json");
  let deck: Deck;
  try {
    deck = deckSchema.parse(JSON.parse(strFromU8(document)));
  } catch (error) {
    throw new Error(`document.json 无效：${error instanceof Error ? error.message : String(error)}`);
  }
  const assets = Object.entries(entries)
    .filter(([path]) => assetPathPattern.test(path))
    .map(([path, bytes]) => ({ path, mimeType: mimeTypeFor(path), content: Array.from(bytes) }))
    .sort((left, right) => left.path.localeCompare(right.path));
  assets.forEach(validateAsset);
  ensureReferencedAssets(deck, assets);
  return { deck, assets };
};

export const documentSummary = (deck: Deck, assets: DocumentAsset[]) => ({
  formatVersion: deck.formatVersion,
  title: deck.metadata.title,
  sections: deck.sections.length,
  slides: deck.sections.reduce((count, section) => count + section.slides.length, 0),
  blocks: deck.sections.reduce((count, section) => count + section.slides.reduce((slideCount, slide) => {
    const countBlocks = (blocks: typeof slide.blocks): number => blocks.reduce((blockCount, block) => blockCount + 1
      + (block.type === "columns" ? block.columns.reduce((columnCount, column) => columnCount + countBlocks(column.blocks), 0) : 0), 0);
    return slideCount + countBlocks(slide.blocks);
  }, 0), 0),
  assets: assets.length,
});
