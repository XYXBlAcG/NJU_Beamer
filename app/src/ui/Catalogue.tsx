import { useMemo, useRef, useState } from "react";
import { Download, Search, Star, Trash2 } from "lucide-react";
import { createId } from "../domain/deck";
import { decodeExtension, encodeExtension, instantiateTemplate, renderTikz, tikzBlock, type Extension, type TemplatePreset, type ThemePreset, type TikzPreset } from "../domain/extensions";
import { referencedAssets, type NjubDocument } from "../domain/document";
import { serializeDeck } from "../domain/serialize";
import { compileDocument, exportExtension } from "../services/desktop";
import { enabledExtensions, useLibraryStore } from "../state/libraryStore";
import { useEditorStore } from "../state/editorStore";
import { PdfPreview } from "./PdfPreview";
import { Sheet } from "./Sheet";
import { reviewExtension, type ExtensionReview } from "../domain/extensionReview";
import { VirtualGrid } from "./VirtualGrid";
import { PresetThumbnail } from "./PresetThumbnail";
import { presetPreviewDocument, type PresetEntry } from "../domain/presetPreview";

type Kind = "themes" | "templates" | "tikz" | "extensions";
type Entry = PresetEntry;
const labels = { themes: "主题", templates: "模板", tikz: "TikZ", extensions: "扩展" };

