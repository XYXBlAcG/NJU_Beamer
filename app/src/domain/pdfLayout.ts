export type PdfKind = "paper" | "slides";
export type PdfView = "grid" | "reading" | "native";

export function pdfLayout(kind: PdfKind, view: PdfView, width: number, ratio: number, zoom: number) {
  const reading = kind === "paper" && view === "reading";
  const pageWidth = reading ? Math.max(160, width - 48) * zoom : undefined;
  const pageHeight = reading ? pageWidth! / ratio : kind === "paper" ? 340 : 230;
  return { pageWidth, pageHeight, rowHeight: Math.ceil(pageHeight + 36), minWidth: reading ? Math.max(width, 1) : kind === "paper" ? 200 : 240 };
}
