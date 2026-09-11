import { useState } from "react";
import Color from "@tiptap/extension-color";
import Link from "@tiptap/extension-link";
import { TextStyle } from "@tiptap/extension-text-style";
import { Node, mergeAttributes } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
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

type Props = {
  content: RichTextDocument;
  onChange: (content: RichTextDocument) => void;
};

export function RichTextEditor({ content, onChange }: Props) {
  const [footnote, setFootnote] = useState("");
  const [addingFootnote, setAddingFootnote] = useState(false);
  const [link, setLink] = useState("");
  const [editingLink, setEditingLink] = useState(false);
  const editor = useEditor({
    extensions: [StarterKit.configure({ bulletList: false, orderedList: false, listItem: false, link: false }), TextStyle, Color, Link.configure({ openOnClick: false, autolink: false, linkOnPaste: true }), Footnote],
    content,
    onUpdate: ({ editor: current }) => onChange(current.getJSON() as RichTextDocument),
  });

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
    <div className="rich-text-editor">
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
      </div>
      {editingLink && <div className="link-entry"><input autoFocus value={link} placeholder="https://example.com" onChange={(event) => setLink(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") applyLink(); }} /><button onClick={applyLink}>应用</button><button onClick={removeLink}>移除</button></div>}
      {addingFootnote && <div className="footnote-entry"><input autoFocus value={footnote} placeholder="脚注内容" onChange={(event) => setFootnote(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") insertFootnote(); }} /><button onClick={insertFootnote}>插入</button></div>}
      <EditorContent editor={editor} />
    </div>
  );
}
