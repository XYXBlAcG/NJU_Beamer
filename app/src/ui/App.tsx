import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Eye, FileArchive, FileDown, FilePlus2, FolderOpen, FolderPlus, Hammer, Pencil, Plus, Save, Settings2, Trash2 } from "lucide-react";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { createDefaultDeck } from "../domain/deck";
import { referencedAssets } from "../domain/document";
import { serializeDeck } from "../domain/serialize";
import { compileDocument, defaultTemplateDirectory, exportPdf, exportTexBundle, openDeck, readDeck, registerOpenDocumentListener, saveDeck, saveDeckAs } from "../services/desktop";
import { useEditorStore } from "../state/editorStore";
import { PdfPreview } from "./PdfPreview";
import { SelectField } from "./SelectField";
import { SlideEditor } from "./SlideEditor";
import { UnsavedChangesDialog } from "./UnsavedChangesDialog";
import { DocumentSettings } from "./DocumentSettings";

const slideKinds = [
  { value: "title" as const, label: "标题页" },
  { value: "contents" as const, label: "目录页" },
  { value: "content" as const, label: "内容页" },
];

type DocumentOperation =
  | { type: "new" }
  | { type: "open" }
  | { type: "openPath"; path: string }
  | { type: "close" };

export function App() {
  const store = useEditorStore();
  const [pdf, setPdf] = useState<Uint8Array>();
  const [compileState, setCompileState] = useState<"idle" | "running" | "success" | "error">("idle");
  const [log, setLog] = useState("");
  const [workspaceMode, setWorkspaceMode] = useState<"edit" | "preview">("edit");
  const [compiledRevision, setCompiledRevision] = useState<number>();
  const [savedRevision, setSavedRevision] = useState(0);
  const [pendingOperation, setPendingOperation] = useState<DocumentOperation>();
  const [notice, setNotice] = useState<{ message: string; kind: "success" | "error" }>();
  const compileRevision = useRef(0);
  const closing = useRef(false);
  const openDocumentRequest = useRef<(path: string) => void>(() => undefined);
  const slides = useMemo(() => store.deck.sections.flatMap((section) => section.slides), [store.deck.sections]);
  const selectedSlide = slides.find((slide) => slide.id === store.selectedSlideId) ?? slides[0];
  const selectedSection = store.deck.sections.find((section) => section.slides.some((slide) => slide.id === selectedSlide?.id));
  const source = useMemo(() => serializeDeck(store.deck), [store.deck]);
  const hasUncompiledChanges = compiledRevision !== undefined && compiledRevision !== store.revision;
  const hasUnsavedChanges = savedRevision !== store.revision;
  const showNotice = useCallback((message: string, kind: "success" | "error" = "success") => setNotice({ message, kind }), []);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(undefined), 2600);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    defaultTemplateDirectory().then(store.setWorkspace).catch(() => setLog("请在 Tauri 桌面环境中运行以启用 XeLaTeX。"));
  }, [store.setWorkspace]);

  useEffect(() => {
    const preventContextMenu = (event: MouseEvent) => event.preventDefault();
    document.addEventListener("contextmenu", preventContextMenu);
    return () => document.removeEventListener("contextmenu", preventContextMenu);
  }, []);

  const compile = useCallback(async () => {
    if (!store.workspace) return;
    const revision = ++compileRevision.current;
    setCompileState("running");
    try {
      const result = await compileDocument(source, store.workspace, referencedAssets(store.deck, store.assets));
      if (revision !== compileRevision.current) return;
      setLog(result.log);
      if (result.success && result.pdf) {
        setPdf(new Uint8Array(result.pdf));
        setCompiledRevision(store.revision);
        setCompileState("success");
        setWorkspaceMode("preview");
        showNotice("编译成功");
      } else {
        setCompileState("error");
        showNotice("编译失败，请查看右侧诊断信息", "error");
      }
    } catch (error) {
      if (revision !== compileRevision.current) return;
      setLog(error instanceof Error ? error.message : String(error));
      setCompileState("error");
      showNotice("编译失败，请查看右侧诊断信息", "error");
    }
  }, [showNotice, source, store.assets, store.deck, store.revision, store.workspace]);

  const handleSave = useCallback(async (): Promise<boolean> => {
    const path = await saveDeck(store.deck, store.assets, store.documentPath);
    if (!path) return false;
    store.setDocumentPath(path);
    setSavedRevision(store.revision);
    showNotice("保存成功");
    return true;
  }, [showNotice, store.assets, store.deck, store.documentPath, store.revision, store.setDocumentPath]);

  const handleSaveAs = useCallback(async (): Promise<boolean> => {
    const path = await saveDeckAs(store.deck, store.assets);
    if (!path) return false;
    store.setDocumentPath(path);
    setSavedRevision(store.revision);
    showNotice("保存成功");
    return true;
  }, [showNotice, store.assets, store.deck, store.revision, store.setDocumentPath]);

  const handleExportTex = useCallback(async () => {
    try {
      const path = await exportTexBundle(source, referencedAssets(store.deck, store.assets), store.workspace);
      if (path) showNotice("TeX 包导出成功");
    } catch (error) {
      showNotice(error instanceof Error ? error.message : String(error), "error");
    }
  }, [showNotice, source, store.assets, store.deck, store.workspace]);

  const resetPreview = useCallback(() => {
    setPdf(undefined);
    setCompiledRevision(undefined);
    setCompileState("idle");
    setWorkspaceMode("edit");
  }, []);

  const handleNew = useCallback(async () => {
    const deck = createDefaultDeck();
    const path = await saveDeckAs(deck, []);
    if (!path) return;
    store.setDocument(deck, [], path);
    setSavedRevision(0);
    resetPreview();
  }, [resetPreview, store.setDocument]);

  const handleOpen = useCallback(async () => {
    const result = await openDeck();
    if (result) {
      store.setDocument(result.deck, result.assets, result.path);
      setSavedRevision(0);
      resetPreview();
    }
  }, [resetPreview, store.setDocument]);

  const handleOpenPath = useCallback(async (path: string) => {
    if (path === store.documentPath) return;
    const result = await readDeck(path);
    store.setDocument(result.deck, result.assets, result.path);
    setSavedRevision(0);
    resetPreview();
  }, [resetPreview, store.documentPath, store.setDocument]);

  const executeOperation = useCallback(async (operation: DocumentOperation) => {
    try {
      if (operation.type === "new") await handleNew();
      else if (operation.type === "open") await handleOpen();
      else if (operation.type === "openPath") await handleOpenPath(operation.path);
      else if (isTauri()) {
        closing.current = true;
        await getCurrentWindow().destroy();
      }
    } catch (error) {
      showNotice(error instanceof Error ? error.message : String(error), "error");
    }
  }, [handleNew, handleOpen, handleOpenPath, showNotice]);

  const requestOperation = useCallback((operation: DocumentOperation) => {
    if (hasUnsavedChanges) setPendingOperation(operation);
    else void executeOperation(operation);
  }, [executeOperation, hasUnsavedChanges]);

  const resolvePendingOperation = useCallback(async (choice: "save" | "discard" | "cancel") => {
    const operation = pendingOperation;
    setPendingOperation(undefined);
    if (!operation || choice === "cancel") return;
    if (choice === "save" && !(await handleSave())) return;
    await executeOperation(operation);
  }, [executeOperation, handleSave, pendingOperation]);

  openDocumentRequest.current = (path) => requestOperation({ type: "openPath", path });

  useEffect(() => {
    if (!isTauri()) return;
    let unlisten: (() => void) | undefined;
    void registerOpenDocumentListener((paths) => {
      const path = paths[0];
      if (path) openDocumentRequest.current(path);
    }).then((dispose) => { unlisten = dispose; }).catch((error) => setLog(String(error)));
    return () => unlisten?.();
  }, []);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const modifier = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();
      if (modifier && key === "n") { event.preventDefault(); requestOperation({ type: "new" }); }
      else if (modifier && key === "o") { event.preventDefault(); requestOperation({ type: "open" }); }
      else if (modifier && key === "s") { event.preventDefault(); void (event.shiftKey ? handleSaveAs() : handleSave()); }
      else if (modifier && event.key === "Enter") { event.preventDefault(); void compile(); }
      else if (event.key === "Escape" && workspaceMode === "preview" && !document.querySelector(".pdf-presentation")) setWorkspaceMode("edit");
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [compile, handleSave, handleSaveAs, requestOperation, workspaceMode]);

  useEffect(() => {
    if (!isTauri()) return;
    const appWindow = getCurrentWindow();
    let unlisten: (() => void) | undefined;
    void appWindow.onCloseRequested(async (event) => {
      if (closing.current || !hasUnsavedChanges) return;
      event.preventDefault();
      setPendingOperation({ type: "close" });
    }).then((dispose) => { unlisten = dispose; }).catch(() => undefined);
    return () => unlisten?.();
  }, [hasUnsavedChanges]);

  useEffect(() => {
    const filename = store.documentPath?.split(/[\\/]/).pop() ?? "未命名文稿";
    document.title = `${hasUnsavedChanges ? "● " : ""}${filename} — NJU Beamer GUI Editor`;
  }, [hasUnsavedChanges, store.documentPath]);

  return (
    <main className="app-shell">
      <header className="app-bar">
        <div className="brand"><span className="brand-mark">N</span></div>
        <div className="toolbar">
          <button title="新建（Command/Ctrl+N）" onClick={() => requestOperation({ type: "new" })}><FilePlus2 size={17} />新建</button>
          <button title="打开（Command/Ctrl+O）" onClick={() => requestOperation({ type: "open" })}><FolderOpen size={17} />打开</button>
          <button title="保存（Command/Ctrl+S；另存为加 Shift）" onClick={handleSave}><Save size={17} />保存</button>
          <button title="编译并预览（Command/Ctrl+Enter）" className="primary" onClick={compile} disabled={compileState === "running"}><Hammer size={17} />{compileState === "running" ? "编译中" : "编译"}</button>
          <button onClick={() => navigator.clipboard.writeText(source)}><FileDown size={17} />复制 TeX</button>
          <button onClick={handleExportTex} disabled={!store.workspace}><FileArchive size={17} />导出 TeX 包</button>
          <button disabled={!pdf} onClick={() => pdf && exportPdf(pdf)}><FileDown size={17} />导出 PDF</button>
          <span className="mode-switch">
            <button className={workspaceMode === "edit" ? "active" : ""} onClick={() => setWorkspaceMode("edit")}><Pencil size={16} />编辑</button>
            <button className={workspaceMode === "preview" ? "active" : ""} disabled={!pdf} onClick={() => setWorkspaceMode("preview")}><Eye size={16} />预览</button>
          </span>
        </div>
        <div className={`status ${compileState}`}>{compileState === "running" ? "正在编译" : compileState === "error" ? "编译失败" : hasUncompiledChanges ? "有未编译更改" : hasUnsavedChanges ? "未保存" : compileState === "success" ? "预览已更新" : "手动编译"}</div>
        {compileState === "running" && <div className="compile-progress" role="progressbar"><span /></div>}
      </header>

      <aside className="slide-sidebar">
        <div className="sidebar-heading"><span>幻灯片</span><button className="section-add" onClick={store.addSection}><FolderPlus size={15} />章节</button></div>
        {store.deck.sections.map((section) => (
          <section key={section.id} className="section-group">
            <div className="section-name"><span>{section.title}</span><button className="icon-button" aria-label={`在${section.title}中新增幻灯片`} onClick={() => store.addSlide(section.id)}><Plus size={15} /></button></div>
            {section.slides.map((slide) => (
              <button key={slide.id} className={`slide-card ${slide.id === selectedSlide?.id ? "selected" : ""}`} onClick={() => store.selectSlide(slide.id)}>
                <span>{slides.findIndex((item) => item.id === slide.id) + 1}</span><strong>{slide.kind === "title" ? store.deck.metadata.title : slide.kind === "contents" ? "目录" : slide.title || "无标题"}</strong>
              </button>
            ))}
          </section>
        ))}
      </aside>

      <section className={`workspace ${workspaceMode}`}>
        {selectedSlide && workspaceMode === "edit" ? <SlideEditor slide={selectedSlide} /> : <PdfPreview data={pdf} />}
        {compileState === "running" && <div className="compile-overlay"><span className="spinner" />正在运行 XeLaTeX</div>}
      </section>

      <aside className="inspector">
        <div className="inspector-title"><Settings2 size={17} />属性</div>
        <details>
          <summary>文稿</summary>
          <div className="field-stack">
            {Object.entries(store.deck.metadata).map(([key, value]) => (
              <label key={key}>{({ title: "标题", subtitle: "副标题", author: "作者", institute: "机构", date: "日期" } as Record<string, string>)[key]}
                <input value={value} onChange={(event) => store.updateMetadata(key as keyof typeof store.deck.metadata, event.target.value)} />
              </label>
            ))}
          </div>
          <DocumentSettings />
        </details>
        {selectedSlide && (
          <>
            <details open>
              <summary>页面</summary>
              <div className="field-stack">
                {selectedSection && <label>章节<input value={selectedSection.title} onChange={(event) => store.updateSection(selectedSection.id, event.target.value)} /></label>}
                <label>类型<SelectField value={selectedSlide.kind} options={slideKinds} onChange={(kind) => store.updateSlide(selectedSlide.id, { kind })} /></label>
                {selectedSlide.kind === "content" && <label>页标题<input value={selectedSlide.title} onChange={(event) => store.updateSlide(selectedSlide.id, { title: event.target.value })} /></label>}
                <div className="slide-actions"><button onClick={() => store.moveSlide(-1)}><ChevronUp size={15} />上移</button><button onClick={() => store.moveSlide(1)}><ChevronDown size={15} />下移</button><button className="danger" onClick={store.removeSlide}><Trash2 size={15} />删除</button></div>
              </div>
            </details>
            {selectedSlide.kind === "content" && (
              <button className="edit-content-button" onClick={() => setWorkspaceMode("edit")}><Pencil size={15} />在中间编辑页面内容</button>
            )}
          </>
        )}
        {compileState === "error" && <section className="compile-diagnostics"><strong>编译诊断</strong><pre>{log.split("\n").slice(-30).join("\n")}</pre></section>}
      </aside>
      {notice && <div className={`toast ${notice.kind}`} role="status">{notice.message}</div>}
      {pendingOperation && (
        <UnsavedChangesDialog
          action={pendingOperation.type === "new" ? "新建" : pendingOperation.type === "close" ? "退出" : "打开"}
          onSave={() => void resolvePendingOperation("save")}
          onDiscard={() => void resolvePendingOperation("discard")}
          onCancel={() => void resolvePendingOperation("cancel")}
        />
      )}
    </main>
  );
}
