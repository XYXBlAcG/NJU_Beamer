import { Sheet } from "./Sheet";

type Props = {
  action: string;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
  busy?: boolean;
};

export function UnsavedChangesDialog({ action, onSave, onDiscard, onCancel, busy = false }: Props) {
  return (
    <Sheet title="要保存当前文稿吗？" onClose={() => { if (!busy) onCancel(); }} className="unsaved-dialog">
        <p>当前文稿包含尚未保存的更改。保存后再{action}，或放弃这些更改。</p>
        <div className="dialog-actions">
          <button disabled={busy} onClick={onCancel}>取消</button>
          <button disabled={busy} className="danger" onClick={onDiscard}>不保存并{action}</button>
          <button disabled={busy} className="primary" autoFocus onClick={onSave}>{busy ? "正在保存…" : `保存并${action}`}</button>
        </div>
    </Sheet>
  );
}
