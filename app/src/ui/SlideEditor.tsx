import { useRef, useState, type ClipboardEvent, type DragEvent } from "react";
import { Image } from "lucide-react";
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { Deck, Slide } from "../domain/deck";
import { importImageFile } from "../domain/imageImport";
import { useEditorStore } from "../state/editorStore";
import { BlockEditor, blockActions } from "./BlockEditor";

type Props = {
  slide: Slide;
};

const metadataLabels: Record<keyof Deck["metadata"], string> = {
  title: "标题",
  subtitle: "副标题",
  author: "作者",
  institute: "机构",
  date: "日期",
};

export function SlideEditor({ slide }: Props) {
  const deck = useEditorStore((state) => state.deck);
  const updateMetadata = useEditorStore((state) => state.updateMetadata);
  const updateSlide = useEditorStore((state) => state.updateSlide);
  const addBlock = useEditorStore((state) => state.addBlock);
  const addImage = useEditorStore((state) => state.addImage);
  const reorderBlock = useEditorStore((state) => state.reorderBlock);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const imageInput = useRef<HTMLInputElement>(null);
  const [draggingImage, setDraggingImage] = useState(false);
  const [imageError, setImageError] = useState("");

  const importFiles = async (files: File[]) => {
    setImageError("");
    try {
      for (const file of files) addImage(await importImageFile(file), file.name || "粘贴的图片");
    } catch (error) {
      setImageError(error instanceof Error ? error.message : String(error));
    }
  };

  const imageFiles = (files: FileList | null) => Array.from(files ?? []).filter((file) => file.type.startsWith("image/"));
  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    const files = imageFiles(event.dataTransfer.files);
    setDraggingImage(false);
    if (!files.length) return;
    event.preventDefault();
    void importFiles(files);
  };
  const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
    const files = Array.from(event.clipboardData.items)
      .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter((file): file is File => file !== null);
    if (!files.length) return;
    event.preventDefault();
    void importFiles(files);
  };

  if (slide.kind === "title") {
    return (
      <div className="editor-page title-editor">
        {(Object.entries(deck.metadata) as [keyof Deck["metadata"], string][]).map(([key, value]) => (
          <label key={key}>{metadataLabels[key]}<input className={key === "title" ? "title-input" : ""} value={value} onChange={(event) => updateMetadata(key, event.target.value)} /></label>
        ))}
      </div>
    );
  }

  if (slide.kind === "contents") {
    return <div className="editor-page contents-editor"><strong>目录页</strong><span>目录内容将根据章节名称自动生成。</span></div>;
  }

  return (
    <div
      className={`editor-page content-editor ${draggingImage ? "image-dragging" : ""}`}
      onDragEnter={(event) => { if (Array.from(event.dataTransfer.types).includes("Files")) setDraggingImage(true); }}
      onDragOver={(event) => { if (Array.from(event.dataTransfer.types).includes("Files")) event.preventDefault(); }}
      onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDraggingImage(false); }}
      onDrop={handleDrop}
      onPaste={handlePaste}
    >
      <input className="slide-title-input" value={slide.title} placeholder="幻灯片标题" onChange={(event) => updateSlide(slide.id, { title: event.target.value })} />
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={({ active, over }) => { if (over && active.id !== over.id) reorderBlock(String(active.id), String(over.id)); }}>
        <SortableContext items={slide.blocks.map((block) => block.id)} strategy={verticalListSortingStrategy}>
          <div className="editor-blocks">{slide.blocks.map((block) => <BlockEditor key={block.id} block={block} />)}</div>
        </SortableContext>
      </DndContext>
      <div className="add-blocks editor-add-blocks">
        {blockActions.map(({ type, label, icon: Icon }) => <button key={type} onClick={() => addBlock(type)}><Icon size={16} />{label}</button>)}
        <button onClick={() => imageInput.current?.click()}><Image size={16} />图片</button>
        <input ref={imageInput} className="hidden-file-input" type="file" accept="image/png,image/jpeg" multiple onChange={(event) => { void importFiles(Array.from(event.target.files ?? [])); event.target.value = ""; }} />
      </div>
      {imageError && <div className="image-import-error" role="alert">{imageError}</div>}
      {draggingImage && <div className="image-drop-hint">松开以插入图片</div>}
    </div>
  );
}
