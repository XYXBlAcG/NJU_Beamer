import { Plus, Trash2 } from "lucide-react";
import type { BodyFont } from "../domain/deck";
import { useEditorStore } from "../state/editorStore";
import { SelectField } from "./SelectField";

const bodyFonts: Array<{ value: BodyFont; label: string }> = [
  { value: "song", label: "宋体" },
  { value: "hei", label: "黑体" },
  { value: "kai", label: "楷体" },
  { value: "fangsong", label: "仿宋" },
];

export function DocumentSettings() {
  const settings = useEditorStore((state) => state.deck.settings);
  const updateSettings = useEditorStore((state) => state.updateSettings);

  return (
    <div className="field-stack document-settings">
      <label className="toggle"><input type="checkbox" checked={settings.sectionTitleSlides} onChange={(event) => updateSettings({ sectionTitleSlides: event.target.checked })} />章节开始时生成单独标题页</label>
      <label>正文字体<SelectField value={settings.bodyFont} options={bodyFonts} onChange={(bodyFont) => updateSettings({ bodyFont })} /></label>
      <label>TikZ 库<input value={settings.tikzLibraries.join(", ")} placeholder="arrows.meta, positioning" onChange={(event) => updateSettings({ tikzLibraries: event.target.value.split(",").map((value) => value.trim()).filter((value) => /^[A-Za-z0-9._-]+$/.test(value)) })} /></label>
      <div className="settings-heading"><span>LaTeX 包</span><button onClick={() => updateSettings({ packages: [...settings.packages, { name: "amsfonts", options: "" }] })}><Plus size={14} />添加</button></div>
      {settings.packages.map((entry, index) => <div className="package-row" key={index}>
        <input aria-label="包名" value={entry.name} onChange={(event) => {
          const name = event.target.value.replace(/[^A-Za-z0-9._-]/g, "");
          if (name) updateSettings({ packages: settings.packages.map((item, itemIndex) => itemIndex === index ? { ...item, name } : item) });
        }} />
        <input aria-label="包选项" value={entry.options} placeholder="选项" onChange={(event) => updateSettings({ packages: settings.packages.map((item, itemIndex) => itemIndex === index ? { ...item, options: event.target.value } : item) })} />
        <button className="icon-button danger" aria-label="删除包" onClick={() => updateSettings({ packages: settings.packages.filter((_, itemIndex) => itemIndex !== index) })}><Trash2 size={14} /></button>
      </div>)}
    </div>
  );
}
