import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { LruCache } from "../domain/cache";
import { presetPreviewDocument, type PresetEntry } from "../domain/presetPreview";
import { serializeDeck } from "../domain/serialize";
import { compileDocument } from "./desktop";
import { PdfRaster, nativePdfRasterAvailable } from "./pdfRaster";

const cache = new LruCache<string, string>(64);
const pending = new Map<string, { promise: Promise<string>; subscribers: Set<() => boolean> }>();
let queue = Promise.resolve();
export async function presetThumbnail(entry: PresetEntry, workspace: string, active: () => boolean): Promise<string> {
  const document = presetPreviewDocument(entry);
  const source = serializeDeck(document.deck);
  const bytes = new TextEncoder().encode(JSON.stringify([workspace, source, document.assets, 1]));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const key = Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
  const cached = cache.get(key);
  if (cached) return cached;
  const existing = pending.get(key);
  if (existing) { existing.subscribers.add(active); return existing.promise; }
  const subscribers = new Set([active]);
  const job = queue.catch(() => undefined).then(async () => {
    if (![...subscribers].some((subscriber) => subscriber())) throw new Error("预览已取消");
    const result = await compileDocument(source, workspace, document.assets, true);
    if (!result.success || !result.pdf) throw new Error("缩略图编译失败");
    const base = `${import.meta.env.BASE_URL}pdfjs/`;
    const task = pdfjs.getDocument({ data: new Uint8Array(result.pdf), cMapUrl: `${base}cmaps/`, cMapPacked: true, standardFontDataUrl: `${base}standard_fonts/`, wasmUrl: `${base}wasm/` });
    try {
      const pdf = await task.promise;
      const page = await pdf.getPage(entry.kind === "templates" && pdf.numPages > 1 ? 2 : 1);
      const viewport = page.getViewport({ scale: 480 / page.getViewport({ scale: 1 }).width });
      const canvas = window.document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
      if (nativePdfRasterAvailable()) {
        const raster = new PdfRaster(new Uint8Array(result.pdf));
        try { await raster.render(canvas, page.pageNumber, canvas.width, canvas.height, () => true); }
        finally { await raster.close(); }
      } else await page.render({ canvas, viewport }).promise;
      const image = canvas.toDataURL("image/png");
      cache.set(key, image);
      return image;
    } finally { await task.destroy(); }
  }).finally(() => { pending.delete(key); });
  pending.set(key, { promise: job, subscribers });
  queue = job.then(() => undefined, () => undefined);
  return job;
}
