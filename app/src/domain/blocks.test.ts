import { expect, it } from "vitest";
import { newBlock, duplicateContentBlock, moveContentBlock } from "./blocks";

it("moves nested content between columns without losing the source tree", () => {
  const columns = newBlock("columns");
  if (columns.type !== "columns") throw new Error("wrong block");
  const first = columns.columns[0].blocks[0];
  const second = columns.columns[1].blocks[0];
  const moved = moveContentBlock([columns], first.id, second.id)[0];
  expect(moved.type === "columns" && moved.columns[0].blocks.length).toBe(0);
  expect(moved.type === "columns" && moved.columns[1].blocks[0].id).toBe(first.id);
  expect(columns.columns[0].blocks.length).toBe(1);
});
it("duplicates nested blocks and gives clones independent labels", () => {
  const block = { ...newBlock("formula"), label: "eq:one" };
  const result = duplicateContentBlock([block], block.id);
  expect(result).toHaveLength(2);
  expect(result[1].id).not.toBe(result[0].id);
  expect(result[1].label).toBeUndefined();
});
