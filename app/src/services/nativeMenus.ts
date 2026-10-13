import { isTauri } from "@tauri-apps/api/core";
import { Menu, MenuItem, PredefinedMenuItem, Submenu } from "@tauri-apps/api/menu";
import type { EditorCommand } from "../domain/commands";

export class NativeEditorMenus {
  private menu?: Menu;
  private items = new Map<string, MenuItem>();
  private enabled = new Map<string, boolean>();
  private commands: EditorCommand[] = [];
  private textMenu?: Menu;
  private disposed = false;
  async install(commands: EditorCommand[], onQuit: () => void) {
    this.commands = commands;
    if (!isTauri()) return;
    const app = await Submenu.new({ text: "NJU Beamer GUI Editor", items: [
      await PredefinedMenuItem.new({ item: { About: { name: "NJU Beamer GUI Editor" } } }),
      await PredefinedMenuItem.new({ item: "Separator" }),
      await PredefinedMenuItem.new({ item: "Services" }),
      await PredefinedMenuItem.new({ item: "Hide" }),
      await PredefinedMenuItem.new({ item: "HideOthers" }),
      await PredefinedMenuItem.new({ item: "ShowAll" }),
      await MenuItem.new({ id: "editor.quit", text: "退出 NJU Beamer GUI Editor", accelerator: "CmdOrCtrl+Q", action: onQuit }),
    ] });
    const groups: Submenu[] = [app];
    for (const group of ["文件", "编辑", "页面", "视图", "工具"] as const) {
      const items: (MenuItem | PredefinedMenuItem)[] = [];
      for (const command of commands.filter((entry) => entry.group === group)) {
        const item = await MenuItem.new({ id: command.id, text: command.label, enabled: command.enabled,
          accelerator: group === "页面" ? undefined : command.shortcut?.replace("Mod", "CmdOrCtrl"),
          action: () => { const current = this.commands.find((entry) => entry.id === command.id); if (current?.enabled) current.run(); },
        });
        this.items.set(command.id, item); this.enabled.set(command.id, command.enabled); items.push(item);
      }
      groups.push(await Submenu.new({ text: group, items }));
    }
    groups.push(await Submenu.new({ text: "窗口", items: [await PredefinedMenuItem.new({ item: "Minimize" }), await PredefinedMenuItem.new({ item: "Maximize" })] }));
    this.menu = await Menu.new({ items: groups });
    this.textMenu = await Menu.new({ items: await Promise.all((["Cut", "Copy", "Paste", "SelectAll"] as const).map((item) => PredefinedMenuItem.new({ item }))) });
    if (this.disposed) { await this.dispose(); return; }
    await this.menu.setAsAppMenu();
    await this.update(this.commands);
  }
  async update(commands: EditorCommand[]) {
    this.commands = commands;
    await Promise.all([...this.items].flatMap(([id, item]) => {
      const enabled = Boolean(commands.find((command) => command.id === id)?.enabled);
      if (this.enabled.get(id) === enabled) return [];
      this.enabled.set(id, enabled); return [item.setEnabled(enabled)];
    }));
  }
  async popupText() { await this.textMenu?.popup(); }
  async dispose() {
    this.disposed = true;
    await this.textMenu?.close(); await this.menu?.close();
    this.items.clear(); this.enabled.clear();
  }
}
