import type { DocumentContent } from "../domain/document";
import type { DocumentAsset } from "../domain/document";
import { decodeArchive, encodeArchive } from "./archiveWorker";
import { readAppState, writeAppState } from "./desktop";
import { z } from "zod";

const assetSignatures = new WeakMap<DocumentAsset[], string>();
export const documentSignature = (deck: DocumentContent, assets: DocumentAsset[]) => {
  let signature = assetSignatures.get(assets);
  if (!signature) { signature = JSON.stringify(assets); assetSignatures.set(assets, signature); }
  return JSON.stringify(deck) + signature;
};
const recentSchema = z.array(z.string()).max(12);
let recoveryWrite = Promise.resolve();
let recoveryGeneration = 0;
export const saveRecovery = (deck: DocumentContent, assets: DocumentAsset[]) => {
  const generation = recoveryGeneration;
  recoveryWrite = recoveryWrite.catch(() => undefined).then(async () => {
    if (generation !== recoveryGeneration) return;
    const bytes = await encodeArchive(deck, assets);
    if (generation === recoveryGeneration) await writeAppState("recovery.njub", bytes);
  });
  return recoveryWrite;
};
export const clearRecovery = () => {
  ++recoveryGeneration;
  recoveryWrite = recoveryWrite.catch(() => undefined).then(() => writeAppState("recovery.njub"));
  return recoveryWrite;
};
export const readRecovery = async () => {
  const bytes = await readAppState("recovery.njub");
  return bytes ? decodeArchive(bytes) : undefined;
};
export const readRecents = async () => {
  const bytes = await readAppState("recents.json");
  return bytes ? recentSchema.parse(JSON.parse(new TextDecoder().decode(bytes))) : [];
};
export const rememberDocument = async (path: string) => {
  const recents = [path, ...(await readRecents()).filter((item) => item !== path)].slice(0, 12);
  await writeAppState("recents.json", new TextEncoder().encode(JSON.stringify(recents)));
  return recents;
};
