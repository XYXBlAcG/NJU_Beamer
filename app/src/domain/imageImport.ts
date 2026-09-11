import type { DocumentAsset, SupportedImageMimeType } from "./document";

export const imageExtension = (mimeType: string) => {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/jpeg") return "jpg";
  throw new Error("仅支持 PNG 或 JPEG 图片。");
};

export const importImageFile = async (file: File): Promise<DocumentAsset> => {
  const extension = imageExtension(file.type);
  return {
    path: `pic/${crypto.randomUUID()}.${extension}`,
    mimeType: file.type as SupportedImageMimeType,
    content: Array.from(new Uint8Array(await file.arrayBuffer())),
  };
};
