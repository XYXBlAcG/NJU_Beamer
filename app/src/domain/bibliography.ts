import { parse } from "@retorquere/bibtex-parser";
import { z } from "zod";

export const bibliographyEntrySchema = z.object({ key: z.string().regex(/^[A-Za-z0-9:._-]+$/), type: z.string().regex(/^[a-zA-Z]+$/), fields: z.record(z.string().regex(/^[a-zA-Z][a-zA-Z0-9_-]*$/), z.string()) });
export type BibliographyEntry = z.infer<typeof bibliographyEntrySchema>;
export function importBibliography(input: string): BibliographyEntry[] {
  const library = parse(input, { raw: true, sentenceCase: false, applyCrossRef: true });
  if (library.errors.length) throw new Error(library.errors.map((error) => error.error).join("\n"));
  const references = library.entries.map((entry) => bibliographyEntrySchema.parse({ key: entry.key, type: entry.type, fields: Object.fromEntries(Object.entries(entry.fields).map(([key, value]) => [key, typeof value === "string" ? value : value.map((item) => typeof item === "string" ? item : item.name ?? [item.firstName, item.lastName].filter(Boolean).join(" ")).join(" and ")])) }));
  if (new Set(references.map((reference) => reference.key)).size !== references.length) throw new Error("文献标识重复");
  return references;
}
export const serializeBibliography = (references: BibliographyEntry[]) => references.map((reference) => `@${reference.type}{${reference.key},\n${Object.entries(reference.fields).map(([key, value]) => `  ${key}={${value}}`).join(",\n")}\n}`).join("\n\n");
