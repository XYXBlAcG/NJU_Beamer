import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { decodeNjub } from "../src/domain/njub";
import { runCli } from "./run";

it("creates a GUI-compatible document from the shared template registry", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "njub-preset-"));
  const stdout: string[] = [];
  const io = { cwd, stdin: async () => "", stdout: (value: string) => stdout.push(value), stderr: (value: string) => { throw new Error(value); } };
  expect(await runCli(["node", "njub", "from-template", "lecture", "--output", "lecture.njub", "--json"], io)).toBe(0);
  const document = decodeNjub(new Uint8Array(await readFile(join(cwd, "lecture.njub"))));
  expect("deck" in document && document.deck.settings.pageSize.preset).toBe("16:9");
  expect(await runCli(["node", "njub", "extension-schema", "--json"], io)).toBe(0);
  expect(JSON.parse(stdout.at(-1)!).properties.apiVersion.const).toBe(1);
});
