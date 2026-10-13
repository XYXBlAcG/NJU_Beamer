import { createCanvas, loadImage } from "@napi-rs/canvas";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { themes } from "../src/domain/presets";

const root = resolve("../.tmp/render-regression");
for (let offset = 0; offset < themes.length; offset += 4) {
  const montage = createCanvas(1200, 1150);
  const context = montage.getContext("2d");
  context.fillStyle = "#eee"; context.fillRect(0, 0, montage.width, montage.height);
  for (const [column, theme] of themes.slice(offset, offset + 4).entries()) {
    for (let page = 1; page <= 5; page++) {
      const image = await loadImage(`${root}/${theme.id}/native-${page}.png`);
      context.drawImage(image, column * 300, (page - 1) * 230, 300, 225);
    }
  }
  writeFileSync(`${root}/native-matrix-${offset / 4 + 1}.png`, montage.toBuffer("image/png"));
}
