import { expect, it } from "vitest";
import { createDefaultDeck } from "./deck";
import { serializeDeck } from "./serialize";

it("preserves the Song face for italic and bold italic text", () => {
  const source = serializeDeck(createDefaultDeck());
  expect(source).toContain("ItalicFont=FandolSong-Regular.otf,ItalicFeatures={FakeSlant=0.2}");
  expect(source).toContain("BoldItalicFont=FandolSong-Bold.otf");
  expect(source).not.toContain("ItalicFont=FandolKai-Regular.otf");
});
