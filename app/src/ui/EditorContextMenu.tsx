import * as ContextMenu from "@radix-ui/react-context-menu";
import type { ReactNode } from "react";
import type { EditorCommand } from "../domain/commands";

export function EditorContextMenu({ children, commands }: { children: ReactNode; commands: Pick<EditorCommand, "id" | "label" | "enabled" | "run">[] }) {
  return <ContextMenu.Root><ContextMenu.Trigger asChild>{children}</ContextMenu.Trigger><ContextMenu.Portal>
    <ContextMenu.Content className="editor-context-menu" collisionPadding={8}>
      {commands.map((command) => <ContextMenu.Item key={command.id} className="editor-context-item" disabled={!command.enabled} onSelect={command.run}>{command.label}</ContextMenu.Item>)}
    </ContextMenu.Content>
  </ContextMenu.Portal></ContextMenu.Root>;
}
