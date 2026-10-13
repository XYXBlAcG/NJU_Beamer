import { useRef } from "react";
import { FunctionSquare } from "lucide-react";
import { usePanelStore } from "../state/panelStore";

export function LatexInput({ value, onChange, multiline = false, wrapped = true, className = "" }: { value: string; onChange: (value: string) => void; multiline?: boolean; wrapped?: boolean; className?: string }) {
  const field = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const openFormula = usePanelStore((state) => state.openFormula);
  const range = useRef({ start: 0, end: 0 });
  const props = {
    value, className,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(event.target.value),
    onSelect: () => { range.current = { start: field.current?.selectionStart ?? value.length, end: field.current?.selectionEnd ?? value.length }; },
  };
  return <div className={`latex-input ${multiline ? "multiline" : ""}`}>
    {multiline ? <textarea ref={(element) => { field.current = element; }} {...props} /> : <input ref={(element) => { field.current = element; }} {...props} />}
    <button className="icon-button formula-trigger" title="公式助手" aria-label="公式助手" onClick={() => {
      const { start, end } = range.current;
      openFormula(value.slice(start, end), (latex) => {
        onChange(value.slice(0, start) + latex + value.slice(end));
        requestAnimationFrame(() => { field.current?.focus(); field.current?.setSelectionRange(start + latex.length, start + latex.length); });
      }, wrapped);
    }}><FunctionSquare size={15} /></button>
  </div>;
}
