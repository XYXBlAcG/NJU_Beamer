import type { BodyFont, TextFont } from "./deck";

const cjkFaces: Record<BodyFont, { regular: string; bold: string; syntheticBold: boolean }> = {
  song: { regular: "FandolSong-Regular.otf", bold: "FandolSong-Bold.otf", syntheticBold: false },
  hei: { regular: "FandolHei-Regular.otf", bold: "FandolHei-Bold.otf", syntheticBold: false },
  kai: { regular: "FandolKai-Regular.otf", bold: "FandolKai-Regular.otf", syntheticBold: true },
  fangsong: { regular: "FandolFang-Regular.otf", bold: "FandolFang-Regular.otf", syntheticBold: true },
};
const cjkFontOptions = (font: BodyFont) => {
  const face = cjkFaces[font];
  return `BoldFont=${face.bold},${face.syntheticBold ? "BoldFeatures={FakeBold=2}," : ""}ItalicFont=${face.regular},ItalicFeatures={FakeSlant=0.2},BoldItalicFont=${face.bold},BoldItalicFeatures={${face.syntheticBold ? "FakeBold=2," : ""}FakeSlant=0.2}`;
};
export const cjkFontSetup = (font: BodyFont) => {
  const face = cjkFaces[font];
  const options = cjkFontOptions(font);
  return ["main", "sans"].map((family) => `\\setCJK${family}font{${face.regular}}[${options}]`).join("\n");
};

export const blockFontSetup = (font: TextFont): string => {
  if (font.preset === "custom") return [font.customName.trim() && `\\fontspec{${font.customName.trim()}}`, font.cjkName.trim() && `\\CJKfontspec[AutoFakeBold=2,AutoFakeSlant=0.2]{${font.cjkName.trim()}}`].filter(Boolean).join("\n");
  const face = cjkFaces[font.preset];
  return `\\CJKfontspec[${cjkFontOptions(font.preset)}]{${face.regular}}`;
};

export const textFontOptions = [
  { value: "inherit" as const, label: "文稿字体" }, { value: "song" as const, label: "宋体" },
  { value: "hei" as const, label: "黑体" }, { value: "kai" as const, label: "楷体" },
  { value: "fangsong" as const, label: "仿宋" }, { value: "custom" as const, label: "自定义字体" },
];

export const textFontCss = (font?: TextFont): string | undefined => font?.preset === "custom" ? [font.customName, font.cjkName].filter(Boolean).map(name => JSON.stringify(name)).join(",") || undefined
  : font ? ({ song: '"Songti SC", serif', hei: '"Heiti SC", sans-serif', kai: '"Kaiti SC", serif', fangsong: '"STFangsong", serif' })[font.preset] : undefined;

export const thesisCoverFontSetup = "\\ExplSyntaxOn\n\\tl_set:Nn \\l__nju_name_stzhongsfile_tl { FandolSong-Bold.otf }\n\\tl_set:Nn \\l__nju_name_stzhongsopts_tl { BoldFont=FandolSong-Bold.otf }\n\\ExplSyntaxOff";
