import { useEffect, useRef, useState } from "react";
import { tikzBlockSource, tikzEditorSource } from "../domain/tikzEditor";
import { Sheet } from "./Sheet";

export function TikzEditor({ source, onApply, onClose }: { source: string; onApply: (source: string) => void; onClose: () => void }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow || event.origin !== location.origin || event.data?.channel !== "njub-tikz") return;
      if (event.data.type === "ready") {
        event.source?.postMessage({ channel: "njub-tikz", type: "load", source: tikzEditorSource(source) }, { targetOrigin: location.origin });
        setReady(true);
      }
      if (event.data.type === "source" && typeof event.data.source === "string") {
        try { onApply(tikzBlockSource(event.data.source)); onClose(); } catch (failure) { setError(String(failure)); }
      }
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [source, onApply, onClose]);
  return <Sheet title="TikZ 可视化编辑" onClose={onClose} className="tikz-editor-sheet">
    <iframe ref={frame} src={`${import.meta.env.BASE_URL}tikz-editor/index.html`} title="离线 TikZ Editor" sandbox="allow-scripts allow-same-origin allow-downloads" />
    {error && <div className="field-error">{error}</div>}
    <div className="dialog-actions"><span>图形预览不等同于 XeLaTeX 输出，未识别语法仍保留在源码中。</span><button onClick={onClose}>取消</button><button disabled={!ready} className="primary" onClick={() => frame.current?.contentWindow?.postMessage({ channel: "njub-tikz", type: "save" }, location.origin)}>应用到文稿</button></div>
  </Sheet>;
}
