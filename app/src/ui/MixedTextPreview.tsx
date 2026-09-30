import katex from "katex";
import "katex/dist/katex.min.css";
import { parseMixedText } from "../domain/mixedText";

export function MixedTextPreview({ value }: { value: string }) {
  const { segments } = parseMixedText(value);
  if (!segments.some((segment) => segment.type !== "text")) return null;
  return <div className="mixed-text-preview" aria-label="公式预览">{segments.map((segment, index) => segment.type === "text"
    ? <span key={index}>{segment.value}</span>
    : <span
      key={index}
      className={segment.type === "displayMath" ? "display-math" : "inline-math"}
      dangerouslySetInnerHTML={{ __html: katex.renderToString(segment.value, { displayMode: segment.type === "displayMath", throwOnError: false, strict: "ignore" }) }}
    />)}</div>;
}
