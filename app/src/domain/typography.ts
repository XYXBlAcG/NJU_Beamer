import { z } from "zod";

export const fontSizeSchema = z.enum(["tiny", "scriptsize", "footnotesize", "small", "normal", "large", "Large", "LARGE", "huge", "Huge"]);
export type FontSize = z.infer<typeof fontSizeSchema>;
const labels: Record<FontSize, string> = { tiny: "最小", scriptsize: "更小", footnotesize: "脚注大小", small: "小", normal: "正常", large: "大", Large: "更大", LARGE: "特大", huge: "超大", Huge: "最大" };
export const fontSizeOptions = fontSizeSchema.options.map(value => ({ value, label: labels[value] }));
export const documentColorsTex = "\\definecolor{njupurple}{HTML}{63065F}";
