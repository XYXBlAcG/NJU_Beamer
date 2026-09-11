import type { CSSProperties } from "react";
import { CSS } from "@dnd-kit/utilities";
import { useSortable } from "@dnd-kit/sortable";
import { Code2, EyeOff, FunctionSquare, GripVertical, List, ListOrdered, PenTool, Table2, Trash2, Type } from "lucide-react";
import type { Block, FontSize } from "../domain/deck";
import type { DocumentAsset } from "../domain/document";
import { useEditorStore } from "../state/editorStore";
import { RichTextEditor } from "./RichTextEditor";
import { SelectField } from "./SelectField";
import { useEffect, useState } from "react";

const blockNames: Record<Block["type"], string> = {
  text: "文本", list: "列表", formula: "公式", table: "表格", tikz: "TikZ", image: "图片", code: "代码", rawTex: "TeX",
};

const fontSizes = [
  { value: "normal" as const, label: "正常" },
  { value: "small" as const, label: "小" },
  { value: "footnotesize" as const, label: "脚注大小" },
  { value: "scriptsize" as const, label: "更小" },
  { value: "tiny" as const, label: "最小" },
];

const formulaLayouts = [
  { value: "single" as const, label: "单行" },
  { value: "aligned" as const, label: "多行对齐" },
  { value: "multline" as const, label: "长公式换行" },
];

const revealModes = [
  { value: "none" as const, label: "同时显示" },
  { value: "overlay-alert" as const, label: "逐项显示并高亮" },
  { value: "pause" as const, label: "逐项暂停" },
];

function EmbeddedImage({ asset, alt }: { asset?: DocumentAsset; alt: string }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!asset) { setUrl(""); return; }
    const next = URL.createObjectURL(new Blob([Uint8Array.from(asset.content)], { type: asset.mimeType }));
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [asset]);
  return url ? <img className="embedded-image" src={url} alt={alt} draggable={false} /> : <div className="missing-image">图片资源不存在</div>;
}

