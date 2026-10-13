import { useEffect, useState } from "react";
import type { PresetEntry } from "../domain/presetPreview";
import { presetThumbnail } from "../services/presetThumbnails";

export function PresetThumbnail({ entry, workspace }: { entry: PresetEntry; workspace: string }) {
  const builtIn = entry.key.startsWith("builtin/");
  const [image, setImage] = useState("");
  const [message, setMessage] = useState("正在生成预览…");
  useEffect(() => {
    if (builtIn) return;
    if (!workspace) { setMessage("未生成：需要 XeLaTeX"); return; }
    let active = true;
    setImage(""); setMessage("正在生成预览…");
    void presetThumbnail(entry, workspace, () => active).then((result) => { if (active) setImage(result); }).catch((error) => { if (active) setMessage(String(error)); });
    return () => { active = false; };
  }, [entry, workspace, builtIn]);
  const url = builtIn ? `${import.meta.env.BASE_URL}presets/${entry.kind}-${entry.item.id}.png` : image;
  return url ? <img className="preset-thumbnail" src={url} alt={entry.item.name} loading="lazy" draggable={false} /> : <span className="preset-preview-status">{message}</span>;
}
