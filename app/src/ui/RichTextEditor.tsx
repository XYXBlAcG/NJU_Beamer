import { createContext, useContext, useEffect, useState } from "react";
import { usePanelStore } from "../state/panelStore";
import Color from "@tiptap/extension-color";
import Link from "@tiptap/extension-link";
import { TextStyle } from "@tiptap/extension-text-style";
import { Node, mergeAttributes } from "@tiptap/core";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { EditorContextMenu } from "./EditorContextMenu";
import { richText } from "../domain/deck";
import type { RichTextDocument } from "../domain/deck";

const Footnote = Node.create({
  name: "footnote",
  group: "inline",
  inline: true,
  atom: true,
  addAttributes: () => ({ text: { default: "" } }),
  parseHTML: () => [{ tag: "span[data-footnote]" }],
  renderHTML: ({ HTMLAttributes }) => ["span", mergeAttributes(HTMLAttributes, { "data-footnote": "" }), `〔${HTMLAttributes.text}〕`],
});
const Citation = Node.create({ name: "citation", group: "inline", inline: true, atom: true, addAttributes: () => ({ key: { default: "" } }), parseHTML: () => [{ tag: "span[data-citation]" }], renderHTML: ({ HTMLAttributes }) => ["span", mergeAttributes(HTMLAttributes, { "data-citation": "" }), `[${HTMLAttributes.key}]`] });
const Reference = Node.create({ name: "reference", group: "inline", inline: true, atom: true, addAttributes: () => ({ key: { default: "" } }), parseHTML: () => [{ tag: "span[data-reference]" }], renderHTML: ({ HTMLAttributes }) => ["span", mergeAttributes(HTMLAttributes, { "data-reference": "" }), `↗ ${HTMLAttributes.key}`] });

type Props = {
  content: RichTextDocument;
  onChange: (content: RichTextDocument) => void;
};
export const ReferenceEditingContext = createContext(false);

