import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { clampPdfPage, NativePdfPreview, nativePdfUrl, pdfPageNumbers, presentationPointerStyle } from "./PdfPreview";

describe("pdfPageNumbers", () => {
  it("includes every physical PDF page for overlays and generated section pages", () => {
    expect(pdfPageNumbers(5)).toEqual([1, 2, 3, 4, 5]);
    expect(pdfPageNumbers(0)).toEqual([]);
  });

  it("keeps native preview and playback anchored to the current physical page", () => {
    expect(clampPdfPage(0, 8)).toBe(1);
    expect(clampPdfPage(6, 8)).toBe(6);
    expect(clampPdfPage(12, 8)).toBe(8);
    expect(nativePdfUrl("blob:deck", 6)).toBe("blob:deck#page=6&view=FitH");
  });

  it("loads the PDF as a native WebKit document instead of a plugin object", () => {
    const markup = renderToStaticMarkup(createElement(NativePdfPreview, { url: "blob:deck", page: 6 }));

    expect(markup).toContain("<iframe");
    expect(markup).toContain('title="系统 PDF 预览"');
    expect(markup).toContain('src="blob:deck#page=6&amp;view=FitH"');
    expect(markup).not.toContain("<embed");
  });

  it("keeps the pointer visible during presentation", () => {
    expect(presentationPointerStyle).toEqual({ cursor: "default" });
  });
});
