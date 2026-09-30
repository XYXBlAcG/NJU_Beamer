import { describe, expect, it } from "vitest";
import { createDefaultDeck } from "./deck";
import { validateDeckContent } from "./deckValidation";

describe("validateDeckContent", () => {
  it("finds unmatched math delimiters in nested editable content", () => {
    const deck = createDefaultDeck();
    deck.sections[0].slides[1].blocks = [{
      id: "columns", type: "columns", hidden: false, fontSize: "normal", appearance: "none", alignment: "top", columns: [
        { id: "left", width: 0.5, blocks: [{ id: "list", type: "list", hidden: false, fontSize: "normal", appearance: "none", ordered: false, reveal: "none", items: ["缺少 $结束"] }] },
        { id: "right", width: 0.5, blocks: [] },
      ],
    }];

    expect(validateDeckContent(deck)).toEqual([{ slideId: deck.sections[0].slides[1].id, blockId: "list", message: "行内公式缺少 $（字符 4）" }]);
  });
});
