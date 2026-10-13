import { expect, it } from "vitest";
import { importBibliography, serializeBibliography } from "./bibliography";

it("preserves BibTeX entry types, protected text and additional fields", () => {
  const input = "@article{tree,author={Arthur Cayley},title={A theorem on {Trees}},year={1889},journal={Quarterly Journal},doi={10.1000/example}}";
  const references = importBibliography(input);
  expect(references[0].fields.title).toBe("A theorem on {Trees}");
  expect(references[0].type).toBe("article");
  expect(importBibliography(serializeBibliography(references))).toEqual(references);
});
it("rejects malformed input instead of silently dropping entries", () => {
  expect(() => importBibliography("@book{broken,title={oops}")).toThrow();
});
