import { themes } from "../src/domain/presets";
import { generatePresetThumbnail } from "./preset-thumbnail";

for (const theme of themes.filter(item => !process.argv[2] || item.id === process.argv[2])) {
  await generatePresetThumbnail({ kind: "themes", key: `builtin/themes/${theme.id}`, item: theme });
}
