import { expect, it } from "vitest";
import { RenderQueue } from "./renderQueue";

it("limits concurrent work and skips cancelled queued requests", async () => {
  const queue = new RenderQueue(1);
  let release!: () => void;
  const events: string[] = [];
  const first = queue.run(async () => { events.push("first"); await new Promise<void>((resolve) => { release = resolve; }); });
  const cancelled = queue.run(async () => { events.push("cancelled"); }, () => false);
  const last = queue.run(async () => { events.push("last"); return 7; });
  await Promise.resolve();
  expect(events).toEqual(["first"]);
  release();
  await first;
  await expect(cancelled).rejects.toThrow("已取消");
  expect(await last).toBe(7);
  expect(events).toEqual(["first", "last"]);
});
