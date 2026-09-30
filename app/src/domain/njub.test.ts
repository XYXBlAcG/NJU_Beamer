import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { createDefaultDeck } from "./deck";
import { decodeNjub, encodeNjub } from "./njub";

describe("NJUB archive codec", () => {
  it("round trips the canonical document", () => {
    const deck = createDefaultDeck();
    const encoded = encodeNjub(deck, []);
    const decoded = decodeNjub(encoded);

    expect(decoded.deck).toEqual(deck);
    expect(decoded.assets).toEqual([]);
  });

  it("round trips referenced assets and rejects missing ones", () => {
    const deck = createDefaultDeck();
    deck.sections[0].slides[1].blocks = [{
      id: "image",
      type: "image",
      hidden: false,
      fontSize: "normal", appearance: "none",
      source: "pic/chart.png",
      width: 0.8,
      alt: "图表",
    }];
    const asset = { path: "pic/chart.png", mimeType: "image/png" as const, content: [137, 80, 78, 71, 13, 10, 26, 10] };

    expect(decodeNjub(encodeNjub(deck, [asset]))).toEqual({ deck, assets: [asset] });
    expect(() => encodeNjub(deck, [])).toThrow("缺少图片资源");
  });

  it("rejects files outside document.json and pic", () => {
    const archive = zipSync({
      "document.json": strToU8(JSON.stringify(createDefaultDeck())),
      "other.txt": strToU8("unexpected"),
    });

    expect(() => decodeNjub(archive)).toThrow("不允许的归档条目");
  });
});
