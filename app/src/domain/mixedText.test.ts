import { describe, expect, it } from "vitest";
import { parseMixedText } from "./mixedText";

describe("parseMixedText", () => {
  it("separates prose, inline math, display math and escaped delimiters", () => {
    expect(parseMixedText("速度 \\(v=t\\)，$a+b$，总数 $$\\sum_i x_i$$，价格 \\$5")).toEqual({
      segments: [
        { type: "text", value: "速度 " },
        { type: "inlineMath", value: "v=t" },
        { type: "text", value: "，" },
        { type: "inlineMath", value: "a+b" },
        { type: "text", value: "，总数 " },
        { type: "displayMath", value: "\\sum_i x_i" },
        { type: "text", value: "，价格 $5" },
      ],
      issues: [],
    });
  });

  it("reports every unclosed delimiter with its source offset", () => {
    expect(parseMixedText("甲 \\(x 乙 $$y").issues).toEqual([
      { offset: 2, delimiter: "\\(", message: "行内公式缺少 \\)" },
    ]);
    expect(parseMixedText("甲 $$y").issues).toEqual([
      { offset: 2, delimiter: "$$", message: "独立公式缺少 $$" },
    ]);
  });

  it("does not treat escaped dollar signs as math boundaries", () => {
    expect(parseMixedText("费用 \\$10，变量 $x$").segments).toEqual([
      { type: "text", value: "费用 $10，变量 " },
      { type: "inlineMath", value: "x" },
    ]);
  });
});
