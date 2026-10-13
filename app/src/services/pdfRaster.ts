import { invoke, isTauri } from "@tauri-apps/api/core";

type RasterResponse = ArrayBuffer | number[];
export const rasterPngBlob = (response: RasterResponse): Blob => new Blob([
  Array.isArray(response) ? Uint8Array.from(response).buffer : response,
], { type: "image/png" });

export class PdfRaster {
  private closed = false;
  private readonly id: Promise<number>;
  constructor(content: Uint8Array) {
    this.id = invoke<number>("open_pdf_raster", { content: Array.from(content) });
  }
  async render(canvas: HTMLCanvasElement, page: number, width: number, height: number, active: () => boolean) {
    const id = await this.id;
    if (this.closed || !active()) return;
    const png = await invoke<RasterResponse>("render_pdf_raster", { id, page, width, height });
    if (this.closed || !active()) return;
    const image = await createImageBitmap(rasterPngBlob(png));
    try {
      if (this.closed || !active()) return;
      canvas.width = width; canvas.height = height;
      canvas.getContext("2d")?.drawImage(image, 0, 0);
    } finally { image.close(); }
  }
  async close() {
    this.closed = true;
    await invoke("close_pdf_raster", { id: await this.id });
  }
}

export const nativePdfRasterAvailable = () => isTauri() && /Mac/.test(navigator.platform);
