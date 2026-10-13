import { decodeNjub, encodeNjub } from "../domain/njub";
import type { Request, Response } from "./archiveWorker";

self.onmessage = (event: MessageEvent<Request>) => {
  const request = event.data;
  let response: Response;
  try { response = { id: request.id, result: request.type === "encode" ? encodeNjub(request.content, request.assets) : decodeNjub(request.bytes) }; }
  catch (error) { response = { id: request.id, error: error instanceof Error ? error.message : String(error) }; }
  self.postMessage(response);
};
