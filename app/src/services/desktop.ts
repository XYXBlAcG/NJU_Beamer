import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open, save } from "@tauri-apps/plugin-dialog";
import { deckSchema, type Deck } from "../domain/deck";
import { documentJson, referencedAssets, type DocumentAsset } from "../domain/document";

export type CompileResult = {
  success: boolean;
  pdf: number[] | null;
  log: string;
};

export const defaultTemplateDirectory = () => invoke<string>("default_template_directory");

export const compileDocument = (source: string, workspace: string, assets: DocumentAsset[]) =>
  invoke<CompileResult>("compile_document", { source, workspace, assets });

export const saveDeck = async (deck: Deck, assets: DocumentAsset[], currentPath?: string) => {
  const path = currentPath ?? (await save({ defaultPath: "deck.njub", filters: [{ name: "NJU Beamer", extensions: ["njub"] }] }));
  if (!path) return undefined;
  await invoke("write_document", { path, content: documentJson(deck), assets: referencedAssets(deck, assets) });
  return path;
};

export const saveDeckAs = (deck: Deck, assets: DocumentAsset[]) => saveDeck(deck, assets);

export const readDeck = async (path: string) => {
  const document = await invoke<{ content: string; assets: DocumentAsset[] }>("read_document", { path });
  return { path, deck: deckSchema.parse(JSON.parse(document.content)), assets: document.assets };
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

export const exportTexBundle = async (source: string, assets: DocumentAsset[], workspace: string) => {
  const path = await save({ defaultPath: "slides-tex.zip", filters: [{ name: "ZIP", extensions: ["zip"] }] });
  if (!path) return undefined;
  await invoke("export_tex_bundle", { path, source, assets, workspace });
  return path;
};
