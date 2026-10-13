import { expect, it } from "vitest";
import { tikzEditorSource, tikzBlockSource } from "./tikzEditor";

it("roundtrips unsupported drawing syntax without reinterpretation", () => {
  const source = "\\path let \\p1=(A) in node at (\\x1,0) {未知};";
  expect(tikzBlockSource(tikzEditorSource(source))).toBe(source);
});
it("does not silently discard multiple figures or preamble edits", () => {
  expect(() => tikzBlockSource("\\begin{tikzpicture}x\\end{tikzpicture}\\begin{tikzpicture}y\\end{tikzpicture}")).toThrow();
});
