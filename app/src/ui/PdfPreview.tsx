import { memo, useEffect, useRef, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import pdfWorker from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
import { VirtualGrid } from "./VirtualGrid";
import { PdfRaster, nativePdfRasterAvailable } from "../services/pdfRaster";
import { pdfRenderQueue } from "../services/renderQueue";
import { pdfLayout, type PdfKind, type PdfView } from "../domain/pdfLayout";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

type Props = {
  data?: Uint8Array;
  kind?: PdfKind;
};

export const pdfPageNumbers = (pageCount: number) => Array.from({ length: pageCount }, (_, index) => index + 1);
export const clampPdfPage = (page: number, pageCount: number) => Math.min(Math.max(Math.trunc(page) || 1, 1), Math.max(pageCount, 1));
export const nativePdfUrl = (url: string, page: number) => `${url}#page=${page}&view=FitH`;
export const presentationPointerStyle = { cursor: "default" } as const;

export function NativePdfPreview({ url, page }: { url: string; page: number }) {
  return <iframe className="native-pdf" title="系统 PDF 预览" src={nativePdfUrl(url, page)} />;
}

const PdfPage = memo(function PdfPage({ document, raster, number, selected = false, presentation = false, maxHeight = 230, pageWidth, onSelect }: {
  document: pdfjs.PDFDocumentProxy;
  raster?: PdfRaster;
  number: number;
  selected?: boolean;
  presentation?: boolean;
  maxHeight?: number;
  pageWidth?: number;
  onSelect?: () => void;
}) {
  const frameRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!width || !canvasRef.current) return;
    let active = true;
    let renderTask: ReturnType<pdfjs.PDFPageProxy["render"]> | undefined;
    setError("");
    void pdfRenderQueue.run(async () => {
      const page = await document.getPage(number);
      const baseViewport = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: Math.min((pageWidth ?? width) / baseViewport.width, presentation ? Infinity : maxHeight / baseViewport.height) });
      const canvas = canvasRef.current;
      if (!active || !canvas) return;
      const context = canvas.getContext("2d");
      if (!context) return;
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 3, Math.sqrt(4_000_000 / (viewport.width * viewport.height)));
      canvas.width = Math.floor(viewport.width * pixelRatio);
      canvas.height = Math.floor(viewport.height * pixelRatio);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;
      if (raster) {
        await raster.render(canvas, number, canvas.width, canvas.height, () => active);
        return;
      }
      renderTask = page.render({
        canvas,
        canvasContext: context,
        viewport,
        transform: pixelRatio === 1 ? undefined : [pixelRatio, 0, 0, pixelRatio, 0, 0],
      });
      await renderTask.promise;
    }, () => active).catch((reason: unknown) => {
      if (active && (!(reason instanceof Error) || reason.name !== "RenderingCancelledException")) {
        setError(reason instanceof Error ? reason.message : "页面无法显示");
      }
    });
    return () => {
      active = false;
      renderTask?.cancel();
    };
  }, [document, raster, number, width, presentation, maxHeight, pageWidth]);

  return (
    <figure
      ref={frameRef}
      className={`preview-page ${selected ? "selected" : ""} ${presentation ? "presentation-page" : ""}`}
      onClick={onSelect}
      onKeyDown={(event) => { if (onSelect && (event.key === "Enter" || event.key === " ")) onSelect(); }}
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
    >
      <canvas ref={canvasRef} />
      {!presentation && <figcaption>{error || `PDF ${number}`}</figcaption>}
    </figure>
  );
});

