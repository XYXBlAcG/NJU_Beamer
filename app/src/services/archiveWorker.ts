import type { DocumentAsset, DocumentContent, NjubArchive } from "../domain/document";

type Request = { id: number } & ({ type: "encode"; content: DocumentContent; assets: DocumentAsset[] } | { type: "decode"; bytes: Uint8Array });
type Response = { id: number; result?: Uint8Array | NjubArchive; error?: string };
let worker: Worker | undefined;
let sequence = 0;
const pending = new Map<number, { resolve: (result: Uint8Array | NjubArchive) => void; reject: (error: Error) => void }>();
function request(input: Omit<Extract<Request, { type: "encode" }>, "id"> | Omit<Extract<Request, { type: "decode" }>, "id">): Promise<Uint8Array | NjubArchive> {
  if (!worker) {
    worker = new Worker(new URL("./archive.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<Response>) => {
      const callback = pending.get(event.data.id);
      if (!callback) return;
      pending.delete(event.data.id);
      if (event.data.error) callback.reject(new Error(event.data.error));
      else callback.resolve(event.data.result!);
    };
    worker.onerror = (event) => {
      for (const callback of pending.values()) callback.reject(new Error(event.message));
      pending.clear(); worker?.terminate(); worker = undefined;
    };
  }
  const id = ++sequence;
  return new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); worker!.postMessage({ id, ...input }); });
}
export const encodeArchive = (content: DocumentContent, assets: DocumentAsset[]) => request({ type: "encode", content, assets }) as Promise<Uint8Array>;
export const decodeArchive = (bytes: Uint8Array) => request({ type: "decode", bytes }) as Promise<NjubArchive>;
export type { Request, Response };
