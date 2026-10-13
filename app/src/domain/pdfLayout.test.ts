import { expect, it } from "vitest";
import { pdfLayout } from "./pdfLayout";

it("uses portrait paper cells and landscape slide cells", () => {
  expect(pdfLayout("paper", "grid", 800, 0.707, 1).pageHeight).toBe(340);
  expect(pdfLayout("slides", "grid", 800, 16 / 9, 1).pageHeight).toBe(230);
});
it("fits paper reading to width and reserves the whole physical page", () => {
  const layout = pdfLayout("paper", "reading", 800, 0.707, 1.5);
  expect(layout.pageWidth).toBe(1128);
  expect(layout.rowHeight).toBeGreaterThan(1500);
  expect(layout.minWidth).toBe(800);
});
