import { create } from "zustand";

export const usePanelStore = create<{
  formula?: { selection: string; insert: (latex: string) => void; wrapped: boolean };
  openFormula: (selection: string, insert: (latex: string) => void, wrapped?: boolean) => void;
  closeFormula: () => void;
}>((set) => ({
  openFormula: (selection, insert, wrapped = false) => set({ formula: { selection, insert, wrapped } }),
  closeFormula: () => set({ formula: undefined }),
}));
