import { readFileSync } from "node:fs";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { PdfRaster, rasterPngBlob } from "./pdfRaster";

describe("native PDF binary transport", () => {
  const png = readFileSync(new URL("../../../examples/assets/commutative.png", import.meta.url));
  for (const transport of [Array.from(png), Uint8Array.from(png).buffer]) {
    it(`decodes ${Array.isArray(transport) ? "WKWebView JSON bytes" : "binary bytes"} as a real PNG`, async () => {
      const blob = rasterPngBlob(transport);
      const bytes = new Uint8Array(await blob.arrayBuffer());
      expect(bytes).toEqual(Uint8Array.from(png));
      const image = await loadImage(Buffer.from(bytes));
      expect(image.width).toBeGreaterThan(0);
      expect(blob.type).toBe("image/png");
    });
  }
});

afterEach(() => { if (typeof window !== "undefined") clearMocks(); vi.unstubAllGlobals(); });
it("renders JSON-transported PNG bytes through the raster service and releases the bitmap", async () => {
  const png = readFileSync(new URL("../../../examples/assets/commutative.png", import.meta.url));
  const original = await loadImage(png);
  const close = vi.fn();
  vi.stubGlobal("window", { crypto: globalThis.crypto });
  vi.stubGlobal("createImageBitmap", async (blob: Blob) => Object.assign(await loadImage(Buffer.from(await blob.arrayBuffer())), { close }));
  mockIPC((cmd) => cmd === "open_pdf_raster" ? 1 : cmd === "render_pdf_raster" ? Array.from(png) : null);
  const canvas = createCanvas(original.width, original.height);
  const raster = new PdfRaster(new Uint8Array([1]));
  await raster.render(canvas as unknown as HTMLCanvasElement, 1, original.width, original.height, () => true);
  const expected = createCanvas(original.width, original.height);
  expected.getContext("2d").drawImage(original, 0, 0);
  expect(canvas.toBuffer("image/png")).toEqual(expected.toBuffer("image/png"));
  expect(close).toHaveBeenCalledOnce();
  await raster.close();
});
