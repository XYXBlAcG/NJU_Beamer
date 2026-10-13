import type { EditorCommand } from "../domain/commands";

export function PageActions({ commands, outline = false }: { commands: EditorCommand[]; outline?: boolean }) {
  const ids = outline ? ["page.copy", "page.paste", "page.duplicate", "page.move"] : ["page.move", "page.duplicate", "page.delete"];
  return <div className={outline ? "outline-actions" : "slide-actions"}>{commands.filter((command) => ids.includes(command.id)).map((command) => <button key={command.id} className={command.id === "page.delete" ? "danger" : undefined} disabled={!command.enabled} onClick={command.run}>{command.label.replace("页面 / 章节", "")}</button>)}</div>;
}
