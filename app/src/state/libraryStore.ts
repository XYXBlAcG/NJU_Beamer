import { create } from "zustand";
import { z } from "zod";
import { extensionSchema, type Extension } from "../domain/extensions";
import { builtInExtension } from "../domain/presets";
import { readAppState, writeAppState } from "../services/desktop";

const librarySchema = z.object({ extensions: z.array(extensionSchema), disabled: z.array(z.string()), favourites: z.array(z.string()) });
type Library = z.infer<typeof librarySchema>;
export const useLibraryStore = create<Library & {
  ready: boolean;
  load: () => Promise<void>;
  install: (extension: Extension) => Promise<void>;
  remove: (id: string) => Promise<void>;
  toggle: (id: string) => Promise<void>;
  favourite: (id: string) => Promise<void>;
}>((set, get) => {
  let writes = Promise.resolve();
  const change = (mutate: (state: Library) => Library) => {
    writes = writes.catch(() => undefined).then(async () => {
      const library = mutate(get());
      await writeAppState("library.json", new TextEncoder().encode(JSON.stringify(library)));
      set(library);
    });
    return writes;
  };
  return {
  extensions: [], disabled: [], favourites: [], ready: false,
  load: async () => {
    const bytes = await readAppState("library.json");
    if (bytes) set(librarySchema.parse(JSON.parse(new TextDecoder().decode(bytes))));
    set({ ready: true });
  },
  install: async (extension) => {
    if (extension.id === "builtin") throw new Error("不能替换内置素材");
    await change((state) => ({ extensions: [...state.extensions.filter((item) => item.id !== extension.id), extensionSchema.parse(extension)], disabled: state.disabled.filter((id) => id !== extension.id), favourites: state.favourites }));
  },
  remove: async (id) => {
    await change((state) => ({ extensions: state.extensions.filter((item) => item.id !== id), disabled: state.disabled.filter((item) => item !== id), favourites: state.favourites.filter((item) => !item.startsWith(`${id}/`)) }));
  },
  toggle: async (id) => {
    await change((state) => ({ extensions: state.extensions, disabled: state.disabled.includes(id) ? state.disabled.filter((item) => item !== id) : [...state.disabled, id], favourites: state.favourites }));
  },
  favourite: async (id) => {
    await change((state) => ({ extensions: state.extensions, disabled: state.disabled, favourites: state.favourites.includes(id) ? state.favourites.filter((item) => item !== id) : [...state.favourites, id] }));
  },
  };
});
export const enabledExtensions = (state: Library) => [builtInExtension, ...state.extensions].filter((extension) => !state.disabled.includes(extension.id));
