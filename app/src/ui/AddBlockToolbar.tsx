import { useRef } from "react";
import { Image } from "lucide-react";
import { blockActions } from "./BlockEditor";
import type { InsertableBlockType } from "../domain/blocks";

export function AddBlockToolbar({ onAdd, onImages }: { onAdd: (type: InsertableBlockType) => void; onImages: (files: File[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  return <div className="add-blocks editor-add-blocks" role="toolbar" aria-label="添加内容块">
    {blockActions.map(({ type, label, icon: Icon }) => <button key={type} onClick={() => onAdd(type)}><Icon size={16} />{label}</button>)}
    <button onClick={() => input.current?.click()}><Image size={16} />图片</button>
    <input ref={input} hidden type="file" multiple accept="image/png,image/jpeg" onChange={(event) => { onImages(Array.from(event.target.files ?? [])); event.target.value = ""; }} />
  </div>;
}
