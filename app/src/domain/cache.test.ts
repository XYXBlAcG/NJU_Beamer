import { expect, it } from "vitest";
import { LruCache, gridColumns } from "./cache";

it("bounds render cache memory and keeps recently used entries", () => {
  const cache = new LruCache<string, string>(2);
  cache.set("a", "A"); cache.set("b", "B"); cache.get("a"); cache.set("c", "C");
  expect(cache.get("a")).toBe("A"); expect(cache.get("b")).toBeUndefined();
  expect(cache.size).toBe(2);
});
it("calculates responsive grid columns without mounting every item", () => {
  expect(gridColumns(740, 112, 8)).toBe(6);
  expect(gridColumns(0, 112, 8)).toBe(1);
});
