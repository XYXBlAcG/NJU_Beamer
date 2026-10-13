import { useRef, useState } from "react";
import { DndContext, PointerSensor, useSensor, useSensors, closestCenter, useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, ChevronRight, FolderPlus, Plus } from "lucide-react";
import type { EditorCommand } from "../domain/commands";
import { documentPages, movePages, type DocumentPage } from "../domain/pages";
import { useEditorStore } from "../state/editorStore";
import { EditorContextMenu } from "./EditorContextMenu";
import { PageActions } from "./PageActions";

function OutlineItem({ page, index, selected, commands, onSelect }: { page: DocumentPage; index: number; selected: boolean; commands: EditorCommand[]; onSelect: (id: string, range: boolean, toggle: boolean) => void }) {
  const sortable = useSortable({ id: page.id });
  return <EditorContextMenu commands={commands}><button ref={sortable.setNodeRef} {...sortable.attributes} {...sortable.listeners}
    className={`slide-card ${selected ? "selected" : ""} ${"hidden" in page && page.hidden ? "skipped-page" : ""}`} style={{ transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition, opacity: sortable.isDragging ? 0.5 : undefined }}
    onClick={(event) => { event.currentTarget.focus(); onSelect(page.id, event.shiftKey, event.metaKey || event.ctrlKey); }}
    onContextMenu={(event) => { event.currentTarget.focus(); if (!selected) onSelect(page.id, false, false); }} aria-selected={selected} role="option">
    <span>{index + 1}</span><strong>{page.title || "无标题"}</strong>
  </button></EditorContextMenu>;
}

function OutlineSection({ id, title, collapsed, onToggle, onAdd, children }: { id: string; title: string; collapsed: boolean; onToggle: () => void; onAdd: () => void; children: React.ReactNode }) {
  const drop = useDroppable({ id: `section:${id}` });
  return <section ref={drop.setNodeRef} className={`section-group ${drop.isOver ? "drop-section" : ""}`}>
    <div className="section-name"><button className="section-collapse" onClick={onToggle} aria-expanded={!collapsed}>{collapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}<span>{title}</span></button><button className="icon-button" aria-label={`在${title}中新增幻灯片`} onClick={onAdd}><Plus size={15} /></button></div>
    {!collapsed && children}
  </section>;
}

export function DocumentOutline({ commands }: { commands: EditorCommand[] }) {
  const state = useEditorStore();
  const content = state.paper ?? state.deck;
  const pages = documentPages(content);
  const selected = state.selectedPageIds.includes(state.selectedSlideId) ? state.selectedPageIds.filter((id) => pages.some((page) => page.id === id)) : [state.selectedSlideId];
  const anchor = useRef(state.selectedSlideId);
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const select = (id: string, range: boolean, toggle: boolean) => {
    if (range) {
      const start = Math.max(0, pages.findIndex((page) => page.id === anchor.current));
      const end = pages.findIndex((page) => page.id === id);
      state.selectPages(pages.slice(Math.min(start, end), Math.max(start, end) + 1).map((page) => page.id), id);
    } else {
      anchor.current = id;
      const ids = toggle ? selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id] : [id];
      state.selectPages(ids.length ? ids : [id], ids.includes(id) ? id : ids[0]);
    }
  };
  const renderPage = (page: DocumentPage) => <OutlineItem key={page.id} page={page} index={pages.findIndex((item) => item.id === page.id)} selected={selected.includes(page.id)} commands={commands} onSelect={select} />;
  return <aside className="slide-sidebar document-outline" tabIndex={0} aria-label={state.paper ? "论文大纲" : "幻灯片大纲"}>
    <div className="sidebar-heading"><span>{state.paper ? "论文大纲" : "幻灯片"}</span><button className="section-add" onClick={state.paper ? commands.find((command) => command.id === "page.after")?.run : state.addSection}><FolderPlus size={15} />章节</button></div>
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={({ active, over }) => {
      if (!over || active.id === over.id) return;
      const activeId = String(active.id), targetId = String(over.id);
      const ids = selected.includes(activeId) ? selected : [activeId];
      state.applyContent(movePages(content, ids, targetId.startsWith("section:") ? undefined : targetId, targetId.startsWith("section:") ? targetId.slice(8) : undefined)); state.selectPages(ids, activeId);
    }}>
      <SortableContext items={pages.map((page) => page.id)} strategy={verticalListSortingStrategy}>
        {state.paper ? <div role="listbox" aria-multiselectable="true">{state.paper.sections.map(renderPage)}</div> : state.deck.sections.map((section) => <OutlineSection key={section.id} id={section.id} title={section.title} collapsed={collapsed.includes(section.id)} onAdd={() => state.addSlide(section.id)} onToggle={() => setCollapsed((ids) => ids.includes(section.id) ? ids.filter((id) => id !== section.id) : [...ids, section.id])}><div role="listbox" aria-multiselectable="true">{section.slides.map(renderPage)}</div></OutlineSection>)}
      </SortableContext>
    </DndContext>
    <PageActions commands={commands} outline />
    {!state.paper && <div className="outline-actions"><button onClick={() => state.addSlide(state.deck.sections.at(-1)?.id, "ending")}>添加结尾页</button></div>}
  </aside>;
}
