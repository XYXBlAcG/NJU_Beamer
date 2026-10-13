import { createDefaultDeck, createId, defaultFrameOptions, defaultTheme, richText } from "./deck";
import type { TemplatePreset, ThemePreset } from "./extensions";
import emblems from "./vendor/nju-emblems.json";

const style = String.raw`\ProvidesPackage{beamerthemeKuangYaming}
\RequirePackage{tikz}
\RequirePackage{xsavebox}
\definecolor{kymNavy}{HTML}{17324D}
\definecolor{kymGold}{HTML}{B58B42}
\definecolor{kymInk}{HTML}{243746}
\setbeamercolor{normal text}{fg=kymInk,bg=white}
\setbeamercolor{structure}{fg=kymNavy}
\setbeamercolor{title}{fg=kymNavy}
\setbeamercolor{frametitle}{fg=kymNavy,bg=white}
\setbeamercolor{block title}{fg=white,bg=kymNavy}
\setbeamercolor{block body}{fg=kymInk,bg=kymNavy!5}
\setbeamercolor{block title alerted}{fg=white,bg=kymGold!85!black}
\setbeamercolor{block body alerted}{fg=kymInk,bg=kymGold!10}
\setbeamercolor{block title example}{fg=white,bg=kymNavy!70!green}
\setbeamercolor{block body example}{fg=kymInk,bg=kymNavy!5}
\setbeamerfont{title}{size=\LARGE,series=\bfseries}
\setbeamerfont{frametitle}{size=\large,series=\bfseries}
\setbeamertemplate{blocks}[default]
\setbeamertemplate{navigation symbols}{}
\ExplSyntaxOn
\NewDocumentCommand \kymEmblem { m m } {
  \group_begin:
  \tl_set:Nn \l__njuvis_color_a_tl { kymNavy }
  \tl_set:Nn \l__njuvis_color_b_tl { white }
  \resizebox{#1}{!}{\begin{tikzpicture}[y=0.80pt,x=0.80pt,yscale=-1,inner~sep=0pt,outer~sep=0pt]
  \ExplSyntaxOn
  \file_input:n {#2}
  \end{tikzpicture}}
  \group_end:
}
\ExplSyntaxOff
\newsavebox{\kymResourceBox}
\AtBeginDocument{\sbox{\kymResourceBox}{\xsbox{kym-nju}{\kymEmblem{1.35cm}{kym-emblem-nju.tex}}\xsbox{kym-dii}{\kymEmblem{1.35cm}{kym-emblem-dii.tex}}}}
\addtobeamertemplate{background canvas}{\usebox{\kymResourceBox}\global\setbox\kymResourceBox=\hbox{}}{}
\newcommand{\kymDualEmblems}[1]{\resizebox{#1}{!}{\xusebox{kym-nju}}\hspace{.35cm}\resizebox{#1}{!}{\xusebox{kym-dii}}}
\setbeamertemplate{title page}{
  \vspace{.3cm}\centering
  \kymDualEmblems{1.35cm}\par\vspace{.5cm}
  {\usebeamerfont{title}\usebeamercolor[fg]{title}\inserttitle\par}
  \vspace{.2cm}{\usebeamerfont{subtitle}\insertsubtitle\par}
  \vspace{.35cm}{\color{kymGold}\rule{.45\textwidth}{1pt}}\par
  \vspace{.3cm}\insertauthor\par\vspace{.15cm}\insertinstitute\par\vspace{.15cm}\insertdate\par
}
\setbeamertemplate{frametitle}{\vskip2pt\insertframetitle\par\vskip2pt{\color{kymGold}\hrule height .7pt}\vskip2pt}
\setbeamertemplate{footline}{
  \hspace{.35cm}\raisebox{.04cm}{\kymDualEmblems{.4cm}}
  \hfill{\color{kymNavy}\scriptsize\insertshorttitle}\hspace{.3cm}
  {\color{kymGold}\scriptsize\insertframenumber/\inserttotalframenumber}\hspace{.35cm}\vspace{.04cm}
}
`;

export const kuangTheme: ThemePreset = {
  id: "kuang-yaming", name: "匡亚明学院", category: "学术", tags: ["匡亚明", "深蓝", "金色", "双徽"],
  theme: { ...defaultTheme, mode: "custom", name: "KuangYaming" }, preamble: "",
  files: [{ path: "theme/beamerthemeKuangYaming.sty", content: style }, ...(["nju", "dii"] as const).map(department => ({ path: `theme/kym-emblem-${department}.tex`, content: emblems.emblems[department].source }))],
};

const deck = createDefaultDeck();
deck.metadata = { title: "报告标题", subtitle: "副标题", author: "作者", institute: "南京大学 匡亚明学院", date: "\\today" };
deck.settings.pageSize = { preset: "16:9", widthMm: 160, heightMm: 90 };
deck.settings.theme = kuangTheme.theme;
deck.settings.themeFiles = kuangTheme.files;
deck.sections[0].title = "报告";
deck.sections[0].slides = [deck.sections[0].slides[0], {
  id: createId(), kind: "content", title: "正文", frame: { ...defaultFrameOptions }, notes: "",
  blocks: [{ id: createId(), type: "text", hidden: false, fontSize: "normal", appearance: "none", content: richText("在这里编辑报告内容.") }],
}, {
  id: createId(), kind: "ending", title: "结尾页", frame: { ...defaultFrameOptions }, notes: "",
  blocks: [{ id: createId(), type: "text", hidden: false, fontSize: "normal", appearance: "none", content: richText("Thanks") }],
}];
export const kuangTemplate: TemplatePreset = { id: "kuang-yaming", name: "匡亚明学院", category: "学院", tags: ["匡亚明", "双徽", "深蓝金色"], deck, assets: [] };
