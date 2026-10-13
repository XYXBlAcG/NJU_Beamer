import type { Extension } from "./extensions";

export type ExtensionReview = { extension: Extension; source: string; sha256: string; replaces?: string };
export async function reviewExtension(extension: Extension, bytes: Uint8Array, source: string, installed: Extension[]): Promise<ExtensionReview> {
  const digest = await crypto.subtle.digest("SHA-256", bytes.slice().buffer as ArrayBuffer);
  return { extension, source, sha256: Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join(""), replaces: installed.find((item) => item.id === extension.id)?.version };
}
