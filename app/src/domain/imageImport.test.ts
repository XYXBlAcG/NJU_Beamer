import { describe, expect, it } from "vitest";
import { imageExtension } from "./imageImport";

describe("imageExtension", () => {
  it("maps supported clipboard image types to stable extensions", () => {
    expect(imageExtension("image/png")).toBe("png");
    expect(imageExtension("image/jpeg")).toBe("jpg");
  });

  it("rejects unsupported image types", () => {
    expect(() => imageExtension("image/webp")).toThrow("PNG 或 JPEG");
  });
});
