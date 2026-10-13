import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

export function Sheet({ title, onClose, children, className = "" }: { title: string; onClose: () => void; children: ReactNode; className?: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
    return () => dialog.current?.close();
  }, []);
  return <dialog ref={dialog} className={`sheet ${className}`} onCancel={(event) => { event.preventDefault(); onClose(); }}>
    <header className="sheet-title"><strong>{title}</strong><button className="icon-button" aria-label="关闭面板" onClick={onClose}><X size={18} /></button></header>
    {children}
  </dialog>;
}
