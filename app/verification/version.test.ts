import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";

it("uses package.json for the macOS version and keeps Cargo and npm metadata aligned", () => {
  const pkg = JSON.parse(readFileSync(resolve("package.json"), "utf8"));
  const config = JSON.parse(readFileSync(resolve("src-tauri/tauri.conf.json"), "utf8"));
  const bundle = JSON.parse(readFileSync(resolve("src-tauri", config.version), "utf8"));
  const cargo = readFileSync(resolve("src-tauri/Cargo.toml"), "utf8");
  const lock = JSON.parse(readFileSync(resolve("package-lock.json"), "utf8"));
  expect(bundle.version).toBe(pkg.version);
  expect(cargo.match(/^version = "([^"]+)"/m)?.[1]).toBe(pkg.version);
  expect(lock.version).toBe(pkg.version);
  expect(lock.packages[""].version).toBe(pkg.version);
});
