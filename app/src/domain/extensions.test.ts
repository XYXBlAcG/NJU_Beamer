import { describe, expect, it } from "vitest";
import { decodeExtension, encodeExtension, extensionSchema, instantiateTemplate, renderSnippet } from "./extensions";
import { builtInExtension } from "./presets";

describe("declarative extensions", () => {
  it("ships a complete searchable catalogue through the public protocol", () => {
    const extension = decodeExtension(encodeExtension(builtInExtension));
    expect(extension.themes.length).toBeGreaterThanOrEqual(12);
    expect(extension.templates.length).toBeGreaterThanOrEqual(8);
    expect(extension.tikz.length).toBeGreaterThanOrEqual(60);
    expect(extension.formulas.length).toBeGreaterThanOrEqual(200);
  });
  it("rejects executable contributions and duplicate identifiers", () => {
    expect(extensionSchema.safeParse({ ...builtInExtension, scripts: ["evil.js"] }).success).toBe(false);
    expect(extensionSchema.safeParse({ ...builtInExtension, formulas: [builtInExtension.formulas[0], builtInExtension.formulas[0]] }).success).toBe(false);
  });
  it("creates independent documents and preserves selected text in snippets", () => {
    const template = builtInExtension.templates[0];
    const first = instantiateTemplate(template);
    const second = instantiateTemplate(template);
    expect(first.deck.sections[0].id).not.toBe(second.deck.sections[0].id);
    expect(renderSnippet("\\frac{{{selection}}}{b}", "x+y")).toBe("\\frac{x+y}{b}");
  });
});
