export const tikzEditorSource = (source: string) => `\\begin{tikzpicture}\n${source}\n\\end{tikzpicture}`;
export const tikzBlockSource = (source: string) => {
  const match = /^\s*\\begin\{tikzpicture\}\s*([\s\S]*?)\s*\\end\{tikzpicture\}\s*$/.exec(source);
  if (!match || /\\(?:begin|end)\{tikzpicture\}/.test(match[1])) throw new Error("请保留一个 tikzpicture；额外的文档头或多幅图请放在 TeX 块中。");
  return match[1];
};
