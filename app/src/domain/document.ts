import type { Block, Deck } from "./deck";
import { z } from "zod";
import type { Paper } from "./paper";

export const assetPathPattern = /^pic\/[^/]+\.(png|jpe?g)$/i;
const imageMimeSchema = z.enum(["image/png", "image/jpeg"]);
export type SupportedImageMimeType = z.infer<typeof imageMimeSchema>;
export const documentAssetSchema = z.object({ path: z.string().regex(assetPathPattern), mimeType: imageMimeSchema, content: z.array(z.number().int().min(0).max(255)) }).superRefine((asset, context) => {
  const mime = asset.path.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
  const validBytes = asset.mimeType === "image/png" ? [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => asset.content[index] === value) : asset.content[0] === 255 && asset.content[1] === 216 && asset.content[2] === 255;
  if (mime !== asset.mimeType || !validBytes) context.addIssue({ code: "custom", message: `图片内容与类型不一致：${asset.path}` });
});
export type DocumentAsset = z.infer<typeof documentAssetSchema>;
export type NjubDocument = { deck: Deck; assets: DocumentAsset[] };
export type DocumentContent = Deck | Paper;
export type NjubArchive = NjubDocument | { paper: Paper; assets: DocumentAsset[] };
export const archiveContent = (document: NjubArchive): DocumentContent => "paper" in document ? document.paper : document.deck;

export const referencedAssetPaths = (deck: DocumentContent) => {
  const imagePaths = (blocks: Block[]): string[] => blocks.flatMap((block) => block.type === "image"
    ? [block.source]
    : block.type === "columns" ? block.columns.flatMap((column) => imagePaths(column.blocks)) : []);
  return new Set("kind" in deck ? deck.sections.flatMap((section) => imagePaths(section.blocks)) : deck.sections.flatMap((section) => section.slides).flatMap((slide) => imagePaths(slide.blocks)));
};

export const referencedAssets = (deck: DocumentContent, assets: DocumentAsset[]) => {
  const paths = referencedAssetPaths(deck);
  return assets.filter((asset) => paths.has(asset.path));
};

export const documentJson = (deck: DocumentContent) => `${JSON.stringify(deck, null, 2)}\n`;
