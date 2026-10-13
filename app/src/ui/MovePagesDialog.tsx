import { useState } from "react";
import { documentPages, movePages } from "../domain/pages";
import { useEditorStore } from "../state/editorStore";
import { Sheet } from "./Sheet";
import { SelectField } from "./SelectField";

export function MovePagesDialog({ onClose }: { onClose: () => void }) {
  const state = useEditorStore();
  const content = state.paper ?? state.deck;
  const ids = state.selectedPageIds.includes(state.selectedSlideId) ? state.selectedPageIds : [state.selectedSlideId];
  const [target, setTarget] = useState("");
  const options = [...documentPages(content).filter((page) => !ids.includes(page.id)).map((page, index) => ({ value: page.id, label: `在 ${index + 1} · ${page.title} 前` })), ...("kind" in content ? [{ value: "end", label: "文档末尾" }] : content.sections.map((section) => ({ value: `section:${section.id}`, label: `${section.title} · 章节末尾` })))];
  return <Sheet title="移动选中页面 / 章节" className="command-sheet" onClose={onClose}><div className="dialog-body"><SelectField value={target || options[0]?.value || "end"} options={options} onChange={setTarget} /></div><div className="dialog-actions"><button onClick={onClose}>取消</button><button className="primary" onClick={() => {
    const destination = target || options[0]?.value;
    state.applyContent(movePages(content, ids, destination === "end" || destination?.startsWith("section:") ? undefined : destination, destination?.startsWith("section:") ? destination.slice(8) : undefined)); state.selectPages(ids, state.selectedSlideId); onClose();
  }}>移动</button></div></Sheet>;
}
