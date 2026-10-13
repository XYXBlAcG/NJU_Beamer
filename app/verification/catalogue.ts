import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createDefaultDeck, createId, defaultFrameOptions, type Deck } from "../src/domain/deck";
import { extensionSchema, renderTikz, tikzBlock } from "../src/domain/extensions";
import { builtInExtension } from "../src/domain/presets";
import { serializeDeck } from "../src/domain/serialize";
import { pageSizes } from "../src/domain/pageSize";
import { encodeNjub } from "../src/domain/njub";

const execute = promisify(execFile);
const root = await mkdtemp(join(tmpdir(), "njub-catalogue-"));
const workspace = resolve("../templates/nju");
const compile = async (name: string, deck: Deck) => {
  const directory = join(root, name);
  await mkdir(directory);
  await writeFile(join(directory, "slide.tex"), serializeDeck(deck));
  try {
    await execute("/Library/TeX/texbin/latexmk", ["-xelatex", "-interaction=nonstopmode", "-halt-on-error", "-file-line-error", "slide.tex"], { cwd: directory, env: { ...process.env, PATH: `/Library/TeX/texbin:${process.env.PATH}`, TEXINPUTS: `${workspace}//:` }, maxBuffer: 16 * 1024 * 1024 });
    const pdf = await readFile(join(directory, "slide.pdf"));
    if (!pdf.subarray(0, 5).equals(Buffer.from("%PDF-"))) throw new Error("未生成 PDF");
    process.stdout.write(`✓ ${name}\n`);
  } catch (error) {
    process.stderr.write(`✗ ${name}: ${directory}\n`);
    throw error;
  }
};

const gallery = createDefaultDeck();
gallery.metadata.title = "素材与公式示例";
gallery.settings.theme.mode = "default";
gallery.settings.pageSize = { preset: "16:9", widthMm: 160, heightMm: 90 };
gallery.settings.tikzLibraries = [...new Set(builtInExtension.tikz.flatMap((preset) => preset.libraries))];
gallery.sections[0].slides = builtInExtension.tikz.map((preset) => ({ id: createId(), title: preset.name, kind: "content", frame: { ...defaultFrameOptions }, notes: "", blocks: [tikzBlock(renderTikz(preset, {}))] }));
for (let offset = 0; offset < builtInExtension.formulas.length; offset += 12) {
  gallery.sections[0].slides.push({ id: createId(), title: `公式素材 ${offset + 1}`, kind: "content", frame: { ...defaultFrameOptions }, notes: "", blocks: [{ id: createId(), type: "formula", hidden: false, fontSize: "small", appearance: "none", layout: "multline", numbered: false, latex: builtInExtension.formulas.slice(offset, offset + 12).map((entry) => entry.preview).reduce((rows, latex, index) => rows + (index % 3 === 0 && index ? "\\\\\n" : index ? "\\quad " : "") + latex, "") }] });
}
await compile("tikz-and-formulas", gallery);
await writeFile(resolve("../examples/advanced-editor.njub"), encodeNjub(gallery, []));
for (const theme of builtInExtension.themes) {
  const deck = createDefaultDeck();
  deck.settings.theme = theme.theme;
  deck.settings.themePreamble = theme.preamble;
  deck.settings.themeFiles = theme.files;
  await compile(`theme-${theme.id}`, deck);
}
for (const template of builtInExtension.templates) await compile(`template-${template.id}`, template.deck);
for (const size of pageSizes) {
  const deck = createDefaultDeck();
  deck.settings.pageSize = { preset: size.value, widthMm: size.widthMm, heightMm: size.heightMm };
  await compile(`size-${size.value.replaceAll(":", "-")}`, deck);
}
const community = extensionSchema.parse(JSON.parse(await readFile(resolve("../examples/extension.manifest.json"), "utf8")));
const portableTheme = createDefaultDeck();
portableTheme.settings.theme = community.themes[0].theme;
portableTheme.settings.themeFiles = community.themes[0].files;
await compile("portable-community-theme", portableTheme);
process.stdout.write(`PDF verification outputs: ${root}\n`);
