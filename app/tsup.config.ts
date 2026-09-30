import { defineConfig } from "tsup";

export default defineConfig({
  entry: { njub: "cli/index.ts" },
  outDir: "dist-cli",
  format: ["esm"],
  platform: "node",
  target: "node20",
  bundle: true,
  clean: true,
  noExternal: [/.*/],
  outExtension: () => ({ js: ".mjs" }),
});
