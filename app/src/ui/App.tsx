import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Eye, FileArchive, FileDown, FilePlus2, FolderOpen, Hammer, Pencil, Save, Library, Undo2, Redo2, Search } from "lucide-react";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import { createDefaultDeck, createId, deckSchema, richText, type Block } from "../domain/deck";
import { archiveContent, referencedAssets } from "../domain/document";
import { createDefaultPaper, paperSchema, serializePaper } from "../domain/paper";
import { PaperEditor } from "./PaperEditor";
import { serializeDeck } from "../domain/serialize";
import { validateDeckContent } from "../domain/deckValidation";
import { compileDocument, defaultTemplateDirectory, exitApp, exportPdf, exportTexBundle, openDeck, readDeck, registerOpenDocumentListener, saveDeck, saveDeckAs, performTextAction } from "../services/desktop";
import { clearRecovery, documentSignature, readRecents, readRecovery, rememberDocument, saveRecovery } from "../services/session";
import type { NjubArchive } from "../domain/document";
import { useLibraryStore } from "../state/libraryStore";
import { usePanelStore } from "../state/panelStore";
import { Sheet } from "./Sheet";
import { DocumentLifecycle } from "../domain/lifecycle";

const Catalogue = lazy(() => import("./Catalogue").then((module) => ({ default: module.Catalogue })));
const FormulaPanel = lazy(() => import("./FormulaPanel").then((module) => ({ default: module.FormulaPanel })));
import { useEditorStore } from "../state/editorStore";
import { PdfPreview } from "./PdfPreview";
import { SelectField } from "./SelectField";
import { SlideEditor } from "./SlideEditor";
import { UnsavedChangesDialog } from "./UnsavedChangesDialog";
import { DocumentSettings } from "./DocumentSettings";
import { Inspector } from "./Inspector";
import { PageActions } from "./PageActions";
import { DocumentOutline } from "./DocumentOutline";
import { MovePagesDialog } from "./MovePagesDialog";
import { usePageCommands } from "./usePageCommands";
import { isTextTarget, matchingCommand, type EditorCommand } from "../domain/commands";
import { NativeEditorMenus } from "../services/nativeMenus";
import { startupView } from "../domain/startup";

const slideKinds = [
  { value: "title" as const, label: "标题页" },
  { value: "contents" as const, label: "目录页" },
  { value: "content" as const, label: "内容页" },
  { value: "ending" as const, label: "结尾页" },
];

const blocksHaveOverlay = (blocks: Block[]): boolean => blocks.some((block) => block.appearance !== "none"
  || (block.type === "list" && block.reveal !== "none")
  || (block.type === "columns" && block.columns.some((column) => blocksHaveOverlay(column.blocks))));

type DocumentOperation =
  | { type: "new" }
  | { type: "newPaper" }
  | { type: "open" }
  | { type: "openPath"; path: string }
  | { type: "template"; document: NjubArchive }
  | { type: "quit" }
  | { type: "close" };

