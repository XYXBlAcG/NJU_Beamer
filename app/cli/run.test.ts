import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { decodeNjub } from "../src/domain/njub";
import { runCli } from "./run";

describe("njub CLI", () => {
  it("exports the accepted input shape instead of the normalized output shape", async () => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    const io = { cwd: process.cwd(), stdin: async () => "", stdout: (value: string) => stdout.push(value), stderr: (value: string) => stderr.push(value) };

    expect(await runCli(["node", "njub", "schema", "--json"], io)).toBe(0);
    const schema = JSON.parse(stdout.pop() ?? "");
    expect(schema.required).toEqual(["specVersion", "metadata", "sections"]);
    expect(schema.properties.metadata.required).toEqual(["title"]);
    expect(schema.properties.settings.properties.mathFont.properties.preset.enum).toEqual(["latin-modern", "times", "custom"]);
    expect(schema.properties.settings.properties.theme.properties.mode.enum).toEqual(["nju", "default", "custom"]);
    expect(schema.properties.settings.properties.preamble.type).toBe("string");
    expect(stderr).toEqual([]);
  });

  it("creates, validates and inspects a document through the public command interface", async () => {
    const directory = await mkdtemp(join(tmpdir(), "njub-cli-"));
    const specPath = join(directory, "slides.json");
    const outputPath = join(directory, "slides.njub");
    await writeFile(specPath, JSON.stringify({
      specVersion: 2,
      metadata: { title: "CLI 演示" },
      sections: [{ title: "开始", slides: [{ kind: "title" }, { title: "内容", blocks: [{ type: "text", content: "创建成功" }] }] }],
    }));
    const stdout: string[] = [];
    const stderr: string[] = [];
    const io = { cwd: directory, stdin: async () => "", stdout: (value: string) => stdout.push(value), stderr: (value: string) => stderr.push(value) };

    expect(await runCli(["node", "njub", "create", "--spec", specPath, "--output", outputPath, "--json"], io)).toBe(0);
    expect(JSON.parse(stdout.pop() ?? "")).toMatchObject({ ok: true, output: outputPath, title: "CLI 演示", slides: 2 });
    expect(decodeNjub(new Uint8Array(await readFile(outputPath))).deck.metadata.title).toBe("CLI 演示");

    expect(await runCli(["node", "njub", "validate", outputPath, "--json"], io)).toBe(0);
    expect(JSON.parse(stdout.pop() ?? "")).toMatchObject({ ok: true, title: "CLI 演示" });

    expect(await runCli(["node", "njub", "inspect", outputPath, "--document", "--json"], io)).toBe(0);
    expect(JSON.parse(stdout.pop() ?? "")).toMatchObject({ ok: true, document: { metadata: { title: "CLI 演示" } } });
    expect(stderr).toEqual([]);
  });

  it("returns a structured error without overwriting an existing output", async () => {
    const directory = await mkdtemp(join(tmpdir(), "njub-cli-error-"));
    const specPath = join(directory, "slides.json");
    const outputPath = join(directory, "slides.njub");
    await writeFile(specPath, JSON.stringify({ specVersion: 2, metadata: { title: "示例" }, sections: [{ title: "章节", slides: [{ kind: "title" }] }] }));
    await writeFile(outputPath, "existing");
    const stdout: string[] = [];
    const stderr: string[] = [];
    const io = { cwd: directory, stdin: async () => "", stdout: (value: string) => stdout.push(value), stderr: (value: string) => stderr.push(value) };

    expect(await runCli(["node", "njub", "create", "--spec", specPath, "--output", outputPath, "--json"], io)).toBe(5);
    expect(JSON.parse(stderr.pop() ?? "")).toMatchObject({ ok: false, code: "OUTPUT_EXISTS" });
    expect(await readFile(outputPath, "utf8")).toBe("existing");
    expect(stdout).toEqual([]);
  });
});
