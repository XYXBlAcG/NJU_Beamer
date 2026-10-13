import { z } from "zod";

export const pageSizeSchema = z.object({
  preset: z.enum(["4:3", "16:9", "16:10", "3:2", "custom"]),
  widthMm: z.number().min(50).max(1000),
  heightMm: z.number().min(50).max(1000),
});
export type PageSize = z.infer<typeof pageSizeSchema>;
export const defaultPageSize: PageSize = { preset: "4:3", widthMm: 128, heightMm: 96 };
export const pageSizes: Array<{ value: PageSize["preset"]; label: string; widthMm: number; heightMm: number; tex?: string }> = [
  { value: "4:3", label: "标准 · 4:3", widthMm: 128, heightMm: 96, tex: "43" },
  { value: "16:9", label: "宽屏 · 16:9", widthMm: 160, heightMm: 90, tex: "169" },
  { value: "16:10", label: "宽屏 · 16:10", widthMm: 160, heightMm: 100, tex: "1610" },
  { value: "3:2", label: "3:2", widthMm: 135, heightMm: 90, tex: "32" },
  { value: "custom", label: "自定义尺寸", widthMm: 160, heightMm: 90 },
];
export const pageRatio = (size: PageSize) => {
  const preset = pageSizes.find((entry) => entry.value === size.preset)!;
  return size.preset === "custom" ? size.widthMm / size.heightMm : preset.widthMm / preset.heightMm;
};
