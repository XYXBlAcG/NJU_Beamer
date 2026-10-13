import { expect, it } from "vitest";
import { matchingCommand, type EditorCommand } from "./commands";
it("resolves shortcuts from the same commands and skips disabled entries", () => {
  const command: EditorCommand = { id: "save", label: "保存", group: "文件", shortcut: "Mod+Shift+s", enabled: true, run: () => undefined };
  const event = { key: "S", metaKey: true, ctrlKey: false, shiftKey: true, altKey: false };
  expect(matchingCommand([command], event)).toBe(command);
  expect(matchingCommand([{ ...command, enabled: false }], event)).toBeUndefined();
});
it("leaves text clipboard and deletion untouched outside the outline", () => {
  const command: EditorCommand = { id: "page.copy", label: "复制页面", group: "页面", shortcut: "Mod+c", enabled: true, run: () => undefined };
  const event = { key: "c", metaKey: true, ctrlKey: false, shiftKey: false, altKey: false };
  expect(matchingCommand([command], event, "outline")).toBe(command);
  expect(matchingCommand([command], event, "text")).toBeUndefined();
  expect(matchingCommand([command], event, "workspace")).toBeUndefined();
  expect(matchingCommand([{ ...command, id: "edit.copy", group: "编辑" }], event, "text")).toBeUndefined();
  const remove = { ...command, id: "page.delete", shortcut: "Backspace" };
  expect(matchingCommand([remove], { ...event, key: "Delete", metaKey: false }, "outline")).toBe(remove);
});