export function RichTextEditor({ content, onChange }: Props) {
  const referencesEnabled = useContext(ReferenceEditingContext);
  const openFormula = usePanelStore((state) => state.openFormula);
  const [footnote, setFootnote] = useState("");
  const [addingFootnote, setAddingFootnote] = useState(false);
  const [link, setLink] = useState("");
  const [editingLink, setEditingLink] = useState(false);
  const [reference, setReference] = useState<{ type: "citation" | "reference"; key: string }>();
  const [clipboardError, setClipboardError] = useState("");
  const editor = useEditor({
    extensions: [StarterKit.configure({ bulletList: false, orderedList: false, listItem: false, link: false, undoRedo: false }), TextStyle, Color, Link.configure({ openOnClick: false, autolink: false, linkOnPaste: true }), Footnote, Citation, Reference],
    content,
    onUpdate: ({ editor: current }) => onChange(current.getJSON() as RichTextDocument),
  });
  const selection = useEditorState({ editor, selector: ({ editor: current }) => ({ empty: current?.state.selection.empty ?? true, bold: current?.isActive("bold"), italic: current?.isActive("italic"), link: current?.isActive("link") }) });
  useEffect(() => {
    if (editor && JSON.stringify(editor.getJSON()) !== JSON.stringify(content)) editor.commands.setContent(content, { emitUpdate: false });
  }, [content, editor]);

  if (!editor) return null;
  const insertFootnote = () => {
    if (!footnote.trim()) return;
    editor.chain().focus().insertContent({ type: "footnote", attrs: { text: footnote.trim() } }).run();
    setFootnote("");
    setAddingFootnote(false);
  };
  const openLinkEditor = () => {
    setLink(String(editor.getAttributes("link").href ?? "https://"));
    setEditingLink(true);
  };
  const applyLink = () => {
    if (!link.trim()) return;
    editor.chain().focus().extendMarkRange("link").setLink({ href: link.trim() }).run();
    setEditingLink(false);
  };
  const removeLink = () => {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    setEditingLink(false);
  };

  return (
    <EditorContextMenu commands={[
      { id: "text.copy", label: "复制文字", enabled: !selection?.empty, run: () => { const { from, to } = editor.state.selection; void navigator.clipboard.writeText(editor.state.doc.textBetween(from, to, "\n")).catch((error) => setClipboardError(String(error))); } },
      { id: "text.cut", label: "剪切文字", enabled: !selection?.empty, run: () => { const { from, to } = editor.state.selection; void navigator.clipboard.writeText(editor.state.doc.textBetween(from, to, "\n")).then(() => editor.chain().focus().deleteRange({ from, to }).run()).catch((error) => setClipboardError(String(error))); } },
      { id: "text.paste", label: "粘贴纯文本", enabled: true, run: () => { void navigator.clipboard.readText().then((text) => editor.chain().focus().insertContent(richText(text).content ?? []).run()).catch((error) => setClipboardError(String(error))); } },
      { id: "text.all", label: "全选文字", enabled: true, run: () => { editor.chain().focus().selectAll().run(); } },
      { id: "text.bold", label: "粗体", enabled: true, run: () => { editor.chain().focus().toggleBold().run(); } },
      { id: "text.italic", label: "斜体", enabled: true, run: () => { editor.chain().focus().toggleItalic().run(); } },
      { id: "text.link", label: "添加 / 编辑超链接", enabled: true, run: openLinkEditor },
      { id: "text.footnote", label: "添加脚注", enabled: true, run: () => setAddingFootnote(true) },
    ]}><div className="rich-text-editor">
      <div className="rich-toolbar">
        <button className={editor.isActive("bold") ? "active" : ""} onClick={() => editor.chain().focus().toggleBold().run()}>B</button>
        <button className={editor.isActive("italic") ? "active" : ""} onClick={() => editor.chain().focus().toggleItalic().run()}><i>I</i></button>
        {["#63065f", "#d32f2f", "#1976d2", "#2e7d32", "#222222"].map((color) => (
          <button key={color} className="color-swatch" style={{ background: color }} aria-label={`文字颜色 ${color}`} onClick={() => editor.chain().focus().setColor(color).run()} />
        ))}
        <input type="color" aria-label="自定义文字颜色" onChange={(event) => editor.chain().focus().setColor(event.target.value).run()} />
        <button onClick={() => editor.chain().focus().unsetColor().run()}>清除颜色</button>
        <button className={editor.isActive("link") ? "active" : ""} onClick={openLinkEditor}>链接</button>
        <button onClick={() => setAddingFootnote((value) => !value)}>脚注</button>
        {referencesEnabled && <><button onClick={() => setReference({ type: "citation", key: "" })}>文献引用</button><button onClick={() => setReference({ type: "reference", key: "" })}>交叉引用</button></>}
        <button onClick={() => {
          const { from, to } = editor.state.selection;
          openFormula(editor.state.doc.textBetween(from, to), (latex) => editor.chain().focus().insertContentAt({ from, to }, { type: "text", text: latex }).run(), true);
        }}>公式</button>
      </div>
      {editingLink && <div className="link-entry"><input autoFocus value={link} placeholder="https://example.com" onChange={(event) => setLink(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") applyLink(); }} /><button onClick={applyLink}>应用</button><button onClick={removeLink}>移除</button></div>}
      {addingFootnote && <div className="footnote-entry"><input autoFocus value={footnote} placeholder="脚注内容" onChange={(event) => setFootnote(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") insertFootnote(); }} /><button onClick={insertFootnote}>插入</button></div>}
      {reference && <div className="footnote-entry"><input autoFocus value={reference.key} placeholder={reference.type === "citation" ? "文献引用键，如 ref1" : "标签，如 fig:result"} onChange={(event) => setReference({ ...reference, key: event.target.value })} /><button disabled={!/^[A-Za-z0-9:._-]+$/.test(reference.key)} onClick={() => { editor.chain().focus().insertContent({ type: reference.type, attrs: { key: reference.key } }).run(); setReference(undefined); }}>插入</button><button onClick={() => setReference(undefined)}>取消</button></div>}
      <EditorContent editor={editor} />
      {clipboardError && <div className="field-error" role="alert">{clipboardError}</div>}
    </div></EditorContextMenu>
  );
}
