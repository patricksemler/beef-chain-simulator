/**
 * LaTeX output for the manuscript. build-manuscript.cjs calls the same helpers
 * (P, H1, EQ, TABLE, ...) for the Word file, and each one also calls into this
 * emitter, so the .tex and .docx files share one source of text and numbers.
 *
 * Inline markup understood in text strings: *italic*, **bold**, _{sub}, ^{sup},
 * and [@key;@key] citations. Every non-ASCII character must be in CHAR_MAP so
 * the .tex file compiles with pdfLaTeX, XeLaTeX or LuaLaTeX alike.
 */

const GREEK = {
  '\u03c1': '\\rho',
  '\u03c3': '\\sigma',
  '\u03c0': '\\pi',
  '\u03b5': '\\varepsilon',
  '\u0394': '\\Delta',
};

const CHAR_MAP = {
  '\\': '\\textbackslash{}',
  '&': '\\&',
  '%': '\\%',
  $: '\\$',
  '#': '\\#',
  _: '\\_',
  '{': '\\{',
  '}': '\\}',
  '~': '\\textasciitilde{}',
  '^': '\\textasciicircum{}',
  '<': '\\textless{}',
  '>': '\\textgreater{}',
  '\u2212': '\\textminus{}',
  '\u2013': '--',
  '\u2014': '---',
  '\u2019': "'",
  '\u2018': '`',
  '\u201c': '``',
  '\u201d': "''",
  '\u00b1': '$\\pm$',
  '\u00d7': '$\\times$',
  '\u2264': '$\\leq$',
  '\u2265': '$\\geq$',
  '\u2248': '$\\approx$',
  '\u00f6': '\\"o',
  '\u00b7': '$\\cdot$',
  '\u00f7': '$\\div$',
  '\u00a0': '~',
  '\u2192': '$\\rightarrow$',
  '\u2022': '\\textbullet{}',
};
for (const [char, command] of Object.entries(GREEK)) CHAR_MAP[char] = `$${command}$`;

/** Equations in proper LaTeX, in the order EQ() is called in build-manuscript.cjs. */
const EQUATIONS = [
  String.raw`A = \min(N,\, 2{,}500), \qquad w = \frac{N}{A}`,
  String.raw`W_{0} = \bar{W}_{0}\cdot \operatorname{clamp}\!\left(1 + 0.85\, v\, z_{1},\; 0.80,\; 1.20\right)`,
  String.raw`D_{s} = \bar{D}_{s}\cdot \operatorname{clamp}\!\left(1 + v\, z_{2},\; 0.78,\; 1.22\right)`,
  String.raw`g_{s} = \operatorname{clamp}\!\left(1 + 0.70\, v\, z_{3},\; 0.82,\; 1.18\right)`,
  String.raw`\begin{aligned}
c_{s} &= \min\!\left[1,\; \frac{H - t}{D_{s}/30.4375}\right], \qquad d_{s} = c_{s}\, D_{s},\\
W_{s}^{\mathrm{out}} &= W_{s}^{\mathrm{in}} + \mathrm{ADG}_{s}\cdot d_{s}\cdot g_{s}
\end{aligned}`,
  String.raw`\varepsilon_{k} = \exp\!\left[\sigma_{k}\left(\rho\, Z_{0} + \sqrt{1-\rho^{2}}\, Z_{k}\right) - \sigma_{k}^{2}/2\right]`,
  String.raw`\varepsilon_{f} = \exp\!\left[\sigma_{f}\left(-0.2\, Z_{0} + \sqrt{0.96}\, Z_{f}\right) - \sigma_{f}^{2}/2\right]`,
  String.raw`C_{s}^{\mathrm{dir}} = F_{s}\, c_{s} + u_{s}\, d_{s} + \left[\frac{\mathrm{DMI}\cdot d_{s}\cdot P_{\mathrm{feed}}\cdot \varepsilon_{f}}{2{,}000}\right]_{\text{feedlot}}`,
  String.raw`R_{s} = \frac{W_{s}^{\mathrm{out}}}{100}\, P_{s}\, \varepsilon_{s}, \qquad s \in \{\text{cow-calf, stocker, feedlot}\}`,
  String.raw`\begin{aligned}
L &= W_{\mathrm{feedlot}}^{\mathrm{out}}\cdot \mathrm{DP}\cdot \mathrm{SY},\\
G &= \sum_{g} \pi_{g}\, I_{g}, \qquad g \in \{\text{Prime, Choice, Select}\}, \quad I_{\text{Choice}} = 1
\end{aligned}`,
  String.raw`\begin{aligned}
R_{\mathrm{packer}} &= L\, P_{\mathrm{wholesale}}\, G\, \varepsilon_{\mathrm{wholesale}} + B,\\
R_{\mathrm{retail}} &= L\, P_{\mathrm{retail}}\, G\, \varepsilon_{\mathrm{retail}}
\end{aligned}`,
  String.raw`\begin{aligned}
OC_{s} &= R_{s} + V_{s}^{\mathrm{inv}} - A_{s} - C_{s}^{\mathrm{dir}},\\
EP_{s} &= OC_{s} - C_{s}^{\mathrm{econ}}, \qquad EP_{\mathrm{chain}} = \sum_{s} EP_{s}
\end{aligned}`,
  String.raw`\begin{aligned}
P_{\mathrm{retail}}^{\mathrm{BE}} &= P_{\mathrm{retail}} - \frac{EP_{\mathrm{chain}}}{L_{\mathrm{sold}}\, G},\\
P_{\mathrm{fed}}^{\mathrm{BE}} &= P_{\mathrm{fed}} - \frac{EP_{\mathrm{feedlot}}}{\mathrm{cwt}_{\mathrm{fed}}}
\end{aligned}`,
];

