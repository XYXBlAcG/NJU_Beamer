import { expect, it } from "vitest";
import { builtInExtension } from "./presets";
import { instantiateTemplate } from "./extensions";
import { decodeNjub, encodeNjub } from "./njub";
import { serializeDeck } from "./serialize";

it("owns both emblems and its theme after a template archive round trip", () => {
  const preset = builtInExtension.templates.find(template => template.id === "kuang-yaming");
  expect(preset).toBeDefined();
  const document = instantiateTemplate(preset!);
  const restored = decodeNjub(encodeNjub(document.deck, document.assets));
  if (!("deck" in restored)) throw new Error("Expected deck");
  expect(restored.deck.settings.themeFiles.map(file => file.path)).toEqual(expect.arrayContaining(["theme/beamerthemeKuangYaming.sty", "theme/kym-emblem-nju.tex", "theme/kym-emblem-dii.tex"]));
  const tex = serializeDeck(restored.deck);
  expect(tex).toContain("\\usetheme{KuangYaming}");
  expect(tex).toContain("kym-emblem-dii.tex");
  expect(tex).toContain("Thanks");
});