export function App() {
  const store = useEditorStore();
  const content = store.paper ?? store.deck;
  const formulaOpen = usePanelStore((state) => Boolean(state.formula));
  const [pdf, setPdf] = useState<Uint8Array>();
  const [compileState, setCompileState] = useState<"idle" | "running" | "success" | "error">("idle");
  const [log, setLog] = useState("");
  const [workspaceMode, setWorkspaceMode] = useState<"edit" | "preview">("edit");
  const [compiledRevision, setCompiledRevision] = useState<number>();
  const [savedSignature, setSavedSignature] = useState(() => documentSignature(content, store.assets));
  const [catalogue, setCatalogue] = useState<"themes" | "templates" | "tikz" | "extensions">();
  const [recents, setRecents] = useState<string[]>([]);
  const [recovery, setRecovery] = useState<NjubArchive>();
  const [sessionReady, setSessionReady] = useState(false);
  const [listenerReady, setListenerReady] = useState(!isTauri());
  const [externalOpening, setExternalOpening] = useState(false);
  const externalOpenSeen = useRef(false);
  const [newKindOpen, setNewKindOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const nativeMenus = useRef<NativeEditorMenus | undefined>(undefined);
  const [commandsOpen, setCommandsOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [operationBusy, setOperationBusy] = useState(false);
  const [pendingOperation, setPendingOperation] = useState<DocumentOperation>();
  const [notice, setNotice] = useState<{ message: string; kind: "success" | "error" }>();
  const compileRevision = useRef(0);
  const closing = useRef(false);
  const openDocumentRequest = useRef<(path: string) => void>(() => undefined);
  const lifecycleRequest = useRef<(operation: DocumentOperation) => void>(() => undefined);
  const performOperation = useRef<(operation: DocumentOperation) => Promise<void>>(async () => undefined);
  const lifecycle = useRef(new DocumentLifecycle<DocumentOperation>(() => {
    const state = useEditorStore.getState();
    return documentSignature(state.paper ?? state.deck, state.assets);
  }, (operation) => performOperation.current(operation)));
  const slides = useMemo(() => store.deck.sections.flatMap((section) => section.slides), [store.deck.sections]);
  const selectedSlide = slides.find((slide) => slide.id === store.selectedSlideId) ?? slides[0];
  const selectedSection = store.deck.sections.find((section) => section.slides.some((slide) => slide.id === selectedSlide?.id));
  const source = useMemo(() => { try { return store.paper ? serializePaper(store.paper) : serializeDeck(store.deck); } catch { return ""; } }, [store.deck, store.paper]);
  const hasUncompiledChanges = compiledRevision !== undefined && compiledRevision !== store.revision;
  const signature = useMemo(() => documentSignature(content, store.assets), [content, store.assets]);
  const hasUnsavedChanges = store.hasDocument && savedSignature !== signature;
  const showNotice = useCallback((message: string, kind: "success" | "error" = "success") => setNotice({ message, kind }), []);
  const pageCommands = usePageCommands(() => setMoveOpen(true), (message) => showNotice(message, "error"));
  const startup = startupView({ hasDocument: store.hasDocument, sessionReady, listenerReady, externalOpening, hasRecovery: Boolean(recovery) });

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(undefined), 2600);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    defaultTemplateDirectory().then(store.setWorkspace).catch(() => setLog("请在 Tauri 桌面环境中运行以启用 XeLaTeX。"));
  }, [store.setWorkspace]);

  useEffect(() => {
    let active = true;
    void Promise.all([useLibraryStore.getState().load(), readRecents(), readRecovery()]).then(([, paths, document]) => {
      if (active) { setRecents(paths); if (!externalOpenSeen.current) setRecovery(document); setSessionReady(true); }
    }).catch((error) => { if (active) { showNotice(String(error), "error"); setSessionReady(true); } });
    return () => { active = false; };
  }, [showNotice]);

  useEffect(() => {
    if (!sessionReady || recovery || !store.hasDocument) return;
    const timer = window.setTimeout(() => {
      void (hasUnsavedChanges ? saveRecovery(content, store.assets) : clearRecovery()).catch((error) => showNotice(`恢复副本：${String(error)}`, "error"));
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [sessionReady, recovery, hasUnsavedChanges, content, store.assets, store.hasDocument, showNotice]);

  useEffect(() => {
    const textContextMenu = (event: MouseEvent) => {
      if (!isTauri() || !isTextTarget(event.target) || (event.target as Element).closest(".rich-text-editor")) return;
      event.preventDefault(); event.stopPropagation();
      void nativeMenus.current?.popupText().catch((error) => showNotice(String(error), "error"));
    };
    const preventContextMenu = (event: MouseEvent) => event.preventDefault();
    document.addEventListener("contextmenu", textContextMenu, true);
    document.addEventListener("contextmenu", preventContextMenu);
    return () => { document.removeEventListener("contextmenu", preventContextMenu); document.removeEventListener("contextmenu", textContextMenu, true); };
  }, [showNotice]);

  const compile = useCallback(async () => {
    if (!store.hasDocument || !store.workspace || compileState === "running") return;
    setPdf(undefined);
    setCompiledRevision(undefined);
    const structure = store.paper ? paperSchema.safeParse(store.paper) : deckSchema.safeParse(store.deck);
    if (!structure.success) {
      setLog(structure.error.issues.map((issue) => issue.message).join("\n"));
      setCompileState("error");
      showNotice("页面设置不完整，请查看右侧诊断信息", "error");
      return;
    }
    const diagnostics = store.paper ? [] : validateDeckContent(store.deck);
    if (diagnostics.length) {
      const message = diagnostics.map((item) => `${slides.findIndex((slide) => slide.id === item.slideId) + 1} 页：${item.message}`).join("\n");
      setLog(message);
      setCompileState("error");
      showNotice("公式定界符不完整，请查看右侧诊断信息", "error");
      return;
    }
    const revision = ++compileRevision.current;
    setCompileState("running");
    try {
      const result = await compileDocument(source, store.workspace, referencedAssets(content, store.assets), false, store.documentPath ?? content.sections[0].id);
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
  }, [showNotice, slides, source, store.assets, store.deck, store.paper, content, store.revision, store.workspace, store.hasDocument, store.documentPath, compileState]);

  const handleSave = useCallback(async (): Promise<boolean> => {
    if (!store.hasDocument) return false;
    try {
      const path = await saveDeck(content, store.assets, store.documentPath);
      if (!path) return false;
      store.setDocumentPath(path);
      setSavedSignature(documentSignature(content, store.assets));
      void rememberDocument(path).then(setRecents).catch((error) => showNotice(String(error), "error"));
      showNotice("保存成功");
      return true;
    } catch (error) {
      showNotice(error instanceof Error ? error.message : String(error), "error");
      return false;
    }
  }, [showNotice, store.assets, content, store.documentPath, store.hasDocument, store.setDocumentPath]);

  const handleSaveAs = useCallback(async (): Promise<boolean> => {
    if (!store.hasDocument) return false;
    try {
      const path = await saveDeckAs(content, store.assets);
      if (!path) return false;
      store.setDocumentPath(path);
      setSavedSignature(documentSignature(content, store.assets));
      void rememberDocument(path).then(setRecents).catch((error) => showNotice(String(error), "error"));
      showNotice("保存成功");
      return true;
    } catch (error) {
      showNotice(error instanceof Error ? error.message : String(error), "error");
      return false;
    }
  }, [showNotice, store.assets, content, store.hasDocument, store.setDocumentPath]);

  const handleExportTex = useCallback(async () => {
    try {
      const path = await exportTexBundle(source, referencedAssets(content, store.assets), store.workspace, Boolean(store.paper));
      if (path) showNotice("TeX 包导出成功");
    } catch (error) {
      showNotice(error instanceof Error ? error.message : String(error), "error");
    }
  }, [showNotice, source, store.assets, content, store.workspace, store.paper]);

  const resetPreview = useCallback(() => {
    ++compileRevision.current;
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
    setSavedSignature(documentSignature(deck, []));
    void rememberDocument(path).then(setRecents);
    resetPreview();
  }, [resetPreview, store.setDocument]);

  const handleOpen = useCallback(async () => {
    const result = await openDeck();
    if (result) {
      if ("paper" in result) store.setPaperDocument(result.paper, result.assets, result.path);
      else store.setDocument(result.deck, result.assets, result.path);
      setSavedSignature(documentSignature(archiveContent(result), result.assets));
      void rememberDocument(result.path).then(setRecents);
      resetPreview();
    }
  }, [resetPreview, store.setDocument, store.setPaperDocument]);

  const handleOpenPath = useCallback(async (path: string) => {
    if (path === store.documentPath) return;
    const result = await readDeck(path);
    if ("paper" in result) store.setPaperDocument(result.paper, result.assets, result.path);
    else store.setDocument(result.deck, result.assets, result.path);
    setSavedSignature(documentSignature(archiveContent(result), result.assets));
    void rememberDocument(result.path).then(setRecents);
    resetPreview();
  }, [resetPreview, store.documentPath, store.setDocument, store.setPaperDocument]);

  const executeOperation = useCallback(async (operation: DocumentOperation) => {
    try {
      if (operation.type === "new") await handleNew();
      else if (operation.type === "newPaper") {
        const paper = createDefaultPaper();
        const path = await saveDeckAs(paper, []);
        if (path) { store.setPaperDocument(paper, [], path); setSavedSignature(documentSignature(paper, [])); resetPreview(); void rememberDocument(path).then(setRecents); }
      }
      else if (operation.type === "open") await handleOpen();
      else if (operation.type === "openPath") await handleOpenPath(operation.path);
      else if (operation.type === "template") {
        if ("paper" in operation.document) store.setPaperDocument(operation.document.paper, operation.document.assets);
        else store.setDocument(operation.document.deck, operation.document.assets);
        setSavedSignature("");
        resetPreview();
      }
      else if (isTauri()) {
        await clearRecovery();
        closing.current = true;
        await exitApp();
      }
    } catch (error) {
      closing.current = false;
      showNotice(error instanceof Error ? error.message : String(error), "error");
    } finally {
      if (operation.type === "openPath") setExternalOpening(false);
    }
  }, [handleNew, handleOpen, handleOpenPath, showNotice, store.setDocument, store.setPaperDocument, resetPreview]);
  performOperation.current = executeOperation;

  const requestOperation = useCallback((operation: DocumentOperation) => {
    if (lifecycle.current.busy) return;
    if (hasUnsavedChanges) setPendingOperation(operation);
    else void lifecycle.current.run(operation);
  }, [hasUnsavedChanges]);

  const resolvePendingOperation = useCallback(async (choice: "save" | "discard" | "cancel") => {
    const operation = pendingOperation;
    if (!operation || operationBusy) return;
    if (choice === "cancel") { setPendingOperation(undefined); return; }
    setOperationBusy(true);
    try {
      if (await lifecycle.current.run(operation, choice === "save" ? handleSave : undefined)) setPendingOperation(undefined);
    } finally { setOperationBusy(false); }
  }, [handleSave, pendingOperation, operationBusy]);

  openDocumentRequest.current = (path) => requestOperation({ type: "openPath", path });
  lifecycleRequest.current = requestOperation;

  useEffect(() => {
    if (!isTauri()) return;
    let unlisten: (() => void) | undefined;
    let disposed = false;
    void registerOpenDocumentListener((paths) => {
      const path = paths[0];
      if (path) { externalOpenSeen.current = true; setRecovery(undefined); setExternalOpening(true); openDocumentRequest.current(path); }
    }).then((dispose) => { if (disposed) dispose(); else { unlisten = dispose; setListenerReady(true); } }).catch((error) => { setLog(String(error)); setListenerReady(true); });
    return () => { disposed = true; unlisten?.(); };
  }, []);

  const commandRegistry: EditorCommand[] = [
    { id: "file.new", label: "新建…", group: "文件", shortcut: "Mod+n", enabled: true, run: () => setNewKindOpen(true) },
    { id: "file.paper", label: "新建南京大学论文", group: "文件", enabled: true, run: () => requestOperation({ type: "newPaper" }) },
    { id: "file.open", label: "打开文稿…", group: "文件", shortcut: "Mod+o", enabled: true, run: () => requestOperation({ type: "open" }) },
    { id: "file.save", label: "保存", group: "文件", shortcut: "Mod+s", enabled: store.hasDocument, run: () => void handleSave() },
    { id: "file.saveAs", label: "另存为…", group: "文件", shortcut: "Mod+Shift+s", enabled: store.hasDocument, run: () => void handleSaveAs() },
    { id: "file.tex", label: "导出 TeX 包", group: "文件", enabled: store.hasDocument && Boolean(store.workspace), run: () => void handleExportTex() },
    { id: "file.pdf", label: "导出 PDF", group: "文件", enabled: Boolean(pdf), run: () => { if (pdf) void exportPdf(pdf); } },
    { id: "file.close", label: "关闭窗口", group: "文件", shortcut: "Mod+w", enabled: true, run: () => requestOperation({ type: "close" }) },
    { id: "edit.undo", label: "撤销", group: "编辑", shortcut: "Mod+z", enabled: Boolean(store.past.length), run: store.undo },
    { id: "edit.redo", label: "重做", group: "编辑", shortcut: "Mod+Shift+z", enabled: Boolean(store.future.length), run: store.redo },
    ...(["cut", "copy", "paste", "selectAll"] as const).map((action, index): EditorCommand => ({ id: `edit.${action}`, label: ["剪切", "复制", "粘贴", "全选"][index], group: "编辑", shortcut: `Mod+${["x", "c", "v", "a"][index]}`, enabled: true, run: () => {
      if (document.activeElement?.closest(".document-outline")) {
        const command = pageCommands.find((entry) => entry.id === `page.${action}`); if (command?.enabled) command.run();
      } else void performTextAction(action).catch((error) => showNotice(String(error), "error"));
    } })),
    ...pageCommands,
    { id: "view.edit", label: "编辑", group: "视图", enabled: store.hasDocument, run: () => setWorkspaceMode("edit") },
    { id: "view.preview", label: "预览", group: "视图", enabled: Boolean(pdf), run: () => setWorkspaceMode("preview") },
    { id: "view.commands", label: "命令面板", group: "视图", shortcut: "Mod+k", enabled: true, run: () => setCommandsOpen(true) },
    { id: "tools.compile", label: "编译并预览", group: "工具", shortcut: "Mod+Enter", enabled: store.hasDocument && Boolean(store.workspace) && compileState !== "running", run: () => void compile() },
    { id: "tools.copyTex", label: "复制 TeX", group: "工具", enabled: store.hasDocument, run: () => void navigator.clipboard.writeText(source) },
    { id: "tools.themes", label: "主题图库", group: "工具", enabled: store.hasDocument && !store.paper, run: () => setCatalogue("themes") },
    { id: "tools.templates", label: "文稿模板", group: "工具", enabled: store.hasDocument && !store.paper, run: () => setCatalogue("templates") },
    { id: "tools.tikz", label: "TikZ 素材", group: "工具", enabled: store.hasDocument, run: () => setCatalogue("tikz") },
    { id: "tools.extensions", label: "扩展管理", group: "工具", enabled: true, run: () => setCatalogue("extensions") },
    ...recents.map((path, index): EditorCommand => ({ id: `file.recent.${index}`, label: `最近使用 · ${path.split("/").pop()}`, group: "文件", enabled: true, run: () => requestOperation({ type: "openPath", path }) })),
  ];
  const registryRef = useRef(commandRegistry);
  registryRef.current = commandRegistry;
  const registryShape = commandRegistry.map((command) => `${command.id}:${command.label}`).join("|");
  useEffect(() => {
    const menus = new NativeEditorMenus(); nativeMenus.current = menus;
    void menus.install(registryRef.current, () => lifecycleRequest.current({ type: "quit" })).catch((error) => showNotice(`菜单：${String(error)}`, "error"));
    return () => { void menus.dispose().catch(() => undefined); };
  }, [registryShape, showNotice]);
  useEffect(() => { void nativeMenus.current?.update(commandRegistry).catch((error) => showNotice(`菜单：${String(error)}`, "error")); }, [commandRegistry, showNotice]);
  const runCommand = (id: string) => { const command = commandRegistry.find((item) => item.id === id); if (command?.enabled) command.run(); };

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (document.querySelector("dialog[open]")) return;
      const inOutline = event.target instanceof Element && Boolean(event.target.closest(".document-outline"));
      const command = matchingCommand(registryRef.current, event, isTextTarget(event.target) ? "text" : inOutline ? "outline" : "workspace");
      if (command) { event.preventDefault(); command.run(); }
      else if (event.key === "Escape" && workspaceMode === "preview" && !document.querySelector(".pdf-presentation")) setWorkspaceMode("edit");
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [workspaceMode]);

  useEffect(() => {
    if (!isTauri()) return;
    const appWindow = getCurrentWindow();
    let unlisten: (() => void) | undefined;
    let quitUnlisten: (() => void) | undefined;
    let disposed = false;
    void appWindow.onCloseRequested((event) => {
      if (closing.current) return;
      event.preventDefault();
      lifecycleRequest.current({ type: "close" });
    }).then((dispose) => { if (disposed) dispose(); else unlisten = dispose; }).catch((error) => setLog(String(error)));
    void listen("request-quit", () => lifecycleRequest.current({ type: "quit" })).then((dispose) => { if (disposed) dispose(); else quitUnlisten = dispose; });
    return () => { disposed = true; unlisten?.(); quitUnlisten?.(); };
  }, []);

  useEffect(() => {
    const filename = store.documentPath?.split(/[\\/]/).pop() ?? "未命名文稿";
    document.title = `${hasUnsavedChanges ? "● " : ""}${filename} — NJU Beamer GUI Editor`;
    if (isTauri()) void getCurrentWindow().setTitle(document.title).catch((error) => showNotice(String(error), "error"));
  }, [hasUnsavedChanges, store.documentPath, showNotice]);

  const commands = commandRegistry.filter((command) => command.enabled && command.label.toLowerCase().includes(commandQuery.toLowerCase()));

  return (
    <main className="app-shell">
      <header className="app-bar">
        <div className="toolbar">
          <button title="新建（Command/Ctrl+N）" onClick={() => runCommand("file.new")}><FilePlus2 size={17} />新建</button>
          <button onClick={() => runCommand("file.paper")}><FilePlus2 size={17} />论文</button>
          <button title="打开（Command/Ctrl+O）" onClick={() => runCommand("file.open")}><FolderOpen size={17} />打开</button>
          <button disabled={!store.hasDocument} title="保存（Command/Ctrl+S；另存为加 Shift）" onClick={() => runCommand("file.save")}><Save size={17} />保存</button>
          <button className="icon-button" aria-label="撤销" disabled={!store.past.length} onClick={() => runCommand("edit.undo")}><Undo2 size={17} /></button>
          <button className="icon-button" aria-label="重做" disabled={!store.future.length} onClick={() => runCommand("edit.redo")}><Redo2 size={17} /></button>
          <button disabled={!store.hasDocument} onClick={() => runCommand(store.paper ? "tools.tikz" : "tools.templates")}><Library size={17} />素材库</button>
          <button className="icon-button" title="命令与最近文稿（⌘K）" onClick={() => runCommand("view.commands")}><Search size={17} /></button>
          <button title="编译并预览（Command/Ctrl+Enter）" className="primary" onClick={() => runCommand("tools.compile")} disabled={!store.hasDocument || compileState === "running"}><Hammer size={17} />{compileState === "running" ? "编译中" : "编译"}</button>
          <button disabled={!store.hasDocument} onClick={() => runCommand("tools.copyTex")}><FileDown size={17} />复制 TeX</button>
          <button onClick={() => runCommand("file.tex")} disabled={!store.hasDocument || !store.workspace}><FileArchive size={17} />导出 TeX 包</button>
          <button disabled={!pdf} onClick={() => runCommand("file.pdf")}><FileDown size={17} />导出 PDF</button>
          <span className="mode-switch">
            <button disabled={!store.hasDocument} className={workspaceMode === "edit" ? "active" : ""} onClick={() => runCommand("view.edit")}><Pencil size={16} />编辑</button>
            <button className={workspaceMode === "preview" ? "active" : ""} disabled={!pdf} onClick={() => runCommand("view.preview")}><Eye size={16} />预览</button>
          </span>
        </div>
        <div className={`status ${compileState}`}>{compileState === "running" ? "正在编译" : compileState === "error" ? "编译失败" : hasUncompiledChanges ? "有未编译更改" : hasUnsavedChanges ? "未保存" : compileState === "success" ? "预览已更新" : "手动编译"}</div>
        {compileState === "running" && <div className="compile-progress" role="progressbar"><span /></div>}
      </header>

      {!store.hasDocument ? <section className="welcome-screen">
        {startup === "welcome" ? <><h1>NJU Beamer GUI Editor</h1><div className="welcome-choices"><button onClick={() => requestOperation({ type: "new" })}><FilePlus2 size={32} /><strong>创建幻灯片</strong><span>Beamer 演示文稿</span></button><button onClick={() => requestOperation({ type: "newPaper" })}><FilePlus2 size={32} /><strong>创建文档</strong><span>南京大学论文与报告</span></button><button onClick={() => runCommand("file.open")}><FolderOpen size={32} /><strong>打开项目</strong><span>.njub 文稿</span></button></div>{recents.length > 0 && <div className="welcome-recents"><h2>最近使用</h2>{recents.map((path) => <button key={path} onClick={() => requestOperation({ type: "openPath", path })}>{path.split("/").pop()}</button>)}</div>}</> : <span>{externalOpening ? "正在打开文稿…" : "正在准备工作区…"}</span>}
      </section> : store.paper ? <PaperEditor paper={store.paper} mode={workspaceMode} pdf={pdf} log={compileState === "error" ? log : ""} onError={(message) => showNotice(message, "error")} commands={pageCommands} /> : <><DocumentOutline commands={pageCommands} />

      <section className={`workspace ${workspaceMode}`}>
        {selectedSlide && workspaceMode === "edit" ? <SlideEditor slide={selectedSlide} /> : <PdfPreview data={pdf} />}
        {compileState === "running" && <div className="compile-overlay"><span className="spinner" />正在运行 XeLaTeX</div>}
      </section>

      <Inspector>
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
                <label>类型<SelectField value={selectedSlide.kind} options={slideKinds} onChange={(kind) => store.updateSlide(selectedSlide.id, { kind, ...(kind === "ending" && !selectedSlide.blocks.length ? { blocks: [{ id: createId(), type: "text", hidden: false, fontSize: "normal", appearance: "none", content: richText("Thanks") }] } : {}) })} /></label>
                {selectedSlide.kind === "content" && <label>页标题<input value={selectedSlide.title} onChange={(event) => store.updateSlide(selectedSlide.id, { title: event.target.value })} /></label>}
                <label className="toggle"><input type="checkbox" checked={selectedSlide.frame.plain} onChange={(event) => store.updateSlide(selectedSlide.id, { frame: { ...selectedSlide.frame, plain: event.target.checked } })} />无页眉页脚</label>
                <label className="toggle" title={blocksHaveOverlay(selectedSlide.blocks) ? "逐项或逐块显示与自动分页不能同时使用" : ""}><input type="checkbox" checked={selectedSlide.frame.allowFrameBreaks} disabled={blocksHaveOverlay(selectedSlide.blocks)} onChange={(event) => store.updateSlide(selectedSlide.id, { frame: { ...selectedSlide.frame, allowFrameBreaks: event.target.checked } })} />内容自动分页</label>
                <label className="toggle"><input type="checkbox" checked={selectedSlide.frame.shrink} onChange={(event) => store.updateSlide(selectedSlide.id, { frame: { ...selectedSlide.frame, shrink: event.target.checked } })} />自动缩小内容</label>
                <label className="toggle"><input type="checkbox" checked={Boolean(selectedSlide.hidden)} onChange={(event) => store.updateSlide(selectedSlide.id, { hidden: event.target.checked })} />跳过此页</label>
                <label>页面标签<input value={selectedSlide.frame.label} placeholder="intro" onChange={(event) => store.updateSlide(selectedSlide.id, { frame: { ...selectedSlide.frame, label: event.target.value.replace(/[^A-Za-z0-9:._-]/g, "") } })} /></label>
                <label>演讲者备注<textarea value={selectedSlide.notes} onChange={(event) => store.updateSlide(selectedSlide.id, { notes: event.target.value })} /></label>
                <PageActions commands={pageCommands} />
              </div>
            </details>
            {(selectedSlide.kind === "content" || selectedSlide.kind === "ending") && (
              <button className="edit-content-button" onClick={() => setWorkspaceMode("edit")}><Pencil size={15} />在中间编辑页面内容</button>
            )}
          </>
        )}
        {compileState === "error" && <section className="compile-diagnostics"><strong>编译诊断</strong><pre>{log.split("\n").slice(-30).join("\n")}</pre></section>}
      </Inspector>
      </>}
      {notice && <div className={`toast ${notice.kind}`} role="status">{notice.message}</div>}
      <Suspense fallback={null}>
        {catalogue && <Catalogue initialKind={catalogue} onClose={() => setCatalogue(undefined)} onTemplate={(document) => requestOperation({ type: "template", document })} onNotice={showNotice} />}
        {formulaOpen && <FormulaPanel />}
      </Suspense>
      {commandsOpen && <Sheet title="命令" onClose={() => setCommandsOpen(false)} className="command-sheet"><div className="catalogue-search"><Search size={17} /><input autoFocus value={commandQuery} placeholder="搜索命令或最近文稿" onChange={(event) => setCommandQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && commands[0]) { commands[0].run(); setCommandsOpen(false); } }} /></div><div className="command-list">{commands.map((command) => <button key={command.id} onClick={() => { command.run(); setCommandsOpen(false); }}>{command.label}</button>)}</div></Sheet>}
      {newKindOpen && <Sheet title="创建新项目" className="command-sheet" onClose={() => setNewKindOpen(false)}><div className="dialog-actions"><button onClick={() => setNewKindOpen(false)}>取消</button><button onClick={() => { setNewKindOpen(false); requestOperation({ type: "newPaper" }); }}>创建文档</button><button className="primary" onClick={() => { setNewKindOpen(false); requestOperation({ type: "new" }); }}>创建幻灯片</button></div></Sheet>}
      {moveOpen && <MovePagesDialog onClose={() => setMoveOpen(false)} />}
      {recovery && <Sheet title="恢复未保存的文稿" onClose={() => { setRecovery(undefined); void clearRecovery(); }} className="command-sheet"><p>{archiveContent(recovery).metadata.title}</p><div className="preset-actions"><button onClick={() => { setRecovery(undefined); void clearRecovery(); }}>舍弃恢复副本</button><button className="primary" onClick={() => { requestOperation({ type: "template", document: recovery }); setRecovery(undefined); }}>恢复</button></div></Sheet>}
      {pendingOperation && (
        <UnsavedChangesDialog
          busy={operationBusy}
          action={pendingOperation.type === "new" || pendingOperation.type === "newPaper" || pendingOperation.type === "template" ? "新建" : pendingOperation.type === "close" || pendingOperation.type === "quit" ? "退出" : "打开"}
          onSave={() => void resolvePendingOperation("save")}
          onDiscard={() => void resolvePendingOperation("discard")}
          onCancel={() => void resolvePendingOperation("cancel")}
        />
      )}
    </main>
  );
}
