import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { runCli } from "./run";
import { decodeNjub } from "../src/domain/njub";

it("creates a paper through the CLI and validates the same ZIP", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "njub-paper-cli-"));
  const output: string[] = [];
  const io = { cwd, stdin: async () => "", stdout: (value: string) => output.push(value), stderr: (value: string) => output.push(value) };
  expect(await runCli(["node", "njub", "create-paper", "--template", "report", "--output", "paper.njub", "--json"], io)).toBe(0);
  const document = decodeNjub(new Uint8Array(await readFile(join(cwd, "paper.njub"))));
  expect("paper" in document && document.paper.settings.template).toBe("report");
  expect(await runCli(["node", "njub", "validate", "paper.njub", "--json"], io)).toBe(0);
});
