import { memo, useMemo, useState } from "react";
import katex from "katex";
import { Search, Star } from "lucide-react";
import { renderSnippet } from "../domain/extensions";
import { enabledExtensions, useLibraryStore } from "../state/libraryStore";
import { usePanelStore } from "../state/panelStore";
import { Sheet } from "./Sheet";
import { VirtualGrid } from "./VirtualGrid";
import { LruCache } from "../domain/cache";

const glyphCache = new LruCache<string, string>(512);
export const FormulaGlyph = memo(function FormulaGlyph({ latex }: { latex: string }) {
  const html = useMemo(() => {
    const cached = glyphCache.get(latex);
    if (cached) return cached;
    const result = katex.renderToString(latex, { throwOnError: false, trust: false, strict: "ignore" });
    glyphCache.set(latex, result);
    return result;
  }, [latex]);
  return <span className="formula-glyph" dangerouslySetInnerHTML={{ __html: html }} />;
});

export function FormulaPanel() {
  const panel = usePanelStore();
  const library = useLibraryStore();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("全部");
  const [error, setError] = useState("");
  const entries = useMemo(() => enabledExtensions(library).flatMap((extension) => extension.formulas.map((item) => ({ ...item, key: `${extension.id}/formulas/${item.id}`, search: `${item.name} ${item.tags.join(" ")} ${item.latex}`.toLowerCase() }))), [library.extensions, library.disabled]);
  const favourites = useMemo(() => new Set(library.favourites), [library.favourites]);
  const visible = useMemo(() => entries.filter((item) => (category === "全部" || category === item.category || category === "收藏" && favourites.has(item.key)) && item.search.includes(query.toLowerCase())), [entries, category, favourites, query]);
  if (!panel.formula) return null;
  const selected = panel.formula;
  return <Sheet title="公式助手" onClose={panel.closeFormula} className="formula-sheet">
    <div className="catalogue-search"><Search size={16} /><input autoFocus placeholder="搜索符号或 LaTeX 命令" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
    <nav className="category-tabs">{["全部", "收藏", ...new Set(entries.map((item) => item.category))].map((name) => <button className={category === name ? "active" : ""} key={name} onClick={() => setCategory(name)}>{name}</button>)}</nav>
    <VirtualGrid className="symbol-grid" items={visible} minWidth={112} rowHeight={86} itemKey={(item) => item.key} render={(item) => <div className="symbol-card">
      <button title={item.latex} onClick={() => {
        const latex = renderSnippet(item.latex, selected.selection);
        selected.insert(selected.wrapped ? `\\(${latex.trim()}\\)` : latex);
        panel.closeFormula();
      }}><FormulaGlyph latex={item.preview} /><small>{item.name}</small></button>
      <button className={`symbol-star icon-button ${library.favourites.includes(item.key) ? "active" : ""}`} aria-label="收藏符号" onClick={() => void library.favourite(item.key).catch((failure) => setError(String(failure)))}><Star size={11} /></button>
    </div>} />
    {error && <p className="field-error">{error}</p>}
  </Sheet>;
}
