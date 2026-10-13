import { create } from "zustand";
import { createId, defaultFrameOptions, type Slide } from "../domain/deck";
import { copyPages, deletePages, documentPages, movePages, pastePages, type PageClipboard } from "../domain/pages";
import type { EditorCommand } from "../domain/commands";
import { useEditorStore } from "../state/editorStore";

const useClipboard = create<{ value?: PageClipboard; set: (value: PageClipboard) => void }>((set) => ({ set: (value) => set({ value }) }));

export function usePageCommands(onMove: () => void, onError: (message: string) => void): EditorCommand[] {
  const state = useEditorStore();
  const clipboard = useClipboard();
  const content = state.paper ?? state.deck;
  const pages = documentPages(content);
  const ids = (state.selectedPageIds.includes(state.selectedSlideId) ? state.selectedPageIds : [state.selectedSlideId]).filter((id) => pages.some((page) => page.id === id));
  const enabled = state.hasDocument && ids.length > 0;
  const remove = () => state.applyContent(deletePages(content, ids));
  const paste = (value: PageClipboard) => {
    try {
      const result = pastePages(content, state.assets, value, state.selectedSlideId);
      state.applyContent(result.content, result.assets, result.ids[0]); state.selectPages(result.ids, result.ids[0]);
    } catch (error) { onError(String(error)); }
  };
  const insert = (before: boolean) => {
    const id = createId();
    if ("kind" in content) {
      const index = content.sections.findIndex((page) => page.id === state.selectedSlideId) + (before ? 0 : 1);
      state.applyContent({ ...content, sections: [...content.sections.slice(0, index), { id, title: "新章节", level: "chapter", label: "", blocks: [] }, ...content.sections.slice(index)] }, undefined, id);
    } else {
      const page: Slide = { id, title: "新幻灯片", kind: "content", blocks: [], frame: { ...defaultFrameOptions }, notes: "" };
      state.applyContent({ ...content, sections: content.sections.map((section) => {
        const index = section.slides.findIndex((item) => item.id === state.selectedSlideId);
        if (index < 0) return section;
        const position = index + (before ? 0 : 1);
        return { ...section, slides: [...section.slides.slice(0, position), page, ...section.slides.slice(position)] };
      }) }, undefined, id);
    }
  };
  return [
    { id: "page.copy", label: "复制页面 / 章节", shortcut: "Mod+c", run: () => clipboard.set(copyPages(content, state.assets, ids)) },
    { id: "page.cut", label: "剪切页面 / 章节", shortcut: "Mod+x", enabled: enabled && ids.length < pages.length, run: () => { clipboard.set(copyPages(content, state.assets, ids)); remove(); } },
    { id: "page.paste", label: "粘贴页面 / 章节", shortcut: "Mod+v", enabled: state.hasDocument && Boolean(clipboard.value) && ("kind" in content) === Boolean(clipboard.value && "kind" in clipboard.value.content), run: () => { if (clipboard.value) paste(clipboard.value); } },
    { id: "page.duplicate", label: "创建副本", shortcut: "Mod+d", run: () => paste(copyPages(content, state.assets, ids)) },
    { id: "page.before", label: "在前面插入", run: () => insert(true) },
    { id: "page.after", label: "在后面插入", run: () => insert(false) },
    { id: "page.move", label: "移动到…", run: onMove },
    { id: "page.first", label: "移到开头", run: () => state.applyContent(movePages(content, ids, pages[0].id)) },
    { id: "page.last", label: "移到末尾", run: () => state.applyContent(movePages(content, ids, undefined, "kind" in content ? undefined : content.sections.at(-1)?.id)) },
    ...(!state.paper ? [{ id: "page.skip", label: "跳过 / 显示幻灯片", run: () => state.applyContent({ ...state.deck, sections: state.deck.sections.map((section) => ({ ...section, slides: section.slides.map((page) => ids.includes(page.id) ? { ...page, hidden: !page.hidden } : page) })) }) }] : []),
    { id: "page.delete", label: "删除选中项", shortcut: "Backspace", enabled: enabled && ids.length < pages.length, run: remove },
    { id: "page.selectAll", label: "全选页面 / 章节", shortcut: "Mod+a", run: () => state.selectPages(pages.map((page) => page.id), state.selectedSlideId) },
  ].map((command) => ({ group: "页面", enabled, ...command }));
}
