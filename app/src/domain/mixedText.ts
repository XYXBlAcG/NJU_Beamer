export type MixedTextSegment = {
  type: "text" | "inlineMath" | "displayMath";
  value: string;
};

export type MixedTextIssue = {
  offset: number;
  delimiter: "\\(" | "$" | "$$";
  message: string;
};

const isEscaped = (source: string, offset: number) => {
  let backslashes = 0;
  for (let index = offset - 1; index >= 0 && source[index] === "\\"; index -= 1) backslashes += 1;
  return backslashes % 2 === 1;
};

const closingOffset = (source: string, start: number, delimiter: string) => {
  for (let index = start; index <= source.length - delimiter.length; index += 1) {
    if (source.startsWith(delimiter, index) && !isEscaped(source, index)) return index;
  }
  return -1;
};

export const parseMixedText = (source: string): { segments: MixedTextSegment[]; issues: MixedTextIssue[] } => {
  const segments: MixedTextSegment[] = [];
  const issues: MixedTextIssue[] = [];
  const appendText = (value: string) => {
    if (!value) return;
    const previous = segments.at(-1);
    if (previous?.type === "text") previous.value += value;
    else segments.push({ type: "text", value });
  };

  let index = 0;
  while (index < source.length) {
    if (source.startsWith("\\$", index)) {
      appendText("$");
      index += 2;
      continue;
    }
    if (source.startsWith("\\(", index)) {
      const close = closingOffset(source, index + 2, "\\)");
      if (close < 0) {
        issues.push({ offset: index, delimiter: "\\(", message: "行内公式缺少 \\)" });
        appendText(source.slice(index));
        break;
      }
      segments.push({ type: "inlineMath", value: source.slice(index + 2, close) });
      index = close + 2;
      continue;
    }
    if (source.startsWith("$$", index) && !isEscaped(source, index)) {
      const close = closingOffset(source, index + 2, "$$");
      if (close < 0) {
        issues.push({ offset: index, delimiter: "$$", message: "独立公式缺少 $$" });
        appendText(source.slice(index));
        break;
      }
      segments.push({ type: "displayMath", value: source.slice(index + 2, close) });
      index = close + 2;
      continue;
    }
    if (source[index] === "$" && !isEscaped(source, index)) {
      const close = closingOffset(source, index + 1, "$");
      if (close < 0) {
        issues.push({ offset: index, delimiter: "$", message: "行内公式缺少 $" });
        appendText(source.slice(index));
        break;
      }
      segments.push({ type: "inlineMath", value: source.slice(index + 1, close) });
      index = close + 1;
      continue;
    }
    appendText(source[index]);
    index += 1;
  }

  return { segments, issues };
};