function escapeRaw(text) {
  const urlPattern = /https?:\/\/[^\s)]+/g;
  let result = '';
  let last = 0;
  const escapePlain = (segment) => {
    let escaped = '';
    for (const char of segment) {
      if (CHAR_MAP[char] !== undefined) escaped += CHAR_MAP[char];
      else if (char.charCodeAt(0) > 126) {
        throw new Error(`Unmapped character U+${char.codePointAt(0).toString(16)} in: ${text.slice(0, 80)}`);
      } else escaped += char;
    }
    return escaped;
  };
  for (const match of text.matchAll(urlPattern)) {
    const trailing = (match[0].match(/[.,;]+$/) || [''])[0];
    const url = match[0].slice(0, match[0].length - trailing.length);
    result += escapePlain(text.slice(last, match.index)) + `\\url{${url}}` + escapePlain(trailing);
    last = match.index + match[0].length;
  }
  return result + escapePlain(text.slice(last));
}

function scriptContent(content) {
  const mapped = content.replace(/[\u03c1\u03c3\u03c0\u03b5\u0394]/g, (g) => `${GREEK[g]} `);
  return /^[A-Za-z]{2,}$/.test(mapped) ? `\\mathrm{${mapped}}` : mapped;
}

function inline(text) {
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|\[@[^\]]+\]|_\{[^}]*\}|\^\{[^}]*\})/g;
  const tokens = [...text.matchAll(pattern)];
  const parts = [];
  let last = 0;
  tokens.forEach((match, index) => {
    if (match.index > last) parts.push({ kind: 'raw', text: text.slice(last, match.index) });
    last = match.index + match[0].length;
    const token = match[0];
    const next = tokens[index + 1];
    const nextIsScript = next && next.index === last && /^[_^]\{/.test(next[0]);
    if (token.startsWith('**')) {
      parts.push({ kind: 'tex', text: `\\textbf{${inline(token.slice(2, -2))}}` });
    } else if (token.startsWith('*')) {
      const content = token.slice(1, -1);
      if (/^[A-Za-z]\u0304?$/.test(content)) {
        parts.push({ kind: 'math', text: content.length === 2 ? `\\bar{${content[0]}}` : content });
      } else if (/^[A-Za-z]{2,5}$/.test(content) && nextIsScript) {
        parts.push({ kind: 'math', text: `\\mathit{${content}}` });
      } else {
        parts.push({ kind: 'tex', text: `\\emph{${escapeRaw(content)}}` });
      }
    } else if (token.startsWith('[@')) {
      const keys = token.slice(1, -1).split(';').map((k) => k.trim().replace(/^@/, ''));
      parts.push({ kind: 'tex', text: `\\citep{${keys.join(',')}}` });
    } else {
      const marker = token[0];
      const rawContent = token.slice(2, -1);
      const content = scriptContent(rawContent);
      const previous = parts[parts.length - 1];
      if (previous && previous.kind === 'math') {
        previous.text += `${marker}{${content}}`;
      } else if (previous && previous.kind === 'raw' && /[A-Za-z\u0370-\u03ff]$/.test(previous.text)) {
        const char = previous.text.slice(-1);
        previous.text = previous.text.slice(0, -1);
        parts.push({ kind: 'math', text: `${GREEK[char] || char}${marker}{${content}}` });
      } else if (!previous || previous.kind === 'tex' || (previous.kind === 'raw' && /[\d\]\s]$/.test(previous.text))) {
        const command = marker === '_' ? 'textsubscript' : 'textsuperscript';
        parts.push({ kind: 'tex', text: `\\${command}{${escapeRaw(rawContent)}}` });
      } else {
        parts.push({ kind: 'math', text: `${marker}{${content}}` });
      }
    }
  });
  if (last < text.length) parts.push({ kind: 'raw', text: text.slice(last) });
  return parts
    .map((part) => (part.kind === 'raw' ? escapeRaw(part.text) : part.kind === 'math' ? `$${part.text}$` : part.text))
    .join('');
}

