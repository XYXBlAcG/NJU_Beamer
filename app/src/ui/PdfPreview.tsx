import { useEffect, useRef, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import * as pdfjs from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

type Props = {
  data?: Uint8Array;
};

export const pdfPageNumbers = (pageCount: number) => Array.from({ length: pageCount }, (_, index) => index + 1);
export const clampPdfPage = (page: number, pageCount: number) => Math.min(Math.max(Math.trunc(page) || 1, 1), Math.max(pageCount, 1));
export const nativePdfUrl = (url: string, page: number) => `${url}#page=${page}&view=FitH`;

function PdfPage({ document, number, selected = false, presentation = false, onSelect }: {
  document: pdfjs.PDFDocumentProxy;
  number: number;
  selected?: boolean;
  presentation?: boolean;
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
    void document.getPage(number).then(async (page) => {
      const baseViewport = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: width / baseViewport.width });
      const canvas = canvasRef.current;
      if (!active || !canvas) return;
      const context = canvas.getContext("2d");
      if (!context) return;
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 3);
      canvas.width = Math.floor(viewport.width * pixelRatio);
      canvas.height = Math.floor(viewport.height * pixelRatio);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;
      renderTask = page.render({
        canvasContext: context,
        viewport,
        transform: pixelRatio === 1 ? undefined : [pixelRatio, 0, 0, pixelRatio, 0, 0],
      });
      await renderTask.promise;
    }).catch((reason: unknown) => {
      if (active && (!(reason instanceof Error) || reason.name !== "RenderingCancelledException")) {
        setError(reason instanceof Error ? reason.message : "页面无法显示");
      }
    });
    return () => {
      active = false;
      renderTask?.cancel();
    };
  }, [document, number, width]);

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
}

export function PdfPreview({ data }: Props) {
  const [pdfDocument, setPdfDocument] = useState<pdfjs.PDFDocumentProxy>();
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState("编译后将在这里显示真实 XeLaTeX 页面");
  const [mode, setMode] = useState<"grid" | "native">("grid");
  const [currentPage, setCurrentPage] = useState(1);
  const [presenting, setPresenting] = useState(false);
  const pageCount = pdfDocument?.numPages ?? 0;

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
    setMessage("正在载入 PDF");
    const assetBase = `${import.meta.env.BASE_URL}pdfjs/`;
    const task = pdfjs.getDocument({
      data: data.slice(),
      cMapUrl: `${assetBase}cmaps/`,
      cMapPacked: true,
      standardFontDataUrl: `${assetBase}standard_fonts/`,
      useSystemFonts: true,
    });
    void task.promise.then((pdf) => {
      if (!active) return;
      setPdfDocument(pdf);
      setMessage("");
    }).catch((error: unknown) => {
      if (active) setMessage(error instanceof Error ? error.message : "PDF 无法显示");
    });
    return () => {
      active = false;
      void task.destroy();
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
    <div className="preview-stage">
      {pdfDocument && url ? <>
        <div className="pdf-toolbar">
          <span className="mode-switch">
            <button className={mode === "grid" ? "active" : ""} onClick={() => setMode("grid")}>多页网格</button>
            <button className={mode === "native" ? "active" : ""} onClick={() => setMode("native")}>系统预览</button>
          </span>
          <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1}>上一页</button>
          <label><input type="number" min="1" max={pageCount} value={currentPage} onChange={(event) => goToPage(Number(event.target.value))} /> / {pageCount}</label>
          <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= pageCount}>下一页</button>
          <button className="play-pdf" onClick={startPresentation}>从当前页播放</button>
        </div>
        {mode === "grid"
          ? <div className="preview-pages">{pdfPageNumbers(pageCount).map((number) => <PdfPage key={number} document={pdfDocument} number={number} selected={number === currentPage} onSelect={() => setCurrentPage(number)} />)}</div>
          : <embed className="native-pdf" src={nativePdfUrl(url, currentPage)} type="application/pdf" />}
        {presenting && <div className="pdf-presentation" onClick={() => goToPage(currentPage + 1)}>
          <PdfPage document={pdfDocument} number={currentPage} presentation />
          <div className="presentation-status">{currentPage} / {pageCount}<button onClick={(event) => { event.stopPropagation(); stopPresentation(); }}>退出播放</button></div>
        </div>}
      </> : <div className="empty-preview">{message}</div>}
    </div>
  );
}