export function PdfPreview({ data, kind = "slides" }: Props) {
  const [pdfDocument, setPdfDocument] = useState<pdfjs.PDFDocumentProxy>();
  const [raster, setRaster] = useState<PdfRaster>();
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState("编译后将在这里显示真实 XeLaTeX 页面");
  const [mode, setMode] = useState<PdfView>(kind === "paper" ? "reading" : "grid");
  const [zoom, setZoom] = useState(1);
  const [ratio, setRatio] = useState(kind === "paper" ? 0.707 : 4 / 3);
  const [width, setWidth] = useState(800);
  const stage = useRef<HTMLDivElement>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [presenting, setPresenting] = useState(false);
  const pageCount = pdfDocument?.numPages ?? 0;
  const layout = pdfLayout(kind, mode, width, ratio, zoom);

  useEffect(() => {
    setMode(kind === "paper" ? "reading" : "grid");
    setPresenting(false);
  }, [kind]);

  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    if (stage.current) observer.observe(stage.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!data) {
      setUrl("");
      return;
    }
    const next = URL.createObjectURL(new Blob([data.slice().buffer as ArrayBuffer], { type: "application/pdf" }));
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [data]);

  useEffect(() => {
    setPdfDocument(undefined);
    setCurrentPage(1);
    if (!data) {
      setMessage("编译后将在这里显示真实 XeLaTeX 页面");
      return;
    }
    let active = true;
    const nativeRaster = nativePdfRasterAvailable() ? new PdfRaster(data) : undefined;
    setRaster(nativeRaster);
    setMessage("正在载入 PDF");
    const assetBase = `${import.meta.env.BASE_URL}pdfjs/`;
    const task = pdfjs.getDocument({
      data: data.slice(),
      cMapUrl: `${assetBase}cmaps/`,
      cMapPacked: true,
      standardFontDataUrl: `${assetBase}standard_fonts/`,
      wasmUrl: `${assetBase}wasm/`,
      useSystemFonts: true,
    });
    void task.promise.then(async (pdf) => {
      const first = await pdf.getPage(1);
      if (!active) return;
      const viewport = first.getViewport({ scale: 1 });
      setRatio(viewport.width / viewport.height);
      setPdfDocument(pdf);
      setMessage("");
    }).catch((error: unknown) => {
      if (active) setMessage(error instanceof Error ? error.message : "PDF 无法显示");
    });
    return () => {
      active = false;
      void task.destroy();
      void nativeRaster?.close().catch(() => undefined);
    };
  }, [data]);

  useEffect(() => {
    if (!presenting || !pageCount) return;
    const keydown = (event: KeyboardEvent) => {
      if (["ArrowRight", "ArrowDown", "PageDown", " "].includes(event.key)) {
        event.preventDefault();
        setCurrentPage((page) => clampPdfPage(page + 1, pageCount));
      } else if (["ArrowLeft", "ArrowUp", "PageUp"].includes(event.key)) {
        event.preventDefault();
        setCurrentPage((page) => clampPdfPage(page - 1, pageCount));
      } else if (event.key === "Home") {
        event.preventDefault();
        setCurrentPage(1);
      } else if (event.key === "End") {
        event.preventDefault();
        setCurrentPage(pageCount);
      } else if (event.key === "Escape") {
        event.preventDefault();
        setPresenting(false);
        if (isTauri()) void getCurrentWindow().setFullscreen(false).catch(() => undefined);
      }
    };
    document.addEventListener("keydown", keydown, true);
    return () => document.removeEventListener("keydown", keydown, true);
  }, [pageCount, presenting]);

  const startPresentation = () => {
    setPresenting(true);
    if (isTauri()) void getCurrentWindow().setFullscreen(true).catch(() => undefined);
  };
  const stopPresentation = () => {
    setPresenting(false);
    if (isTauri()) void getCurrentWindow().setFullscreen(false).catch(() => undefined);
  };
  const goToPage = (page: number) => setCurrentPage(clampPdfPage(page, pageCount));

  return (
    <div ref={stage} className={`preview-stage ${kind === "paper" ? "paper-preview" : ""} ${mode === "reading" ? "reading-preview" : ""}`}>
      {pdfDocument && url ? <>
        <div className="pdf-toolbar">
          <span className="mode-switch">
            <button className={mode === "grid" ? "active" : ""} onClick={() => setMode("grid")}>多页网格</button>
            {kind === "paper" && <button className={mode === "reading" ? "active" : ""} onClick={() => setMode("reading")}>连续阅读</button>}
            <button className={mode === "native" ? "active" : ""} onClick={() => setMode("native")}>系统预览</button>
          </span>
          <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1}>上一页</button>
          <label><input type="number" min="1" max={pageCount} value={currentPage} onChange={(event) => goToPage(Number(event.target.value))} /> / {pageCount}</label>
          <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= pageCount}>下一页</button>
          {kind === "paper" ? <><button onClick={() => { setMode("reading"); setZoom(Math.max(0.5, zoom - 0.1)); }}>−</button><button onClick={() => { setMode("reading"); setZoom(1); }} title="适合宽度">{Math.round(zoom * 100)}% · 适宽</button><button onClick={() => { setMode("reading"); setZoom(Math.min(2, zoom + 0.1)); }}>＋</button></> : <button className="play-pdf" onClick={startPresentation}>从当前页播放</button>}
        </div>
        {mode !== "native"
          ? <VirtualGrid className="pdf-virtual-grid" items={pdfPageNumbers(pageCount)} minWidth={layout.minWidth} rowHeight={layout.rowHeight} gap={18} activeIndex={currentPage - 1} itemKey={(number) => number} render={(number) => <PdfPage document={pdfDocument} raster={raster} number={number} maxHeight={layout.pageHeight} pageWidth={layout.pageWidth} selected={number === currentPage} onSelect={() => setCurrentPage(number)} />} />
          : <NativePdfPreview url={url} page={currentPage} />}
        {presenting && <div className="pdf-presentation" style={presentationPointerStyle} onClick={() => goToPage(currentPage + 1)}>
          <PdfPage document={pdfDocument} raster={raster} number={currentPage} presentation />
          <div className="presentation-status">{currentPage} / {pageCount}<button onClick={(event) => { event.stopPropagation(); stopPresentation(); }}>退出播放</button></div>
        </div>}
      </> : <div className="empty-preview">{message}</div>}
    </div>
  );
}
