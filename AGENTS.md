# AGENTS.md

## Cursor Cloud specific instructions

This repository is a **LaTeX Beamer presentation** (the NJU Beamer theme). There is
no application server, test suite, or lint step — the "build/run" is compiling
`slide.tex` into `slide.pdf`.

### Build / run

Standard commands are documented in `README.md`:

- `xelatex slide.tex` — single pass.
- `latexmk -xelatex slide.tex` — full build (resolves TOC + bibliography automatically).

Must use **XeLaTeX** (not `pdflatex`): the deck loads `ctex` for Chinese text, which
requires a Unicode engine. Bibliography (`ref.bib`) is processed via bibtex; `latexmk`
runs the needed passes.

### Non-obvious caveats

- **Ghostscript (`gs`) is required.** The "图形与分栏" frame uses `pstricks`; with the
  XeLaTeX → `xdvipdfmx` pipeline the PostScript is rasterized through Ghostscript. If
  `gs` is missing you get `Image format conversion for PSTricks failed` and the vector
  drawing does not appear. It is installed as part of the environment.
- **`pic/dtmf.pdf` is missing from the repo** (it was never committed). `slide.tex`
  references it via `\includegraphics{pic/dtmf.pdf}`, so `xelatex`/`latexmk` exit with a
  non-zero status and print `Unable to load picture or PDF file 'pic/dtmf.pdf'` — even
  though a complete `slide.pdf` is still produced (that one frame just has a gap). This
  is a pre-existing content issue, not an environment problem. Use `latexmk -f -xelatex
  slide.tex` to force the full multi-pass build (bibtex + TOC) despite the error.
- Font-shape warnings (`T1/lmtt/bx/n undefined`, `textregistered`) are cosmetic —
  Latin Modern lacks a bold-monospace / that symbol; output is unaffected.
- Build artifacts (`*.aux`, `*.pdf`, `*.nav`, etc.) are all gitignored; use
  `latexmk -C` to clean.