const PREAMBLE = String.raw`\documentclass[12pt]{article}

\usepackage[letterpaper,margin=1in]{geometry}
\usepackage[T1]{fontenc}
\usepackage[utf8]{inputenc}
\usepackage{mathptmx}        % Times text and math
\usepackage{microtype}
\usepackage{amsmath,amssymb}
\usepackage{graphicx}
\usepackage{booktabs}
\usepackage{array}
\usepackage{enumitem}
\usepackage{setspace}
\usepackage[numbers,sort&compress,round]{natbib}
\usepackage[hidelinks]{hyperref}
\usepackage{url}
\usepackage[font=small,labelfont=bf,labelsep=period,justification=justified,singlelinecheck=false,skip=6pt]{caption}
\usepackage{lineno}          % line numbers, as requested by most journals

\onehalfspacing
\setlength{\parindent}{1.5em}
\setlength{\parskip}{0pt}
\linenumbers
`;

function createLatex() {
  const out = [];
  let inList = false;
  let suspended = false;
  let openAbstract = false;
  let afterEquation = false;
  let equationCount = 0;

  const push = (line) => {
    if (!suspended) out.push(line);
  };
  const closeList = () => {
    if (inList) {
      out.push('\\end{itemize}\n');
      inList = false;
    }
  };

  return {
    setSuspended(value) {
      suspended = value;
    },
    para(text) {
      if (suspended) return;
      closeList();
      const prefix = afterEquation && /^(where|with)\s/.test(text) ? '\\noindent ' : '';
      afterEquation = false;
      out.push(`${prefix}${inline(text)}\n`);
    },
    heading(level, text) {
      if (suspended) return;
      closeList();
      afterEquation = false;
      if (level === 1) {
        if (openAbstract) {
          out.push('\\end{abstract}\n');
          openAbstract = false;
        }
        if (text === 'Abstract') {
          out.push('\\begin{abstract}\n');
          openAbstract = true;
          return;
        }
        if (text === 'References') return; // the bibliography environment prints its own heading
      }
      const numbered = /^\d/.test(text);
      const title = inline(text.replace(/^\d+(\.\d+)*\s+/, ''));
      const command = ['section', 'subsection', 'subsubsection'][level - 1] + (numbered ? '' : '*');
      out.push(`\\${command}{${title}}\n`);
    },
    bullet(text) {
      if (suspended) return;
      afterEquation = false;
      if (!inList) {
        out.push('\\begin{itemize}[leftmargin=*,itemsep=2pt]');
        inList = true;
      }
      out.push(`\\item ${inline(text)}`);
    },
    equation(number) {
      closeList();
      equationCount += 1;
      if (equationCount !== number || !EQUATIONS[number - 1]) {
        throw new Error(`LaTeX equation ${number} is missing or out of order`);
      }
      afterEquation = true;
      out.push(`\\begin{equation}\n${EQUATIONS[number - 1]}\n\\end{equation}`);
    },
    figure(file, caption) {
      closeList();
      afterEquation = false;
      out.push(
        `\\begin{figure}[!htbp]\n\\centering\n\\includegraphics[width=\\linewidth]{figures/${file}}\n\\caption{${inline(caption)}}\n\\end{figure}\n`,
      );
    },
    table(caption, header, rows, opts = {}) {
      closeList();
      afterEquation = false;
      const columns = header.length;
      const spec = opts.texCols || `l${'r'.repeat(columns - 1)}`;
      const cell = (value) => inline(String(value));
      const label = opts.supplementary ? `\\caption*{\\textbf{Supplementary Table S${opts.supplementary}.} ${inline(caption)}}` : `\\caption{${inline(caption)}}`;
      const wide = columns >= 8;
      const lines = ['\\begin{table}[!htbp]', '\\centering', '\\singlespacing', '\\footnotesize', label];
      if (wide) lines.push('\\resizebox{\\textwidth}{!}{%');
      lines.push(`\\begin{tabular}{${spec}}`, '\\toprule', `${header.map((h) => `\\textbf{${cell(h)}}`).join(' & ')} \\\\`, '\\midrule');
      for (const row of rows) {
        const isObject = !Array.isArray(row);
        const cells = isObject ? row.cells : row;
        if (isObject && row.rule) lines.push('\\midrule');
        if (isObject && row.bold && cells.slice(1).every((c) => c === '')) {
          lines.push(`\\multicolumn{${columns}}{l}{\\textbf{${cell(cells[0])}}} \\\\`);
        } else {
          const converted = cells.map((c) => (isObject && row.bold && c !== '' ? `\\textbf{${cell(c)}}` : cell(c)));
          lines.push(`${converted.join(' & ')} \\\\`);
        }
      }
      lines.push('\\bottomrule', '\\end{tabular}');
      if (wide) lines.push('}');
      if (opts.note) lines.push(`\\par\\smallskip\\begin{minipage}{\\textwidth}\\footnotesize\\raggedright ${inline(opts.note)}\\end{minipage}`);
      lines.push('\\end{table}\n');
      out.push(lines.join('\n'));
    },
    clearpage() {
      if (suspended) return;
      closeList();
      out.push('\\clearpage\n');
    },
    abbreviations(list) {
      closeList();
      out.push('\\begin{description}[leftmargin=!,labelwidth=5em,itemsep=0pt,parsep=0pt]');
      for (const [abbreviation, meaning] of list) out.push(`\\item[${inline(abbreviation)}] ${inline(meaning)}`);
      out.push('\\end{description}\n');
    },
    bibliography(order, references) {
      closeList();
      out.push('\\begin{thebibliography}{99}');
      order.forEach((key) => out.push(`\\bibitem{${key}} ${inline(references[key])}`));
      out.push('\\end{thebibliography}\n');
    },
    finish({ commit, date, title, runningTitle }) {
      closeList();
      if (equationCount !== EQUATIONS.length) {
        throw new Error(`Expected ${EQUATIONS.length} equations in LaTeX, saw ${equationCount}`);
      }
      const head = String.raw`
\title{${inline(title)}}
\author{[Author 1]$^{1}$, [Author 2]$^{1}$, [Author 3]$^{1}$, and [Corresponding Author]$^{1,*}$\\[6pt]
{\small $^{1}$ Department of Animal Science, Texas A\&M University, College Station, TX, United States}\\[2pt]
{\small $^{*}$Correspondence: [Corresponding Author], [email address]}}
\date{}

\begin{document}
\maketitle
\begin{center}
{\small \textbf{Running title:} ${inline(runningTitle)}\\
\textbf{Draft status:} working draft generated from model commit ${commit} on ${date}. Bracketed items are placeholders to be completed by the authors.}
\end{center}

`;
      return `${PREAMBLE}${head}${out.join('\n')}\n\\end{document}\n`;
    },
  };
}

module.exports = createLatex;
