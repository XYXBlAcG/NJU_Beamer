import { useRef } from "react";
import { importBibliography, serializeBibliography, type BibliographyEntry } from "../domain/bibliography";
import { exportBibliography } from "../services/desktop";

export function BibliographyEditor({ references, onChange, onError }: { references: BibliographyEntry[]; onChange: (references: BibliographyEntry[]) => void; onError: (message: string) => void }) {
  const file = useRef<HTMLInputElement>(null);
  return <details><summary>参考文献</summary><div className="slide-actions"><button onClick={() => file.current?.click()}>导入 BibTeX</button><button onClick={() => void exportBibliography(serializeBibliography(references)).catch((error) => onError(String(error)))}>导出 BibTeX</button></div>
    <input type="file" accept=".bib" hidden ref={file} onChange={(event) => { const input = event.target.files?.[0]; if (input) void input.text().then((source) => { const incoming = importBibliography(source); const keys = new Set(incoming.map((entry) => entry.key)); onChange([...references.filter((entry) => !keys.has(entry.key)), ...incoming]); }).catch((error) => onError(String(error))); event.target.value = ""; }} />
    {references.map((reference, index) => <div className="field-stack" key={index}><label>引用键<input value={reference.key} onChange={(event) => onChange(references.map((entry, i) => i === index ? { ...entry, key: event.target.value } : entry))} /></label><label>类型<input value={reference.type} onChange={(event) => onChange(references.map((entry, i) => i === index ? { ...entry, type: event.target.value } : entry))} /></label>
      {[...new Set(["author", "title", "year", ...Object.keys(reference.fields)])].map((key) => <label key={key}>{({ author: "作者", title: "标题", year: "年份" } as Record<string, string>)[key] ?? key}<input value={reference.fields[key] ?? ""} onChange={(event) => onChange(references.map((entry, i) => i === index ? { ...entry, fields: { ...entry.fields, [key]: event.target.value } } : entry))} /></label>)}
      <button onClick={() => onChange(references.filter((_, i) => i !== index))}>删除文献</button></div>)}
    <button onClick={() => onChange([...references, { key: `ref${references.length + 1}`, type: "book", fields: { author: "", title: "", year: "" } }])}>添加文献</button>
  </details>;
}
