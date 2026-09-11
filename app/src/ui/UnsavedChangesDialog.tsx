type Props = {
  action: string;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
};

export function UnsavedChangesDialog({ action, onSave, onDiscard, onCancel }: Props) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="unsaved-dialog" role="alertdialog" aria-modal="true" aria-labelledby="unsaved-title">
        <h2 id="unsaved-title">要保存当前文稿吗？</h2>
        <p>当前文稿包含尚未保存的更改。保存后再{action}，或放弃这些更改。</p>
        <div className="dialog-actions">
          <button onClick={onCancel}>取消</button>
          <button className="danger" onClick={onDiscard}>不保存并{action}</button>
          <button className="primary" autoFocus onClick={onSave}>保存并{action}</button>
        </div>
      </section>
    </div>
  );
}
