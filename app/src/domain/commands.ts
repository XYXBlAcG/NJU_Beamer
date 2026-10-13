export type EditorCommand = { id: string; label: string; group: "文件" | "编辑" | "页面" | "视图" | "工具"; shortcut?: string; enabled: boolean; run: () => void };
export const isTextTarget = (target: EventTarget | null): boolean => target instanceof Element && Boolean(target.closest("input,textarea,[contenteditable=true]"));
export function matchingCommand(commands: EditorCommand[], event: Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey" | "shiftKey" | "altKey">, scope: "outline" | "text" | "workspace" = "workspace") {
  const key = event.key === "Delete" ? "backspace" : event.key.toLowerCase();
  const parts = [event.metaKey || event.ctrlKey ? "Mod" : "", event.shiftKey ? "Shift" : "", event.altKey ? "Alt" : "", key].filter(Boolean).join("+");
  return commands.find((command) => command.enabled && command.shortcut?.toLowerCase() === parts.toLowerCase()
    && (command.group !== "页面" || scope === "outline")
    && !(scope === "text" && ["edit.cut", "edit.copy", "edit.paste", "edit.selectAll"].includes(command.id)));
}
