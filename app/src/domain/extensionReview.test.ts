import { describe, expect, it } from "vitest";
import { reviewExtension } from "./extensionReview";
import { builtInExtension } from "./presets";

describe("extension install review", () => {
  it("identifies replacement and fingerprints the actual package", async () => {
    const review = await reviewExtension(builtInExtension, new Uint8Array([1, 2, 3]), "sample.njup", [builtInExtension]);
    expect(review.sha256).toBe("039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81");
    expect(review.replaces).toBe(builtInExtension.version);
    expect(review.source).toBe("sample.njup");
  });
});
