import { afterEach, expect, it, vi } from "vitest";
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import type { Channel } from "@tauri-apps/api/core";
import type { EditorCommand } from "../domain/commands";
import { NativeEditorMenus } from "./nativeMenus";

afterEach(() => { clearMocks(); vi.unstubAllGlobals(); });
it("builds real Tauri menus and dispatches the latest enabled command without repeated IPC", async () => {
  vi.stubGlobal("window", { crypto: globalThis.crypto }); vi.stubGlobal("isTauri", true);
  let rid = 0;
  const requests: { cmd: string; payload: Record<string, unknown> }[] = [];
  mockIPC((cmd, payload) => {
    const args = payload as Record<string, unknown> | undefined;
    requests.push({ cmd, payload: args ?? {} });
    if (cmd === "plugin:menu|new") return [++rid, (args?.options as { id?: string })?.id ?? `menu-${rid}`];
    return null;
  });
  const old = vi.fn(), latest = vi.fn();
  const command: EditorCommand = { id: "file.save", label: "保存", group: "文件", shortcut: "Mod+s", enabled: false, run: old };
  const page: EditorCommand = { ...command, id: "page.copy", group: "页面", shortcut: "Mod+c", enabled: true };
  const menus = new NativeEditorMenus();
  await menus.install([command, page], vi.fn());
  const request = requests.find((entry) => (entry.payload.options as { id?: string })?.id === command.id)!;
  const handler = request.payload.handler as Channel<string>;
  handler.onmessage(command.id);
  expect(old).not.toHaveBeenCalled();
  await menus.update([{ ...command, enabled: true, run: latest }, page]);
  handler.onmessage(command.id);
  expect(latest).toHaveBeenCalledOnce();
  expect(requests.filter((entry) => entry.cmd === "plugin:menu|set_enabled")).toHaveLength(1);
  await menus.update([{ ...command, enabled: true, run: latest }, page]);
  expect(requests.filter((entry) => entry.cmd === "plugin:menu|set_enabled")).toHaveLength(1);
  const pageOptions = requests.find((entry) => (entry.payload.options as { id?: string })?.id === page.id)?.payload.options as { accelerator?: string };
  expect(pageOptions.accelerator).toBeUndefined();
  expect(requests.some((entry) => entry.cmd === "plugin:menu|set_as_app_menu")).toBe(true);
  await menus.popupText();
  expect(requests.at(-1)?.cmd).toBe("plugin:menu|popup");
  await menus.dispose();
});
