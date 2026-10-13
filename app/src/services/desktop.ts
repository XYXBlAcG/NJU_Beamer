import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open, save } from "@tauri-apps/plugin-dialog";
import { type DocumentContent, type DocumentAsset } from "../domain/document";
import { decodeArchive, encodeArchive } from "./archiveWorker";

export type CompileResult = {
  success: boolean;
  pdf: number[] | null;
  log: string;
};

export const defaultTemplateDirectory = () => invoke<string>("default_template_directory");

export const compileDocument = (source: string, workspace: string, assets: DocumentAsset[], preview = false, cacheKey?: string) =>
  invoke<CompileResult>("compile_document", { source, workspace, assets, preview, cacheKey });

export const readAppState = async (key: string) => {
  const bytes = await invoke<number[] | null>("read_app_state", { key });
  return bytes ? new Uint8Array(bytes) : undefined;
};
export const writeAppState = (key: string, bytes?: Uint8Array) => invoke<void>("write_app_state", { key, content: bytes ? Array.from(bytes) : null });
export const exitApp = () => invoke<void>("exit_app");
export const performTextAction = (action: "cut" | "copy" | "paste" | "selectAll") => isTauri()
  ? invoke<void>("perform_text_action", { action })
  : Promise.resolve(document.execCommand(action));
export const exportExtension = async (bytes: Uint8Array, name: string) => {
  const path = await save({ defaultPath: `${name}.njup`, filters: [{ name: "NJU 扩展包", extensions: ["njup"] }] });
  if (path) await invoke("write_binary_file", { path, content: Array.from(bytes) });
  return path;
};
export const exportBibliography = async (content: string) => {
  const path = await save({ defaultPath: "references.bib", filters: [{ name: "BibTeX", extensions: ["bib"] }] });
  if (path) await invoke("write_binary_file", { path, content: Array.from(new TextEncoder().encode(content)) });
  return path;
};

export const saveDeck = async (deck: DocumentContent, assets: DocumentAsset[], currentPath?: string) => {
  const path = currentPath ?? (await save({ defaultPath: "deck.njub", filters: [{ name: "NJU Beamer", extensions: ["njub"] }] }));
  if (!path) return undefined;
  await invoke("write_binary_file", { path, content: Array.from(await encodeArchive(deck, assets)) });
  return path;
};

export const saveDeckAs = (deck: DocumentContent, assets: DocumentAsset[]) => saveDeck(deck, assets);

export const readDeck = async (path: string) => {
  const document = await decodeArchive(new Uint8Array(await invoke<number[]>("read_binary_file", { path })));
  return { path, ...document };
};

export const openDeck = async () => {
  const path = await open({ multiple: false, filters: [{ name: "NJU Beamer", extensions: ["njub"] }] });
  if (!path) return undefined;
  return readDeck(path);
};

export const registerOpenDocumentListener = async (handler: (paths: string[]) => void) => {
  const unlisten = await listen<string[]>("open-documents", (event) => handler(event.payload));
  const pending = await invoke<string[]>("register_open_document_listener");
  if (pending.length) handler(pending);
  return unlisten;
};

export const exportPdf = async (pdf: Uint8Array) => {
  const path = await save({ defaultPath: "slides.pdf", filters: [{ name: "PDF", extensions: ["pdf"] }] });
  if (!path) return undefined;
  await invoke("write_binary_file", { path, content: Array.from(pdf) });
  return path;
};

export const exportTexBundle = async (source: string, assets: DocumentAsset[], workspace: string, paper = false) => {
  const path = await save({ defaultPath: "slides-tex.zip", filters: [{ name: "ZIP", extensions: ["zip"] }] });
  if (!path) return undefined;
  await invoke("export_tex_bundle", { path, source, assets, workspace, paper });
  return path;
};
