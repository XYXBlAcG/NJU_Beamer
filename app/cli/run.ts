import { access, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { Command, CommanderError } from "commander";
import { z, ZodError } from "zod";
import packageJson from "../package.json";
import { authoringSpecSchema, composeAuthoringSpec } from "../src/domain/authoring";
import { decodeNjub, documentSummary, encodeNjub } from "../src/domain/njub";

export type CliIo = {
  cwd: string;
  stdin: () => Promise<string>;
  stdout: (value: string) => void;
  stderr: (value: string) => void;
};

type FailureCode = "CLI_USAGE" | "SPEC_INVALID" | "DOCUMENT_INVALID" | "ASSET_INVALID" | "OUTPUT_EXISTS" | "FILE_IO";

class CliFailure extends Error {
  constructor(public code: FailureCode, public exitCode: number, message: string, public issues?: unknown[]) {
    super(message);
  }
}

const writeAtomic = async (path: string, content: Uint8Array, force: boolean) => {
  await mkdir(dirname(path), { recursive: true });
  if (!force) {
    try {
      await access(path);
      throw new CliFailure("OUTPUT_EXISTS", 5, `输出文件已存在：${path}`);
    } catch (error) {
      if (error instanceof CliFailure) throw error;
    }
  }
  const temporary = resolve(dirname(path), `.${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, content, { flag: "wx" });
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
};

const json = (value: unknown) => JSON.stringify(value, null, 2);

export async function runCli(argv: string[], io: CliIo): Promise<number> {
  const machineOutput = argv.includes("--json");
  const program = new Command()
    .name("njub")
    .description("创建和检查 NJU Beamer 文稿")
    .version(packageJson.version)
    .exitOverride()
    .configureOutput({ writeOut: (value) => io.stdout(value.trimEnd()), writeErr: (value) => io.stderr(value.trimEnd()) });

  program.command("schema")
    .description("输出 Agent 创作规格的 JSON Schema")
    .option("--json", "输出 JSON")
    .action(() => io.stdout(json(z.toJSONSchema(authoringSpecSchema, { target: "draft-7", io: "input" }))));

  program.command("create")
    .description("从声明式规格创建 NJUB 文稿")
    .requiredOption("--spec <path>", "JSON 规格文件，- 表示 stdin")
    .requiredOption("--output <path>", "输出 .njub 文件")
    .option("--asset-root <path>", "图片相对路径的根目录")
    .option("--force", "覆盖已有输出", false)
    .option("--json", "输出机器可读 JSON")
    .action(async (options: { spec: string; output: string; assetRoot?: string; force: boolean; json?: boolean }) => {
      const output = resolve(io.cwd, options.output);
      if (!output.toLowerCase().endsWith(".njub")) throw new CliFailure("CLI_USAGE", 2, "输出文件必须使用 .njub 扩展名");
      let input: unknown;
      try {
        const source = options.spec === "-" ? await io.stdin() : await readFile(resolve(io.cwd, options.spec), "utf8");
        input = JSON.parse(source);
      } catch (error) {
        throw new CliFailure("SPEC_INVALID", 3, `无法读取创作规格：${error instanceof Error ? error.message : String(error)}`);
      }
      const root = resolve(io.cwd, options.assetRoot ?? (options.spec === "-" ? "." : dirname(options.spec)));
      let document;
      try {
        document = await composeAuthoringSpec(input, async (assetPath) => {
          const path = resolve(root, assetPath);
          const local = relative(root, path);
          if (local.startsWith("..") || isAbsolute(local)) throw new Error(`图片不能位于资源根目录之外：${assetPath}`);
          return new Uint8Array(await readFile(path));
        });
      } catch (error) {
        if (error instanceof ZodError) throw new CliFailure("SPEC_INVALID", 3, "创作规格不符合 Schema", error.issues);
        throw new CliFailure("ASSET_INVALID", 4, error instanceof Error ? error.message : String(error));
      }
      await writeAtomic(output, encodeNjub(document.deck, document.assets), options.force);
      const result = { ok: true, output, ...documentSummary(document.deck, document.assets) };
      io.stdout(options.json ? json(result) : `已创建 ${output}`);
    });

  program.command("validate")
    .description("校验 NJUB 文稿")
    .argument("<path>", "待校验的 .njub 文件")
    .option("--json", "输出机器可读 JSON")
    .action(async (path: string, options: { json?: boolean }) => {
      let document;
      try {
        document = decodeNjub(new Uint8Array(await readFile(resolve(io.cwd, path))));
      } catch (error) {
        throw new CliFailure("DOCUMENT_INVALID", 3, error instanceof Error ? error.message : String(error));
      }
      const result = { ok: true, ...documentSummary(document.deck, document.assets) };
      io.stdout(options.json ? json(result) : `文稿有效：${document.deck.metadata.title}`);
    });

  program.command("inspect")
    .description("查看 NJUB 摘要或规范化文稿")
    .argument("<path>", "待查看的 .njub 文件")
    .option("--document", "输出完整 document.json", false)
    .option("--summary", "输出文稿摘要", false)
    .option("--json", "输出机器可读 JSON")
    .action(async (path: string, options: { document: boolean; summary: boolean; json?: boolean }) => {
      if (options.document && options.summary) throw new CliFailure("CLI_USAGE", 2, "--document 与 --summary 不能同时使用");
      let document;
      try {
        document = decodeNjub(new Uint8Array(await readFile(resolve(io.cwd, path))));
      } catch (error) {
        throw new CliFailure("DOCUMENT_INVALID", 3, error instanceof Error ? error.message : String(error));
      }
      const result = options.document
        ? { ok: true, document: document.deck, assets: document.assets.map(({ path: assetPath, mimeType, content }) => ({ path: assetPath, mimeType, bytes: content.length })) }
        : { ok: true, ...documentSummary(document.deck, document.assets) };
      io.stdout(options.json || options.document ? json(result) : `标题：${document.deck.metadata.title}\n章节：${document.deck.sections.length}`);
    });

  try {
    await program.parseAsync(argv);
    return 0;
  } catch (error) {
    if (error instanceof CommanderError && error.exitCode === 0) return 0;
    const failure = error instanceof CliFailure
      ? error
      : error instanceof CommanderError
        ? new CliFailure("CLI_USAGE", 2, error.message)
        : new CliFailure("FILE_IO", 6, error instanceof Error ? error.message : String(error));
    const result = { ok: false, code: failure.code, message: failure.message, ...(failure.issues ? { issues: failure.issues } : {}) };
    io.stderr(machineOutput ? json(result) : `${failure.code}: ${failure.message}`);
    return failure.exitCode;
  }
}
