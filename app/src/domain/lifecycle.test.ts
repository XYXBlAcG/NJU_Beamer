import { expect, it } from "vitest";
import { DocumentLifecycle } from "./lifecycle";

it("does not replace or close a document when saving is cancelled or fails", async () => {
  let performed = 0;
  const lifecycle = new DocumentLifecycle(() => "document", async () => { performed++; });
  expect(await lifecycle.run("close", async () => false)).toBe(false);
  await expect(lifecycle.run("new", async () => { throw new Error("disk full"); })).rejects.toThrow("disk full");
  expect(performed).toBe(0);
  expect(lifecycle.busy).toBe(false);
});
it("serializes transitions and preserves edits made while a save is pending", async () => {
  let content = "original";
  let performed = 0;
  let complete!: (value: boolean) => void;
  const lifecycle = new DocumentLifecycle(() => content, async () => { performed++; });
  const saving = lifecycle.run("close", () => new Promise((resolve) => { complete = resolve; }));
  expect(await lifecycle.run("new")).toBe(false);
  content = "edited during save";
  complete(true);
  expect(await saving).toBe(false);
  expect(performed).toBe(0);
  expect(await lifecycle.run("close")).toBe(true);
});
