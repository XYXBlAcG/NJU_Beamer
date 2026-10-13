import { AddBlockToolbar } from "./AddBlockToolbar";
import { closestCenter, DndContext, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { createId, type Block } from "../domain/deck";
import type { Paper } from "../domain/paper";
import { importImageFile } from "../domain/imageImport";
import { appendToColumn, newBlock, updateNestedBlock, duplicateContentBlock, moveContentBlock } from "../domain/blocks";
import { useEditorStore } from "../state/editorStore";
import { BlockEditor, BlockEditingContext } from "./BlockEditor";
import { RichTextEditor, ReferenceEditingContext } from "./RichTextEditor";
import { SelectField } from "./SelectField";
import { PdfPreview } from "./PdfPreview";
import { DocumentOutline } from "./DocumentOutline";
import type { EditorCommand } from "../domain/commands";
import { BibliographyEditor } from "./BibliographyEditor";
import { Inspector } from "./Inspector";
import { PageActions } from "./PageActions";

const labels: Record<keyof Paper["metadata"], string> = { title: "标题", englishTitle: "英文标题", author: "作者", department: "院系", major: "专业", supervisor: "导师与职称", studentId: "学号", grade: "年级" };
export function PaperEditor({ paper, mode, pdf, log, onError, commands }: { paper: Paper; mode: "edit" | "preview"; pdf?: Uint8Array; log: string; onError: (message: string) => void; commands: EditorCommand[] }) {
  const assets = useEditorStore((state) => state.assets);
  const selectedId = useEditorStore((state) => state.selectedSlideId);
  const update = useEditorStore((state) => state.updatePaper);
  const section = paper.sections.find((item) => item.id === selectedId) ?? paper.sections[0];
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const setBlocks = (blocks: Block[]) => update({ ...paper, sections: paper.sections.map((item) => item.id === section.id ? { ...item, blocks } : item) });
  const insertImages = async (files: File[]) => {
    try {
      const imported = await Promise.all(files.filter((file) => file.type.startsWith("image/")).map(importImageFile));
      update({ ...paper, sections: paper.sections.map((item) => item.id === section.id ? { ...item, blocks: [...item.blocks, ...imported.map((asset) => ({ id: createId(), type: "image" as const, hidden: false, appearance: "none" as const, fontSize: "normal" as const, source: asset.path, width: 0.8, alt: "图片", caption: "图题", label: `fig:${createId()}` }))] } : item) }, [...assets, ...imported]);
    } catch (error) { onError(String(error)); }
  };
  return <ReferenceEditingContext.Provider value={true}>
    <DocumentOutline commands={commands} />
    <section className={`workspace ${mode}`}>
      {mode === "preview" ? <PdfPreview data={pdf} kind="paper" /> : <div className="editor-page paper-page" onDragOver={(event) => { if (event.dataTransfer.types.includes("Files")) event.preventDefault(); }} onDrop={(event) => { if (event.dataTransfer.files.length) { event.preventDefault(); void insertImages(Array.from(event.dataTransfer.files)); } }} onPaste={(event) => { const files = Array.from(event.clipboardData.files); if (files.length) { event.preventDefault(); void insertImages(files); } }}>
        {section && <><input className="slide-title-input" value={section.title} onChange={(event) => update({ ...paper, sections: paper.sections.map((item) => item.id === section.id ? { ...item, title: event.target.value } : item) })} />
          <BlockEditingContext.Provider value={{ paper: true, assets, update: (id, block) => setBlocks(updateNestedBlock(section.blocks, id, block)), remove: (id) => setBlocks(updateNestedBlock(section.blocks, id)), duplicate: (id) => setBlocks(duplicateContentBlock(section.blocks, id)), addToColumn: (id, type) => setBlocks(appendToColumn(section.blocks, id, newBlock(type))) }}>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={({ active, over }) => { if (over) setBlocks(moveContentBlock(section.blocks, String(active.id), String(over.id))); }}>
              <SortableContext items={section.blocks.map((block) => block.id)} strategy={verticalListSortingStrategy}>{section.blocks.map((block) => <BlockEditor key={block.id} block={block} />)}</SortableContext>
            </DndContext>
          </BlockEditingContext.Provider>
          <AddBlockToolbar onAdd={(type) => setBlocks([...section.blocks, newBlock(type)])} onImages={(files) => void insertImages(files)} />
        </>}
      </div>}
    </section>
    <Inspector><details open><summary>论文设置</summary><div className="field-stack">
      <img className="paper-template-thumbnail" src={`${import.meta.env.BASE_URL}presets/paper-${paper.settings.template}.png`} alt="论文模板预览" draggable={false} />
      <label>模板<SelectField value={paper.settings.template} options={[{ value: "bachelor", label: "南京大学本科论文" }, { value: "master", label: "南京大学硕士论文" }, { value: "doctor", label: "南京大学博士论文" }, { value: "report", label: "南京大学课程报告" }]} onChange={(template) => update({ ...paper, settings: { ...paper.settings, template } })} /></label>
      {Object.entries(paper.metadata).map(([key, value]) => <label key={key}>{labels[key as keyof Paper["metadata"]]}<input value={value} onChange={(event) => update({ ...paper, metadata: { ...paper.metadata, [key]: event.target.value } })} /></label>)}
      <label>正文<SelectField value={paper.settings.bodyFont} options={[{ value: "song", label: "宋体" }, { value: "hei", label: "黑体" }, { value: "kai", label: "楷体" }, { value: "fangsong", label: "仿宋" }]} onChange={(bodyFont) => update({ ...paper, settings: { ...paper.settings, bodyFont } })} /></label>
      <label>A4 页边距（毫米）<input type="number" min={10} max={50} value={paper.settings.marginMm} onChange={(event) => update({ ...paper, settings: { ...paper.settings, marginMm: Number(event.target.value) } })} /></label><label>行距<input type="number" min={1} max={2} step={0.1} value={paper.settings.lineSpacing} onChange={(event) => update({ ...paper, settings: { ...paper.settings, lineSpacing: Number(event.target.value) } })} /></label>
      <label className="toggle"><input type="checkbox" checked={paper.settings.tableOfContents} onChange={(event) => update({ ...paper, settings: { ...paper.settings, tableOfContents: event.target.checked } })} />生成目录</label>
      <label>页眉<input value={paper.settings.header} placeholder="使用模板默认页眉" onChange={(event) => update({ ...paper, settings: { ...paper.settings, header: event.target.value } })} /></label><label>页脚<input value={paper.settings.footer} placeholder="使用模板默认页脚" onChange={(event) => update({ ...paper, settings: { ...paper.settings, footer: event.target.value } })} /></label>
      {paper.settings.template !== "report" && <label>文献样式<SelectField value={paper.settings.bibliographyStyle} options={[{ value: "numeric", label: "顺序编号" }, { value: "author-year", label: "作者—年份" }]} onChange={(bibliographyStyle) => update({ ...paper, settings: { ...paper.settings, bibliographyStyle } })} /></label>}
      <label>自定义 TeX 头<textarea className="mono" value={paper.settings.preamble} onChange={(event) => update({ ...paper, settings: { ...paper.settings, preamble: event.target.value } })} /></label>
      <label>TikZ 库<input value={paper.settings.tikzLibraries.join(",")} onChange={(event) => update({ ...paper, settings: { ...paper.settings, tikzLibraries: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) } })} /></label>
    </div></details>
      {section && <details open><summary>章节</summary><div className="field-stack"><SelectField value={section.level} options={[{ value: "chapter", label: "章" }, { value: "section", label: "节" }, { value: "subsection", label: "小节" }, { value: "appendix", label: "附录" }, { value: "acknowledgement", label: "致谢" }]} onChange={(level) => update({ ...paper, sections: paper.sections.map((item) => item.id === section.id ? { ...item, level } : item) })} /><label>引用标签<input value={section.label} onChange={(event) => update({ ...paper, sections: paper.sections.map((item) => item.id === section.id ? { ...item, label: event.target.value.replace(/[^A-Za-z0-9:._-]/g, "") } : item) })} /></label><PageActions commands={commands} /></div></details>}
      <details><summary>摘要与关键词</summary><RichTextEditor content={paper.abstract} onChange={(abstract) => update({ ...paper, abstract })} /><input placeholder="中文关键词" value={paper.keywords} onChange={(event) => update({ ...paper, keywords: event.target.value })} /><RichTextEditor content={paper.englishAbstract} onChange={(englishAbstract) => update({ ...paper, englishAbstract })} /><input placeholder="English keywords" value={paper.englishKeywords} onChange={(event) => update({ ...paper, englishKeywords: event.target.value })} /></details>
      <BibliographyEditor references={paper.bibliography} onChange={(bibliography) => update({ ...paper, bibliography })} onError={onError} />
      {log && <section className="compile-diagnostics"><strong>编译诊断</strong><pre>{log.split("\n").slice(-30).join("\n")}</pre></section>}
    </Inspector>
  </ReferenceEditingContext.Provider>;
}
