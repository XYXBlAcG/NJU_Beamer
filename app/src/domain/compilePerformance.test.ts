import { expect, it } from "vitest";
import { composeAuthoringSpec } from "./authoring";
import { createDefaultDeck } from "./deck";
import { serializeDeck } from "./serialize";
import { kuangTheme } from "./kuangTemplate";

it("defines illustration colors independently of the selected theme", () => {
  const deck = createDefaultDeck();
  deck.settings.theme = kuangTheme.theme;
  deck.settings.themeFiles = kuangTheme.files;
  expect(serializeDeck(deck)).toContain("\\definecolor{njupurple}{HTML}{63065F}");
});

it("shares vector emblem objects between pages", () => {
  const theme = kuangTheme.files.find(file => file.path.endsWith(".sty"))!.content;
  expect(theme).toContain("\\RequirePackage{xsavebox}");
  expect(theme).toContain("\\xsbox{kym-nju}");
  expect(theme).toContain("\\xusebox{kym-nju}");
});

it.each(["large", "Large", "LARGE", "huge", "Huge"] as const)("round-trips larger size %s through CLI and TeX", async fontSize => {
  const document = await composeAuthoringSpec({ specVersion: 2, metadata: { title: "字号" }, sections: [{ title: "字号", slides: [{ blocks: [{ type: "text", content: "字号示例", fontSize }] }] }] }, async () => { throw new Error("Unexpected image"); });
  expect(document.deck.sections[0].slides[0].blocks[0].fontSize).toBe(fontSize);
  expect(serializeDeck(document.deck)).toContain(`{\\${fontSize}\n`);
});