export function Catalogue({ initialKind, onClose, onTemplate, onNotice }: { initialKind: Kind; onClose: () => void; onTemplate: (document: NjubDocument) => void; onNotice: (message: string, kind?: "success" | "error") => void }) {
  const library = useLibraryStore();
  const store = useEditorStore();
  const [kind, setKind] = useState(initialKind);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("全部");
  const [selected, setSelected] = useState<Entry>();
  const [parameters, setParameters] = useState<Record<string, string>>({});
  const [pdf, setPdf] = useState<Uint8Array>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [review, setReview] = useState<ExtensionReview>();
  const input = useRef<HTMLInputElement>(null);
  const revision = useRef(0);
  const entries = useMemo(() => enabledExtensions(library).flatMap((extension) => (["themes", "templates", "tikz"] as const).flatMap((type) => extension[type].map((item) => ({ key: `${extension.id}/${type}/${item.id}`, kind: type, item })))), [library.extensions, library.disabled]);
  const visible = useMemo(() => entries.filter((entry) => entry.kind === kind && (category === "全部" || category === entry.item.category || category === "收藏" && library.favourites.includes(entry.key)) && `${entry.item.name} ${entry.item.tags.join(" ")}`.toLowerCase().includes(query.toLowerCase())), [entries, kind, category, library.favourites, query]);

  const preview = async () => {
    const current = ++revision.current;
    setBusy(true); setError("");
    try {
      if (!selected) throw new Error("请先选择素材");
      const document = presetPreviewDocument(selected, parameters);
      const result = await compileDocument(serializeDeck(document.deck), store.workspace, document.assets, true);
      if (revision.current !== current) return;
      if (!result.success || !result.pdf) throw new Error(result.log);
      setPdf(new Uint8Array(result.pdf));
    } catch (failure) {
      if (revision.current === current) setError(String(failure));
    } finally { if (revision.current === current) setBusy(false); }
  };

  const apply = () => {
    try {
      if (!selected) return;
      if (selected.kind === "templates") onTemplate(instantiateTemplate(selected.item as TemplatePreset));
      else if (selected.kind === "themes") {
        const preset = selected.item as ThemePreset;
        store.updateSettings({ theme: structuredClone(preset.theme), themeFiles: structuredClone(preset.files), themePreamble: preset.preamble });
        onNotice("主题已应用");
      } else {
        const slide = store.deck.sections.flatMap((section) => section.slides).find((item) => item.id === store.selectedSlideId);
        if (!store.paper && slide?.kind !== "content" && slide?.kind !== "ending") throw new Error("请先选择一个内容页或结尾页");
        const preset = selected.item as TikzPreset;
        store.insertBlock(tikzBlock(renderTikz(preset, parameters)), preset.libraries);
        onNotice("绘图已插入");
      }
      onClose();
    } catch (failure) { setError(String(failure)); }
  };

  const install = async (file: File) => {
    try { const bytes = new Uint8Array(await file.arrayBuffer()); const extension = decodeExtension(bytes); setReview(await reviewExtension(extension, bytes, file.name, library.extensions)); }
    catch (failure) { onNotice(String(failure), "error"); }
  };

  const saveTemplate = async () => {
    try {
      if (!templateName.trim()) return;
      const id = `template-${createId()}`;
      const extension: Extension = { apiVersion: 1, id, name: templateName.trim(), version: "1.0.0", author: store.deck.metadata.author, themes: [], formulas: [], tikz: [], templates: [{ id: "document", name: templateName.trim(), category: "我的模板", tags: [], deck: structuredClone(store.deck), assets: referencedAssets(store.deck, store.assets) }] };
      const path = await exportExtension(encodeExtension(extension), id);
      if (!path) return;
      await library.install(extension);
      setTemplateName("");
      onNotice("模板已导出并安装");
    } catch (failure) { onNotice(String(failure), "error"); }
  };

  return <Sheet title="素材库" onClose={onClose} className="catalogue-sheet">
    <div className="catalogue-layout">
      <nav className="catalogue-sidebar">{(Object.keys(labels) as Kind[]).filter((value) => !store.paper || value === "tikz" || value === "extensions").map((value) => <button className={kind === value ? "active" : ""} key={value} onClick={() => { ++revision.current; setBusy(false); setSelected(undefined); setPdf(undefined); setKind(value); setCategory("全部"); }}>{labels[value]}</button>)}<button onClick={() => input.current?.click()}><Download size={15} />安装扩展</button><input type="file" hidden ref={input} accept=".njup,.zip" onChange={(event) => { const file = event.target.files?.[0]; if (file) void install(file); event.target.value = ""; }} /></nav>
      <section className="catalogue-content">
        {kind === "extensions" ? <div className="extension-list">{library.extensions.map((extension) => <article key={extension.id}><div><strong>{extension.name}</strong><small>{extension.author} · {extension.version}</small></div><label className="toggle"><input type="checkbox" checked={!library.disabled.includes(extension.id)} onChange={() => void library.toggle(extension.id).catch((failure) => onNotice(String(failure), "error"))} />启用</label><button aria-label="卸载扩展" onClick={() => void library.remove(extension.id).catch((failure) => onNotice(String(failure), "error"))}><Trash2 size={15} /></button></article>)}{!library.extensions.length && <p>从本地安装 .njup 扩展包</p>}</div> : <>
          <div className="catalogue-search"><Search size={16} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索素材" /></div>
          <nav className="category-tabs">{["全部", "收藏", ...new Set(entries.filter((entry) => entry.kind === kind).map((entry) => entry.item.category))].map((name) => <button key={name} className={category === name ? "active" : ""} onClick={() => setCategory(name)}>{name}</button>)}</nav>
          {kind === "templates" && <div className="template-save"><input placeholder="我的模板名称" value={templateName} onChange={(event) => setTemplateName(event.target.value)} /><button disabled={!templateName.trim()} onClick={() => void saveTemplate()}>保存当前文稿为模板</button></div>}
          <VirtualGrid className="preset-grid" items={visible} minWidth={180} rowHeight={172} gap={12} itemKey={(entry) => entry.key} render={(entry) => <article className={selected?.key === entry.key ? "selected" : ""}>
            <button className="preset-main" onClick={() => { ++revision.current; setSelected(entry); setPdf(undefined); setError(""); setBusy(false); setParameters({}); }}><PresetThumbnail entry={entry} workspace={store.workspace} /><strong>{entry.item.name}</strong><small>{entry.item.category}</small></button>
            <button aria-label="收藏素材" className={`preset-star icon-button ${library.favourites.includes(entry.key) ? "active" : ""}`} onClick={() => void library.favourite(entry.key).catch((failure) => onNotice(String(failure), "error"))}><Star size={14} /></button>
          </article>} />
        </>}
      </section>
      {selected && kind !== "extensions" && <aside className="preset-detail"><h3>{selected.item.name}</h3>
        {selected.kind === "tikz" && (selected.item as TikzPreset).parameters.map((parameter) => <label key={parameter.key}>{parameter.name}<input type={parameter.kind === "number" ? "number" : "text"} value={parameters[parameter.key] ?? parameter.value} onChange={(event) => { ++revision.current; setBusy(false); setParameters({ ...parameters, [parameter.key]: event.target.value }); setPdf(undefined); }} /></label>)}
        <div className="preset-preview">{pdf ? <PdfPreview data={pdf} /> : <span>{busy ? "正在编译预览…" : "使用 XeLaTeX 生成预览"}</span>}</div>
        <div className="preset-actions"><button disabled={busy || !store.workspace} onClick={() => void preview()}>预览</button><button className="primary" disabled={busy} onClick={apply}>{selected.kind === "templates" ? "新建文稿" : selected.kind === "themes" ? "应用主题" : "插入绘图"}</button></div>
        {error && <pre className="field-error">{error}</pre>}
      </aside>}
    </div>
    {review && <Sheet title={review.replaces ? "确认替换扩展" : "确认安装扩展"} onClose={() => setReview(undefined)} className="extension-review">
      <p role="alert">不要安装未经验证的插件。扩展中的 TeX 会参与编译，请仅安装您信任的来源。</p>
      <dl><dt>扩展</dt><dd>{review.extension.name} · {review.extension.version}</dd><dt>作者</dt><dd>{review.extension.author || "未提供"}</dd><dt>来源</dt><dd>{review.source}</dd><dt>SHA-256</dt><dd className="mono">{review.sha256}</dd>{review.replaces && <><dt>替换版本</dt><dd>{review.replaces}</dd></>}<dt>内容</dt><dd>{review.extension.themes.length} 主题 · {review.extension.templates.length} 模板 · {review.extension.tikz.length} 绘图 · {review.extension.formulas.length} 公式</dd></dl>
      <p>校验值只标识文件内容，不代表来源已验证。扩展不支持执行 JavaScript。</p>
      <div className="dialog-actions"><button onClick={() => setReview(undefined)}>取消</button><button className="primary" onClick={() => void library.install(review.extension).then(() => { onNotice(`${review.extension.name} 已安装`); setReview(undefined); }).catch((failure) => onNotice(String(failure), "error"))}>信任并安装</button></div>
    </Sheet>}
  </Sheet>;
}