export function BlockEditor({ block }: { block: Block }) {
  const update = useEditorStore((state) => state.updateBlock);
  const remove = useEditorStore((state) => state.removeBlock);
  const imageAsset = useEditorStore((state) => block.type === "image" ? state.assets.find((asset) => asset.path === block.source) : undefined);
  const sortable = useSortable({ id: block.id });
  const style: CSSProperties = { transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition };
  const updateFontSize = (fontSize: FontSize) => update(block.id, { ...block, fontSize });

  return (
    <article ref={sortable.setNodeRef} style={style} className={`block-editor ${block.hidden ? "hidden-block" : ""} ${sortable.isDragging ? "dragging" : ""}`}>
      <header>
        <span className="block-identity"><button className="drag-handle" aria-label="拖动内容块" {...sortable.attributes} {...sortable.listeners}><GripVertical size={16} /></button>{blockNames[block.type]}</span>
        <span className="block-controls">
          <span className="block-font-size"><SelectField value={block.fontSize} options={fontSizes} onChange={updateFontSize} /></span>
          <button className={`icon-button ${block.hidden ? "active" : ""}`} aria-label={block.hidden ? "显示内容块" : "隐藏内容块"} onClick={() => update(block.id, { ...block, hidden: !block.hidden })}><EyeOff size={15} /></button>
          <button className="icon-button danger" aria-label="删除内容块" onClick={() => remove(block.id)}><Trash2 size={15} /></button>
        </span>
      </header>
      {block.type === "text" && <RichTextEditor content={block.content} onChange={(content) => update(block.id, { ...block, content })} />}
      {block.type === "list" && <div className="field-stack">
        <div className="inline-fields"><label className="toggle"><input type="checkbox" checked={block.ordered} onChange={(event) => update(block.id, { ...block, ordered: event.target.checked })} />有序列表</label><label>显示方式<SelectField value={block.reveal} options={revealModes} onChange={(reveal) => update(block.id, { ...block, reveal })} /></label></div>
        <textarea value={block.items.join("\n")} onChange={(event) => update(block.id, { ...block, items: event.target.value.split("\n") })} />
      </div>}
      {block.type === "formula" && <div className="field-stack">
        <div className="inline-fields"><label>排版<SelectField value={block.layout} options={formulaLayouts} onChange={(layout) => update(block.id, { ...block, layout })} /></label><label className="toggle"><input type="checkbox" checked={block.numbered} onChange={(event) => update(block.id, { ...block, numbered: event.target.checked })} />显示编号</label></div>
        <textarea className="mono" value={block.latex} onChange={(event) => update(block.id, { ...block, latex: event.target.value })} />
      </div>}
      {block.type === "table" && <div className="field-stack">
        <label className="toggle"><input type="checkbox" checked={block.header} onChange={(event) => update(block.id, { ...block, header: event.target.checked })} />首行为表头</label>
        <div className="table-grid" style={{ "--columns": block.columns.length } as CSSProperties}>
          {block.columns.map((cell, index) => <input key={`header-${index}`} value={cell} onChange={(event) => update(block.id, { ...block, columns: block.columns.map((value, cellIndex) => cellIndex === index ? event.target.value : value) })} />)}
          {block.rows.flatMap((row, rowIndex) => block.columns.map((_, columnIndex) => <input key={`${rowIndex}-${columnIndex}`} value={row[columnIndex] ?? ""} onChange={(event) => update(block.id, { ...block, rows: block.rows.map((current, currentIndex) => currentIndex === rowIndex ? block.columns.map((__, index) => index === columnIndex ? event.target.value : current[index] ?? "") : current) })} />))}
        </div>
        <div className="table-actions"><button onClick={() => update(block.id, { ...block, rows: [...block.rows, block.columns.map(() => "")] })}>添加行</button><button disabled={block.rows.length === 0} onClick={() => update(block.id, { ...block, rows: block.rows.slice(0, -1) })}>删除末行</button><button onClick={() => update(block.id, { ...block, columns: [...block.columns, `列 ${block.columns.length + 1}`], rows: block.rows.map((row) => [...row, ""]) })}>添加列</button><button disabled={block.columns.length <= 1} onClick={() => update(block.id, { ...block, columns: block.columns.slice(0, -1), rows: block.rows.map((row) => row.slice(0, -1)) })}>删除末列</button></div>
      </div>}
      {block.type === "tikz" && <textarea className="mono tall" value={block.source} onChange={(event) => update(block.id, { ...block, source: event.target.value })} />}
      {block.type === "image" && <div className="field-stack image-fields"><EmbeddedImage asset={imageAsset} alt={block.alt} /><span className="image-name">{block.source.split("/").pop()}</span><label>替代文本<input value={block.alt} onChange={(event) => update(block.id, { ...block, alt: event.target.value })} /></label><label>宽度<input type="range" min="0.1" max="1" step="0.05" value={block.width} onChange={(event) => update(block.id, { ...block, width: Number(event.target.value) })} /></label></div>}
      {block.type === "code" && <div className="field-stack"><label>语言<input value={block.language} onChange={(event) => update(block.id, { ...block, language: event.target.value })} /></label><textarea className="mono" value={block.content} onChange={(event) => update(block.id, { ...block, content: event.target.value })} /></div>}
      {block.type === "rawTex" && <textarea className="mono tall" value={block.source} onChange={(event) => update(block.id, { ...block, source: event.target.value })} />}
    </article>
  );
}

export const blockActions = [
  { type: "text" as const, label: "文本", icon: Type },
  { type: "list" as const, label: "列表", icon: List },
  { type: "formula" as const, label: "公式", icon: FunctionSquare },
  { type: "table" as const, label: "表格", icon: Table2 },
  { type: "tikz" as const, label: "TikZ", icon: PenTool },
  { type: "code" as const, label: "代码", icon: Code2 },
  { type: "rawTex" as const, label: "TeX", icon: ListOrdered },
];
