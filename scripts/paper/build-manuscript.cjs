/**
 * Builds the manuscript draft (output/paper/*.docx) from output/paper/results.json
 * and the figures in output/paper/figures. Every number in the text and tables is
 * read from results.json so the draft cannot drift from the simulation output.
 *
 * Needs the `docx` npm package (v9):
 *   NODE_PATH=<dir containing node_modules> node scripts/paper/build-manuscript.cjs
 *
 * Inline markup in text strings: *italic*, **bold**, _{subscript}, ^{superscript},
 * and [@key] or [@a;@b] for numbered citations (numbered in order of first use).
 */
const fs = require('node:fs');
const path = require('node:path');
const {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  ImageRun,
  LineNumberRestartFormat,
  Packer,
  PageBreak,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TabStopType,
  TextRun,
  VerticalAlign,
  WidthType,
} = require('docx');

const ROOT = path.resolve(__dirname, '..', '..');
const PAPER = path.join(ROOT, 'output', 'paper');
const R = JSON.parse(fs.readFileSync(path.join(PAPER, 'results.json'), 'utf8'));
const OUTFILE = path.join(PAPER, 'us-beef-supply-chain-simulator-manuscript.docx');

const PHASES = ['cowCalf', 'stocker', 'feedlot', 'packer', 'retail'];
const LABEL = {
  cowCalf: 'Cow-calf',
  stocker: 'Stocker',
  feedlot: 'Feedlot',
  packer: 'Packer',
  retail: 'Retail',
};
const FONT = 'Times New Roman';
const TEXT_WIDTH = 9360; // US Letter with 1-inch margins, in DXA

// ---------------------------------------------------------------- formatting
const num = (v, d = 0) =>
  v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }).replace('-', '\u2212');
const neg = (s) => s.replace(/^-/, '−');
const $M = (v, d = 1) => neg(`${v < 0 ? '-' : ''}$${num(Math.abs(v) / 1e6, d)}`) + (d >= 0 ? '' : '');
const $Mtext = (v, d = 1) => `${$M(v, d)} million`;
const $ = (v, d = 0) => neg(`${v < 0 ? '-' : ''}$${num(Math.abs(v), d)}`);
const pct = (v, d = 1) => neg(`${num(v * 100, d)}%`);
const mil = (v, d = 1) => num(v / 1e6, d);
const signedM = (v, d = 1) => (v >= 0 ? '+' : '−') + `$${num(Math.abs(v) / 1e6, d)}`;
const signedPct = (v, d = 1) => (v >= 0 ? '+' : '−') + `${num(Math.abs(v) * 100, d)}%`;

// ---------------------------------------------------------------- citations
const REFS = {
  ersReceipts:
    'USDA Economic Research Service. Cattle/calf receipts comprised the largest portion of U.S. animal/animal product receipts in 2024. Charts of Note. Washington, DC: USDA ERS (2025). Available at: https://www.ers.usda.gov/data-products/chart-gallery/gallery/chart-detail?chartId=76949 (Accessed October 2, 2026).',
  nass2025:
    'USDA National Agricultural Statistics Service. Cattle (January 31, 2025). Washington, DC: USDA NASS (2025). Available at: https://esmis.nal.usda.gov/sites/default/release-files/h702q636h/sf26b275x/h989sz55j/catl0125.pdf (Accessed October 2, 2026).',
  macdonald2023:
    'MacDonald JM, Dong X, Fuglie KO. Concentration and Competition in U.S. Agribusiness. Economic Information Bulletin No. 256. Washington, DC: USDA Economic Research Service (2023).',
  lusk2021:
    'Lusk JL, Tonsor GT, Schulz LL. Beef and pork marketing margins and price spreads during COVID-19. Appl Econ Perspect Policy. (2021) 43:4–23. doi: 10.1002/aepp.13101',
  rosen1994:
    'Rosen S, Murphy KM, Scheinkman JA. Cattle cycles. J Polit Econ. (1994) 102:468–92. doi: 10.1086/261942',
  kk2021:
    'Kaniyamattam K, Tauer LW, Gröhn YT. System economic costs of antibiotic use elimination in the US beef supply chain. Front Vet Sci. (2021) 8:606810. doi: 10.3389/fvets.2021.606810',
  dennis2018:
    'Dennis EJ, Schroeder TC, Renter DG, Pendell DL. Value of arrival metaphylaxis in U.S. cattle industry. J Agric Resour Econ. (2018) 43:233–50.',
  kk2016:
    'Kaniyamattam K, Elzo MA, Cole JB, De Vries A. Stochastic dynamic simulation modeling including multitrait genetics to estimate genetic, technical, and financial consequences of dairy farm reproduction and selection strategies. J Dairy Sci. (2016) 99:8187–202. doi: 10.3168/jds.2016-11136',
  kkTedeschi2023:
    'Kaniyamattam K, Tedeschi LO. ASAS-NANP symposium: mathematical modeling in animal nutrition: agent-based modeling for livestock systems: the mechanics of development and application. J Anim Sci. (2023) 101:skad321. doi: 10.1093/jas/skad321',
  tedeschi2019:
    'Tedeschi LO. ASN-ASAS symposium: future of data analytics in nutrition: mathematical modeling in ruminant nutrition: approaches and paradigms, extant models, and thoughts for upcoming predictive analytics. J Anim Sci. (2019) 97:1921–44. doi: 10.1093/jas/skz092',
  tedeschi2024:
    'Tedeschi LO, Johnson DC, Atzori AS, Kaniyamattam K, Menendez HM III. Applying systems thinking to sustainable beef production management: modeling-based evidence for enhancing ecosystem services. Systems. (2024) 12:446. doi: 10.3390/systems12110446',
  richardson2000:
    'Richardson JW, Klose SL, Gray AW. An applied procedure for estimating and simulating multivariate empirical (MVE) probability distributions in farm-level risk assessment and policy analysis. J Agric Appl Econ. (2000) 32:299–315. doi: 10.1017/S107407080002037X',
  hardaker2015:
    'Hardaker JB, Lien G, Anderson JR, Huirne RBM. Coping with Risk in Agriculture: Applied Decision Analysis. 3rd ed. Wallingford: CABI (2015). doi: 10.1079/9781780645742.0000',
  rose2016:
    'Rose DC, Sutherland WJ, Parker C, Lobley M, Winter M, Morris C, et al. Decision support tools for agriculture: towards effective design and delivery. Agric Syst. (2016) 149:165–74. doi: 10.1016/j.agsy.2016.09.009',
  adekunle2025:
    'Adekunle AJ, Kaniyamattam K. Feedlot economic visualization decision support tool for sustainable beef production. J Anim Sci. (2025) 103(Suppl. 3):246. doi: 10.1093/jas/skaf300.288',
  veettil2025:
    'Kulangara Veettil V, Tariq MZ, Kaniyamattam K. A machine learning approach for price prediction and decision support in United States (U.S.) cow-calf operations. J Anim Sci. (2025) 103(Suppl. 3):256–7. doi: 10.1093/jas/skaf300.298',
  kk2025:
    'Kaniyamattam K, Adekunle A, Veettil VK, Rejimon SP, Pi Y, Tao J, et al. Design and development of artificial intelligence driven decision support systems for sustainable livestock systems in United States. J Anim Sci. (2025) 103(Suppl. 3):109–10. doi: 10.1093/jas/skaf300.136',
  ersLmdd:
    'USDA Economic Research Service. Livestock and Meat Domestic Data. Washington, DC: USDA ERS. Available at: https://www.ers.usda.gov/data-products/livestock-and-meat-domestic-data (Accessed October 2, 2026).',
  ersMps:
    'USDA Economic Research Service. Meat Price Spreads. Washington, DC: USDA ERS. Available at: https://www.ers.usda.gov/data-products/meat-price-spreads (Accessed October 2, 2026).',
  ersCcr:
    'USDA Economic Research Service. Commodity Costs and Returns: Cow-Calf. Washington, DC: USDA ERS. Available at: https://www.ers.usda.gov/data-products/commodity-costs-and-returns (Accessed October 2, 2026).',
  ersFeed:
    'USDA Economic Research Service. Feed Grains Database: Yearbook Tables. Washington, DC: USDA ERS. Available at: https://www.ers.usda.gov/data-products/feed-grains-database/feed-grains-yearbook-tables (Accessed October 2, 2026).',
  amsGrading:
    'USDA Agricultural Marketing Service. National Steer and Heifer Estimated Grading Percent Report (NW_LS903). Available at: https://esmis.nal.usda.gov/publication/national-steer-and-heifer-estimated-grading-percent-report-csv (Accessed October 2, 2026).',
  amsLmr:
    'USDA Agricultural Marketing Service. Livestock Mandatory Reporting: National Boxed Beef Cutout and Boxed Beef Cuts reports (LM_XB459, LM_XB456). LMR DataMart. Available at: https://mpr.datamart.ams.usda.gov/ (Accessed October 2, 2026).',
  boxMuller1958:
    'Box GEP, Muller ME. A note on the generation of random normal deviates. Ann Math Stat. (1958) 29:610–1. doi: 10.1214/aoms/1177706645',
  repo:
    '[Author(s)]. Beef Chain Simulator, version c03ccbe [software]. GitHub (2026). Available at: https://github.com/patricksemler/beef-chain-simulator',
};
const citeOrder = [];
function citeNumber(key) {
  if (!REFS[key]) throw new Error(`Unknown reference ${key}`);
  let index = citeOrder.indexOf(key);
  if (index === -1) {
    citeOrder.push(key);
    index = citeOrder.length - 1;
  }
  return index + 1;
}
function citeText(keys) {
  const numbers = keys.map(citeNumber).sort((a, b) => a - b);
  // Collapse runs of 3+ consecutive numbers (e.g. 4, 5, 6 -> 4-6).
  const parts = [];
  for (let i = 0; i < numbers.length; i += 1) {
    let j = i;
    while (j + 1 < numbers.length && numbers[j + 1] === numbers[j] + 1) j += 1;
    if (j - i >= 2) parts.push(`${numbers[i]}–${numbers[j]}`);
    else for (let k = i; k <= j; k += 1) parts.push(String(numbers[k]));
    i = j;
  }
  return `(${parts.join(', ')})`;
}

// ---------------------------------------------------------------- inline markup
function runs(text, base = {}) {
  const out = [];
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|\[@[^\]]+\]|_\{[^}]*\}|\^\{[^}]*\})/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > last) out.push(new TextRun({ text: text.slice(last, match.index), ...base }));
    const token = match[0];
    if (token.startsWith('**')) out.push(new TextRun({ text: token.slice(2, -2), ...base, bold: true }));
    else if (token.startsWith('*')) out.push(new TextRun({ text: token.slice(1, -1), ...base, italics: true }));
    else if (token.startsWith('[@'))
      out.push(new TextRun({ text: citeText(token.slice(1, -1).split(';').map((k) => k.trim().replace(/^@/, ''))), ...base }));
    else if (token.startsWith('_{')) out.push(new TextRun({ text: token.slice(2, -1), ...base, subScript: true }));
    else out.push(new TextRun({ text: token.slice(2, -1), ...base, superScript: true }));
    last = match.index + token.length;
  }
  if (last < text.length) out.push(new TextRun({ text: text.slice(last), ...base }));
  return out;
}

const body = [];
const LX = require('./latex-emitter.cjs')();
const P = (text, opts = {}) =>
  (LX.para(text), body.push(
    new Paragraph({
      children: runs(text, opts.run || {}),
      alignment: opts.align || AlignmentType.JUSTIFIED,
      spacing: { after: opts.after ?? 160, line: opts.line ?? 360 },
      indent: opts.indent,
      keepNext: opts.keepNext,
    }),
  ));
const H1 = (text) => (LX.heading(1, text), body.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: runs(text) })));
const H2 = (text) => (LX.heading(2, text), body.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: runs(text) })));
const H3 = (text) => (LX.heading(3, text), body.push(new Paragraph({ heading: HeadingLevel.HEADING_3, children: runs(text) })));
const bullet = (text) =>
  (LX.bullet(text), body.push(
    new Paragraph({
      children: runs(text),
      numbering: { reference: 'bullets', level: 0 },
      spacing: { after: 80, line: 360 },
      alignment: AlignmentType.LEFT,
    }),
  ));
const pageBreak = () => (LX.clearpage(), body.push(new Paragraph({ children: [new PageBreak()] })));

let equationNumber = 0;
function EQ(markup) {
  equationNumber += 1;
  LX.equation(equationNumber);
  body.push(
    new Paragraph({
      children: [
        new TextRun({ text: '\t' }),
        ...runs(markup, { font: 'Cambria Math' }),
        new TextRun({ text: `\t(${equationNumber})` }),
      ],
      tabStops: [
        { type: TabStopType.CENTER, position: TEXT_WIDTH / 2 },
        { type: TabStopType.RIGHT, position: TEXT_WIDTH },
      ],
      spacing: { before: 80, after: 160, line: 300 },
    }),
  );
  return equationNumber;
}

function pngSize(file) {
  const buffer = fs.readFileSync(file);
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20), buffer };
}
let figureNumber = 0;
const FIGURE_ORDER = ['fig1-model-schematic.png', 'fig2-tool-interface.png', 'fig3-s1-stage-profit.png', 'fig4-s2-historical.png', 'fig5-s3-risk-correlation.png', 'fig6-sensitivity-tornado.png'];
function FIGURE(file, caption, widthInches = 6.5) {
  figureNumber += 1;
  if (FIGURE_ORDER[figureNumber - 1] !== file) throw new Error(`Figure ${figureNumber} out of order: ${file}`);
  LX.figure(file, caption);
  const { width, height, buffer } = pngSize(path.join(PAPER, 'figures', file));
  const w = widthInches * 96;
  body.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      keepNext: true,
      spacing: { before: 120, after: 80 },
      children: [new ImageRun({ type: 'png', data: buffer, transformation: { width: w, height: (w * height) / width } })],
    }),
  );
  body.push(
    new Paragraph({
      children: [new TextRun({ text: `Figure ${figureNumber}. `, bold: true }), ...runs(caption)],
      spacing: { after: 240, line: 276 },
      alignment: AlignmentType.JUSTIFIED,
    }),
  );
  return figureNumber;
}

const thin = { style: BorderStyle.SINGLE, size: 4, color: '808080' };
const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
let tableNumber = 0;
/** rows: arrays of strings (markup allowed). opts.widths in DXA summing to TEXT_WIDTH. */
function TABLE(caption, header, rows, opts = {}) {
  LX.table(caption, header, rows, opts);
  const prefix = opts.supplementary ? 'Supplementary Table S' : 'Table ';
  if (!opts.supplementary) tableNumber += 1;
  const label = opts.supplementary ? `${prefix}${opts.supplementary}. ` : `${prefix}${tableNumber}. `;
  body.push(
    new Paragraph({
      children: [new TextRun({ text: label, bold: true }), ...runs(caption)],
      keepNext: true,
      spacing: { before: 200, after: 100, line: 276 },
    }),
  );
  const widths = opts.widths || Array(header.length).fill(Math.floor(TEXT_WIDTH / header.length));
  const size = opts.size || 16;
  const makeRow = (cells, isHeader, rowOpts = {}) =>
    new TableRow({
      tableHeader: isHeader,
      cantSplit: true,
      children: cells.map(
        (cell, i) =>
          new TableCell({
            width: { size: widths[i], type: WidthType.DXA },
            verticalAlign: VerticalAlign.CENTER,
            shading: isHeader ? { type: ShadingType.CLEAR, color: 'auto', fill: 'E8E8E8' } : undefined,
            margins: { top: 40, bottom: 40, left: 70, right: 70 },
            borders: {
              top: isHeader || rowOpts.rule ? thin : none,
              bottom: isHeader || rowOpts.last ? thin : none,
              left: none,
              right: none,
            },
            children: [
              new Paragraph({
                alignment: i === 0 ? AlignmentType.LEFT : AlignmentType.RIGHT,
                children: runs(String(cell), { size, bold: isHeader || rowOpts.bold }),
              }),
            ],
          }),
      ),
    });
  const tableRows = [makeRow(header, true)];
  rows.forEach((row, index) => {
    const isObject = !Array.isArray(row);
    const cells = isObject ? row.cells : row;
    tableRows.push(
      makeRow(cells, false, {
        bold: isObject && row.bold,
        rule: isObject && row.rule,
        last: index === rows.length - 1,
      }),
    );
  });
  body.push(new Table({ width: { size: TEXT_WIDTH, type: WidthType.DXA }, columnWidths: widths, rows: tableRows }));
  if (opts.note)
    body.push(
      new Paragraph({
        children: runs(opts.note, { size: 18 }),
        spacing: { before: 60, after: 240, line: 260 },
        alignment: AlignmentType.JUSTIFIED,
      }),
    );
  else body.push(new Paragraph({ children: [], spacing: { after: 120 } }));
  return opts.supplementary ? `S${opts.supplementary}` : tableNumber;
}

// ---------------------------------------------------------------- derived numbers
const s1 = R.s1;
const s1b = R.s1Rolling;
const s2 = R.s2;
const [s3a, s3b, s3c] = R.s3;
const [s4a, s4b, s4c] = R.s4;
const ph = (scenario, key) => scenario.phases[key];
const chain = (scenario) => scenario.chain;
const inputs2025 = R.historicalProfiles['2025'];
const settings = R.scenarioSettings;
const width = (o) => o.p90 - o.p10;
const sens = (scenario, label) => scenario.sensitivity.find((d) => d.label === label);

const totalHead = settings.totalHead;
const completed = chain(s1).completedHead;
const died = chain(s1).mortalityHead;
const retailLb = chain(s1).retailPounds;
const lbPerHead = retailLb / completed;
const fedExit = ph(s1, 'feedlot').averageExitWeight;
const calfExit = ph(s1, 'cowCalf').averageExitWeight;
const feederExit = ph(s1, 'stocker').averageExitWeight;
const breakEvenRetail = chain(s1).breakEvenRetailPricePerLb;
const breakEvenFed = chain(s1).breakEvenFedPricePerCwt;
const retailPrice = s1.inputs.retailPricePerLb;
const fedPrice = s1.inputs.fedPricePerCwt;
const blended = s1.inputs.blendedGradeIndex;
const byYear = Object.fromEntries(s2.map((r) => [r.referenceYear, r]));
const years = s2.map((r) => r.referenceYear);
const minChain = s2.reduce((a, b) => (b.chain.economicProfit < a.chain.economicProfit ? b : a));
const maxChain = s2.reduce((a, b) => (b.chain.economicProfit > a.chain.economicProfit ? b : a));
const stageRange = (key) => {
  const values = s2.map((r) => r.phases[key].economicProfit);
  return [Math.min(...values), Math.max(...values)];
};
const [retailMin, retailMax] = stageRange('retail');
const [feedlotMin, feedlotMax] = stageRange('feedlot');
const yearsLossOver20 = s2.filter((r) => r.chain.probabilityOfLoss > 0.2).map((r) => r.referenceYear);
const delta = (scenario) => scenario.chain.economicProfit - s1.chain.economicProfit;
const deltaPct = (scenario) => delta(scenario) / s1.chain.economicProfit;
const grades = s1.retailByGrade;
/** [2016, 2017, 2018, 2019, 2022] -> "2016-2019 and 2022" */
function listYears(list) {
  const groups = [];
  for (const y of list) {
    const last = groups[groups.length - 1];
    if (last && y === last[1] + 1) last[1] = y;
    else groups.push([y, y]);
  }
  const parts = groups.map(([a, b]) => (a === b ? String(a) : `${a}–${b}`));
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0];
}

// ======================================================================= TITLE
const TITLE = 'A Stochastic Integrated Beef Supply Chain Simulation Model and Web-Based Decision Support Tool for Evaluating Stage-Level Profitability and Risk in the US Beef Industry';
body.push(
  new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { after: 240, line: 360 },
    children: [
      new TextRun({
        text: TITLE,
        bold: true,
        size: 32,
      }),
    ],
  }),
);
LX.setSuspended(true);
P('[Author 1]^{1}, [Author 2]^{1}, [Author 3]^{1}, and [Corresponding Author]^{1*}', { align: AlignmentType.LEFT, after: 120 });
P('^{1} Department of Animal Science, Texas A&M University, College Station, TX, United States', { align: AlignmentType.LEFT, after: 60 });
P('^{*}**Correspondence:** [Corresponding Author], [email address]', { align: AlignmentType.LEFT, after: 60 });
P('**Running title:** Stochastic US beef supply chain simulation', { align: AlignmentType.LEFT, after: 60 });
P(`**Draft status:** Working draft generated from model commit ${R.gitCommit.slice(0, 7)} on ${R.generatedAt.slice(0, 10)}. Bracketed items are placeholders to be completed by the authors.`, { align: AlignmentType.LEFT, after: 240, run: { color: '7F7F7F' } });
LX.setSuspended(false);

// ======================================================================= ABSTRACT
H1('Abstract');
P(
  `The US beef supply chain generated $112.1 billion in cattle and calf cash receipts in 2024, yet ownership of each animal passes through independently operated cow-calf, stocker, feedlot, packer, and retail segments that capture different and volatile shares of final product value. Most economic decision tools address a single segment, leaving stakeholders without an open, whole-chain view of how prices, biology, and costs transmit profit and risk from calf to retail. Our objective was to develop and demonstrate a stochastic integrated beef supply chain (IBSC) simulation model, delivered as a free web-based decision support tool, that estimates economic profit and risk for each stage and for the chain as a whole. The model follows weighted representative animals through five linked stages with stage-specific days on feed, average daily gain, mortality, and cost of production, and values each change of ownership at USDA market prices perturbed by correlated lognormal shocks. Reference-year inputs for 2015–2025 were derived from USDA Economic Research Service and Agricultural Marketing Service data, including carcass quality grade mix and grade price indices. Four scenarios were evaluated with ${R.trials} Monte Carlo trials each. In the 2025 baseline cohort of ${num(totalHead)} calves, chain economic profit was ${$Mtext(s1.chain.economicProfit)} (${$(s1.chain.economicProfitPerStartedHead)}/head; 10th–90th percentile, ${$M(s1.chain.p10)}–${$M(s1.chain.p90)} million), concentrated in the cow-calf (${$M(ph(s1, 'cowCalf').economicProfit)} million) and retail (${$M(ph(s1, 'retail').economicProfit)} million) stages, whereas stocker (${$M(ph(s1, 'stocker').economicProfit)} million), feedlot (${$M(ph(s1, 'feedlot').economicProfit)} million), and packer (${$M(ph(s1, 'packer').economicProfit)} million) stages incurred losses. Across 2015–2025, median chain profit ranged from ${$Mtext(minChain.chain.economicProfit)} (${minChain.referenceYear}) to ${$Mtext(maxChain.chain.economicProfit)} (${maxChain.referenceYear}). Intermediate cattle prices redistributed but did not create chain profit; retail beef price and saleable yield dominated sensitivity (±${$M(sens(s1, 'Retail beef price').swing)} and ±${$M(sens(s1, 'Saleable yield').swing)} million per 10% change). Stronger price correlation narrowed stage-level risk but not chain-level risk, and shifting 5 percentage points of carcasses from Choice to Prime added ${$Mtext(delta(s4a))} (${pct(deltaPct(s4a))}), accruing entirely to packer and retail. The tool offers a transparent, reproducible basis for examining how value and risk are distributed along the US beef supply chain.`,
);
P('**Keywords:** beef supply chain, stochastic simulation, Monte Carlo, decision support tool, economic modeling, carcass quality grade', { align: AlignmentType.LEFT });

H1('Lay Summary');
P(
  'A steer in the United States is usually owned by several businesses before its beef reaches a grocery store: a cow-calf ranch, a stocker or backgrounding operation, a feedlot, a meat packer, and a retailer. Each business buys the animal or carcass from the previous one, adds weight or value, and sells it on, so a change in any price ripples along the whole chain. We built a free, browser-based simulator that follows a group of calves through all five stages using USDA price and cost data from 2015 to 2025, and that repeats the calculation hundreds of times with random price and animal performance changes to show both expected profit and risk. In 2025, cow-calf producers and retailers were profitable while stockers, feedlots, and packers lost money in the simulation. Prices paid between stages moved profit from one business to another but did not change the profit of the chain as a whole, which depended on what consumers paid for beef, how much saleable beef each animal produced, and feed and operating costs.',
);

H1('Abbreviations');
const abbreviations = [
  ['ABU', 'antibiotic use'],
  ['ADG', 'average daily gain'],
  ['AMS', 'USDA Agricultural Marketing Service'],
  ['BRD', 'bovine respiratory disease'],
  ['cwt', 'hundredweight (100 lb)'],
  ['DM', 'dry matter'],
  ['ERS', 'USDA Economic Research Service'],
  ['IBSC', 'integrated beef supply chain'],
  ['LMR', 'Livestock Mandatory Reporting'],
  ['LP', 'linear programming'],
  ['NASS', 'USDA National Agricultural Statistics Service'],
  ['P10, P90', '10th and 90th percentiles of the simulated distribution'],
  ['USDA', 'United States Department of Agriculture'],
];
LX.setSuspended(true);
for (const [a, b] of abbreviations) P(`**${a},** ${b}`, { align: AlignmentType.LEFT, after: 40 });
LX.setSuspended(false);
LX.abbreviations(abbreviations);
pageBreak();

// ======================================================================= 1 INTRODUCTION
H1('1 Introduction');
P(
  `The US beef industry is one of the largest agricultural sectors in the world. On January 1, 2025, the national inventory was 86.7 million head of cattle and calves, including 27.9 million beef cows and 14.3 million head on feed for the slaughter market [@nass2025]. Cattle and calf cash receipts totaled $112.1 billion in 2024, or 41.7% of all US animal and animal product receipts and the largest single share among livestock commodities [@ersReceipts]. Unlike vertically integrated poultry and swine systems, the beef supply chain remains segmented: calves are born on cow-calf operations, are frequently grown on forage by stocker or backgrounding operations, are finished on high-concentrate rations in feedlots, and are harvested and fabricated by packers before beef is sold to consumers by retail and food service outlets. Ownership, and therefore economic risk, typically changes hands at every one of these steps.`,
);
P(
  `Because each segment buys its principal input from the one before it, the prices paid between segments determine how the value of the final product is shared. That sharing is neither stable nor evenly distributed. The four largest packers accounted for 85% of US steer and heifer slaughter in 2019 [@macdonald2023], and during the COVID-19 pandemic packing capacity fell to about 60% of the previous year's volume while fed cattle prices declined and wholesale and retail beef prices reached record highs, widening farm-to-retail price spreads to unprecedented levels [@lusk2021]. On the supply side, breeding herd inventories follow multi-year cycles driven by heifer retention decisions [@rosen1994], so calf and feeder cattle prices can more than double within a few years, as they did between 2020 and 2025 in the USDA data used in this study. Producers, packers, retailers, lenders, educators, and policymakers therefore need tools that show not only whether the chain as a whole creates value, but where along the chain profit and risk accumulate.`,
);
P(
  `Systems-level economic models of the US beef chain remain scarce. Kaniyamattam et al. [@kk2021] developed an IBSC network model that differentiated the national supply chain into 37 production nodes and used linear programming (LP) to identify the least-cost pathway for supplying 28.5 million calves to packers under alternative antibiotic use (ABU) constraints, estimating that eliminating ABU would raise total system cost by $367 million (0.90%), and that producing only high-health calves would save $2.9 billion. Partial-equilibrium analyses have similarly valued individual health interventions, such as arrival metaphylaxis, at the industry level [@dennis2018]. These approaches are well suited to optimization and policy questions but are deterministic and cost-minimizing; they do not describe the stochastic distribution of profit among segments, nor how price and biological variability propagate along the chain. Stochastic dynamic simulation, by contrast, has a long record in livestock systems research for evaluating technical and financial consequences of management strategies under uncertainty [@kk2016; @tedeschi2019], and agent-based and hybrid intelligent models extend this capability by representing heterogeneous individuals and their decisions [@kkTedeschi2023]. Systems thinking applied to beef production has further emphasized that economic, environmental, and social outcomes must be evaluated across, rather than within, production segments [@tedeschi2024].`,
);
P(
  `Monte Carlo risk simulation is an established method in agricultural economics for farm-level risk assessment and policy analysis [@richardson2000; @hardaker2015], but its uptake by decision makers depends on tools that are accessible, transparent, and relevant to users' decisions [@rose2016]. Recent decision support work in our group has targeted individual segments, including an interactive feedlot economic visualization tool [@adekunle2025], machine learning models for cow-calf price prediction [@veettil2025], and hybrid intelligent mechanistic decision support systems that combine sensor data with mechanistic models to address bovine respiratory disease (BRD), greenhouse gas emissions, and profitability [@kk2025]. To our knowledge, no openly available tool combines all five segments of the US beef chain, USDA-derived historical inputs, carcass quality grades, and stochastic price and biological risk in a single model that runs in a web browser.`,
);
P(
  'Our objective was to develop and demonstrate a stochastic IBSC simulation model, delivered as a free web-based decision support tool, that estimates economic profit and risk for each segment and for the chain as a whole. Specifically, we aimed to (i) describe the model structure, equations, and USDA data pipeline; (ii) quantify the distribution of economic profit among segments for a 2025 baseline and for each reference year from 2015 through 2025; and (iii) evaluate how market-risk structure, carcass quality grade mix, and individual input prices affect stage-level and chain-level outcomes.',
);

// ======================================================================= 2 METHODS
H1('2 Materials and Methods');
H2('2.1 Key Production and Marketing Features of the US Beef Supply Chain');
P(
  `The model represents the conventional pathway of a beef steer through five segments (Figure 1). In the **cow-calf** segment, a calf is born at a mean weight of ${settings.startWeight} lb and raised with its dam to weaning at about 210 days. Weaned calves are sold at the price for medium and large No. 1 steers weighing 500–550 lb [@ersLmdd]. The **stocker** (backgrounding) segment grows weaned calves on forage for about 150 days, and sells them as feeder cattle at the 750–800 lb feeder steer price. The **feedlot** segment finishes feeder cattle on a high-concentrate ration for about 180 days at a dry matter intake of ${settings.feedDryMatterLbPerDay} lb/day, and sells them at the 65–80% Choice fed steer price. The **packer** segment harvests and fabricates fed cattle over about 7 days. Carcass weight is the product of live weight and dressing percentage, and saleable beef is carcass weight multiplied by a saleable yield of ${settings.saleableYield}. The packer sells beef at the Choice wholesale (boxed beef) value and also earns a byproduct credit per head [@ersMps]. The **retail** segment buys beef at the wholesale value, holds it for about 23 days, and sells it at the Choice retail value [@ersMps].`,
);
P(
  `Beef value depends on carcass quality. USDA quality grades (Prime, Choice, and Select, with Standard and ungraded carcasses grouped with Select in this study) are applied to each annual cohort using the national steer and heifer grading distribution [@amsGrading]. Prime and Select beef are priced relative to Choice using price indices derived from USDA Livestock Mandatory Reporting (LMR) boxed beef reports [@amsLmr]. Live cattle sales in the first three segments are priced on a live-weight basis without grid premiums or discounts. As a result, carcass quality affects only the packer and retail segments in the current version of the model.`,
);
H2('2.2 The IBSC Simulation Model');
H3('2.2.1 Model Overview and Representative Agents');
P(
  `The IBSC simulation model is a stochastic, discrete-event Monte Carlo accounting model. In each trial it follows a population of *N* calves through the five segments in sequence. Each segment buys animals (or beef) from the previous segment at that segment's sale value, incurs its own costs, and sells to the next segment. Cow-calf has no acquisition cost. To keep computation independent of herd size, the population is represented by *A* weighted representative agents, each standing for *w* head:`,
);
EQ('A = min(N, 2,500);    w = N / A');
P(
  `Agents enter the chain according to a monthly entry cadence over a planning horizon of *H* months (12–120 months). Supported cadences are even monthly entry, a single entry at the start of the horizon, spring- or fall-weighted calving distributions, and a user-defined monthly pattern. Head are allocated to entry months by the largest-remainder method, so the total is exactly *N*. If the horizon ends while an agent is partway through a segment, the agent is recorded as ending inventory of that segment and valued at the segment's sale price for its current weight. This allows rolling-entry scenarios to report work-in-progress inventory.`,
);
H3('2.2.2 Biological Performance');
P(
  'Within a trial, each agent receives independent standard normal deviates *z* (generated by the Box–Muller method [@boxMuller1958]) that scale its start weight, stage duration, and average daily gain (ADG) around the user-specified means, using a biological variation coefficient *v* (default 0.07). Each multiplier is truncated to plausible bounds:',
);
EQ('W_{0} = W̄_{0} · clamp(1 + 0.85 v z_{1}, 0.80, 1.20)');
EQ('D_{s} = D̄_{s} · clamp(1 + v z_{2}, 0.78, 1.22)');
EQ('g_{s} = clamp(1 + 0.70 v z_{3}, 0.82, 1.18)');
P(
  'where *W*_{0} is the agent’s birth weight (lb), *W̄*_{0} is the mean start weight, *D*_{s} is the duration of segment *s* in days, *D̄*_{s} is the mean duration, and *g*_{s} is the ADG multiplier. If the remaining horizon is shorter than *D*_{s}, the agent completes only a fraction *c*_{s} of the segment. The exit weight is then:',
);
EQ('c_{s} = min[1, (H − t) / (D_{s} / 30.4375)];    d_{s} = c_{s} D_{s};    W_{s}^{out} = W_{s}^{in} + ADG_{s} · d_{s} · g_{s}');
P(
  'where *t* is the agent’s current month, *d*_{s} is the number of days actually spent in the segment, and 30.4375 is the mean number of days per month. Mortality is applied as a Bernoulli event with probability *m*_{s} at the end of each completed segment, after that segment’s costs have been incurred. Dead animals therefore carry their full acquisition and feeding cost without generating revenue.',
);
H3('2.2.3 Stochastic Market Prices');
P(
  'Market price risk is drawn once per trial and shared by all agents in that trial, representing year-level market conditions. For each priced market *k* (weaned calf, feeder, fed cattle, Choice wholesale, and Choice retail), a mean-one lognormal shock is generated from a common market factor *Z*_{0} and an idiosyncratic factor *Z*_{k}, with common-factor loading ρ:',
);
EQ('ε_{k} = exp[σ_{k} (ρ Z_{0} + √(1 − ρ^{2}) Z_{k}) − σ_{k}^{2}/2]');
P(
  'where σ_{k} is the volatility of market *k*. Default volatilities were 0.12 (calf), 0.10 (feeder), 0.08 (fed), 0.06 (wholesale), and 0.04 (retail), and ρ = 0.65. Any two cattle or beef prices therefore have a correlation of ρ^{2} ≈ 0.42 in log space. Feed cost receives a shock with a small negative loading on the common factor, reflecting the inverse relationship between feed cost and cattle prices:',
);
EQ('ε_{f} = exp[σ_{f} (−0.2 Z_{0} + √0.96 Z_{f}) − σ_{f}^{2}/2]');
P(
  'with σ_{f} = 0.12. Optional annual price trends *r*_{k} compound monthly as *P*_{k}(*t*) = *P*_{k,0}(1 + *r*_{k})^{t/12}. All trends were set to zero in this study, so prices in each trial were the reference-year annual means multiplied by the trial’s shocks.',
);
H3('2.2.4 Stage Cost of Production and Revenue');
P('Direct (operating) costs of segment *s* combine a fixed per-head cost, a daily per-head cost, and, for the feedlot, ration cost:');
EQ('C_{s}^{dir} = F_{s} c_{s} + u_{s} d_{s} + [DMI · d_{s} · P_{feed} · ε_{f} / 2,000]_{feedlot}');
P(
  'where *F*_{s} is the fixed direct cost ($/head), *u*_{s} is the daily cost ($/head/day), *DMI* is dry matter intake (lb/day), and *P*_{feed} is the ration cost ($/ton DM). Economic (overhead) costs, which represent allocated fixed costs such as land, capital, and unpaid labor, are *C*_{s}^{econ} = *O*_{s} *c*_{s}. Revenue for the three live-cattle segments is the exit weight multiplied by the shocked price per hundredweight:',
);
EQ('R_{s} = (W_{s}^{out} / 100) · P_{s} · ε_{s},    s ∈ {cow-calf, stocker, feedlot}');
P('For the packer and retail segments, saleable beef *L* (lb) and the blended grade index *G* are calculated as:');
EQ('L = W_{feedlot}^{out} · DP · SY;    G = Σ_{g} π_{g} I_{g},  g ∈ {Prime, Choice, Select},  I_{Choice} = 1');
P(
  'where *DP* is the dressing percentage, *SY* is the saleable yield, π_{g} is the share of carcasses in grade *g*, and *I*_{g} is the price of grade *g* relative to Choice. Packer and retail revenues are:',
);
EQ('R_{packer} = L · P_{wholesale} · G · ε_{wholesale} + B;    R_{retail} = L · P_{retail} · G · ε_{retail}');
P(
  'where *B* is the byproduct credit ($/head). The retailer’s acquisition cost is the wholesale beef value only, excluding the byproduct credit. The retailer also incurs a store operating cost of $1.55 per pound of saleable beef.',
);
H3('2.2.5 Stage Ledgers and Aggregation');
P('For every segment, the model keeps two ledgers that follow standard enterprise budgeting conventions:');
const eqLedger = EQ('OC_{s} = R_{s} + V_{s}^{inv} − A_{s} − C_{s}^{dir};    EP_{s} = OC_{s} − C_{s}^{econ};    EP_{chain} = Σ_{s} EP_{s}');
P(
  'where *OC*_{s} is operating contribution (cash profit before overhead), *V*_{s}^{inv} is the value of ending inventory, *A*_{s} is the acquisition cost (the previous segment’s sale value), and *EP*_{s} is economic profit. Because each segment’s acquisition cost equals the previous segment’s revenue, chain economic profit equals final retail revenue plus byproduct and inventory value, minus all direct and economic costs. Intermediate prices therefore cancel in the chain total.',
);
P(
  `For each scenario, *T* = ${R.trials} trials were simulated. Each ledger line was summarized by its median across trials, and economic profit was recomputed from the median ledger lines so that the reported segment profits sum exactly to the reported chain profit. Risk was summarized by the 10th (P10) and 90th (P90) percentiles of each segment’s and the chain’s per-trial economic profit, and by the probability of loss, P(loss), defined as the share of trials with negative economic profit. Break-even prices were calculated as:`,
);
const eqBE = EQ('P_{retail}^{BE} = P_{retail} − EP_{chain} / (L_{sold} · G);    P_{fed}^{BE} = P_{fed} − EP_{feedlot} / cwt_{fed}');
P(
  'where *L*_{sold} is the total pounds of beef sold at retail and *cwt*_{fed} is the total hundredweight of fed cattle sold. The retail break-even is therefore the Choice retail price at which the chain earns zero economic profit, and the fed cattle break-even is the price at which the feedlot segment earns zero economic profit. Retail results were also divided among quality grades. Sales and beef cost were allocated by each grade’s share of value (π_{g} *I*_{g} / *G*), and store costs by each grade’s share of pounds (π_{g}).',
);

FIGURE(
  'fig1-model-schematic.png',
  'Schematic representation of the stochastic integrated beef supply chain (IBSC) simulation model. Weighted representative animals move through five segments. At each change of ownership, the buying segment pays the selling segment’s market value, so intermediate prices are revenue to one segment and cost to the next. Stage durations, average daily gains, and feed intake shown are the default values; all are user-editable.',
);

H2('2.3 Data Sources and Historical Reference Years');
P(
  `Annual reference-year profiles for 2015 through 2025 were built by an automated data pipeline that downloads current USDA files at run time and records its methodology alongside the data (data generated ${R.historicalDataGeneratedAt.slice(0, 10)}). Market prices were the arithmetic means of monthly USDA ERS observations. Weaned calf, feeder cattle, and fed cattle prices came from the Livestock and Meat Domestic Data product [@ersLmdd], and Choice wholesale value, Choice retail value, and byproduct value came from the Meat Price Spreads product [@ersMps]. The dressing percentage was the ratio of federally inspected average dressed weight to average live weight [@ersLmdd]. Quality grade shares were annual means of the weekly AMS national steer and heifer grading report [@amsGrading]. This report ended in December 2024, so the 2025 profile uses the 2024 grade distribution. The Select index was the weekly LMR Select cutout divided by the Choice cutout. The Prime index was LMR Prime cut prices divided by the matching Choice cuts, matched by product code and weighted by Choice volume [@amsLmr]. Because matched Prime cuts are predominantly rib and loin items, the Prime index probably overstates the carcass-wide Prime premium.`,
);
P(
  `Stage cost assumptions were set for 2025 and indexed to earlier years. The 2025 cow-calf, stocker, feedlot, packer, and retail costs, the $230/ton ration cost, and the $165/head byproduct credit are author assumptions representative of 2025 conditions (Table 1). Earlier years were scaled by the USDA ERS cow-calf operating and allocated overhead cost series [@ersCcr], by the annual corn price received by farmers for ration cost [@ersFeed], and by the ERS Choice beef byproduct value for the byproduct credit [@ersMps]. Stage durations, ADG, and mortality rates were set to representative industry values and held constant across years. Inputs for the 2025 reference year are summarized in Table 1, and the full 2015–2025 input set is provided in Supplementary Table S1.`,
);
const phase = (key) => settings.phases[key];
TABLE(
  'Model inputs for the 2025 reference year (baseline scenario S1).',
  ['Parameter', 'Value', 'Unit', 'Source or derivation'],
  [
    ['Weaned calf price (500–550 lb steers)', num(inputs2025.calfPricePerCwt, 2), '$/cwt', `ERS annual mean [@ersLmdd]`],
    ['Feeder cattle price (750–800 lb steers)', num(inputs2025.feederPricePerCwt, 2), '$/cwt', `ERS annual mean [@ersLmdd]`],
    ['Fed steer price (65–80% Choice)', num(inputs2025.fedPricePerCwt, 2), '$/cwt', `ERS annual mean [@ersLmdd]`],
    ['Choice wholesale value', num(inputs2025.wholesalePricePerLb, 3), '$/lb', `ERS price spreads [@ersMps]`],
    ['Choice retail value', num(inputs2025.retailPricePerLb, 3), '$/lb', `ERS price spreads [@ersMps]`],
    ['Ration cost', num(inputs2025.feedCostPerTon, 0), '$/ton DM', 'Author assumption (2025)'],
    ['Byproduct credit', num(inputs2025.byproductCreditPerHead, 0), '$/head', 'Author assumption (2025)'],
    ['Dressing percentage', pct(inputs2025.dressingPercentage, 2), 'of live weight', `FI dressed ÷ live weight [@ersLmdd]`],
    ['Saleable yield', num(settings.saleableYield, 2), 'proportion', 'Author assumption'],
    [
      'Grade mix, Prime / Choice / Select',
      `${pct(inputs2025.gradeMix.prime, 2)} / ${pct(inputs2025.gradeMix.choice, 2)} / ${pct(inputs2025.gradeMix.select, 2)}`,
      '% of carcasses',
      `AMS grading, 2024 [@amsGrading]`,
    ],
    ['Price index, Prime / Select (Choice = 1)', `${num(inputs2025.gradePriceIndex.prime, 3)} / ${num(inputs2025.gradePriceIndex.select, 3)}`, 'ratio', `AMS LMR [@amsLmr]`],
    { cells: ['Stage biology', '', '', ''], bold: true, rule: true },
    ['Start (birth) weight', num(settings.startWeight), 'lb', 'Author assumption'],
    ['Cow-calf: days / ADG / mortality', `${phase('cowCalf').durationDays} / ${phase('cowCalf').averageDailyGain} / ${pct(phase('cowCalf').mortalityRate)}`, 'd / lb/d / %', 'Author assumption'],
    ['Stocker: days / ADG / mortality', `${phase('stocker').durationDays} / ${phase('stocker').averageDailyGain} / ${pct(phase('stocker').mortalityRate)}`, 'd / lb/d / %', 'Author assumption'],
    ['Feedlot: days / ADG / mortality', `${phase('feedlot').durationDays} / ${phase('feedlot').averageDailyGain} / ${pct(phase('feedlot').mortalityRate)}`, 'd / lb/d / %', 'Author assumption'],
    ['Feedlot dry matter intake', num(settings.feedDryMatterLbPerDay), 'lb DM/d', 'Author assumption'],
    ['Packer / retail: days', `${phase('packer').durationDays} / ${phase('retail').durationDays}`, 'd', 'Author assumption'],
    ['Biological variation coefficient (*v*)', num(settings.biologicalVariation, 2), '–', 'Author assumption'],
    { cells: ['Stage costs (fixed direct / daily / overhead)', '', '', ''], bold: true, rule: true },
    ...PHASES.filter((k) => k !== 'retail').map((k) => [
      LABEL[k],
      `${num(inputs2025.phases[k].directCostPerHead)} / ${num(inputs2025.phases[k].dailyCostPerHead, 2)} / ${num(inputs2025.phases[k].economicCostPerHead)}`,
      '$/head, $/head/d, $/head',
      'Author assumption (2025)',
    ]),
    ['Retail store operating cost', '1.55', '$/lb saleable beef', 'Author assumption'],
    { cells: ['Market risk', '', '', ''], bold: true, rule: true },
    [
      'Volatility σ: calf / feeder / fed / wholesale / retail / feed',
      [settings.marketRisk.calfVolatility, settings.marketRisk.feederVolatility, settings.marketRisk.fedVolatility, settings.marketRisk.wholesaleVolatility, settings.marketRisk.retailVolatility, settings.marketRisk.feedVolatility]
        .map((v) => num(v, 2))
        .join(' / '),
      'log-scale SD',
      'Author assumption',
    ],
    ['Common market factor loading (ρ)', num(settings.marketRisk.commonMarketCorrelation, 2), '–', 'Author assumption'],
  ],
  {
    widths: [3300, 2000, 1500, 2560],
    texCols: '>{\\raggedright\\arraybackslash}p{0.33\\textwidth}>{\\raggedleft\\arraybackslash}p{0.21\\textwidth}>{\\raggedright\\arraybackslash}p{0.12\\textwidth}>{\\raggedright\\arraybackslash}p{0.2\\textwidth}',
    note: 'ADG, average daily gain; AMS, Agricultural Marketing Service; DM, dry matter; ERS, Economic Research Service; FI, federally inspected; LMR, Livestock Mandatory Reporting. Earlier reference years index the 2025 cost assumptions by USDA ERS cost and price series (Section 2.3; Supplementary Table S1).',
  },
);

H2('2.4 Simulation Scenarios');
P(
  `Four scenarios were constructed, each building on the 2025 baseline. All scenarios used ${num(totalHead)} calves, a ${settings.horizonMonths}-month horizon, ${R.trials} trials, and random seed ${settings.seed}. The common seed means that differences between scenarios reflect the changed inputs rather than sampling noise.`,
);
bullet(
  `**Scenario 1 (S1), 2025 baseline cohort.** All ${num(totalHead)} calves entered in month 1, using the 2025 inputs in Table 1. With the default stage durations, a calf takes about 570 days (18.7 months) to move from birth to retail sale, so every surviving animal completes the chain within the 24-month horizon. S1 therefore describes one annual calf crop from birth to consumer. As a comparison (S1b), the same inputs were run with the tool’s default rolling entry, with calves entering evenly across all 24 months.`,
);
bullet('**Scenario 2 (S2), historical retrospective.** S1 was repeated with the input profile of each reference year from 2015 to 2025, holding biology and risk settings constant.');
bullet(
  '**Scenario 3 (S3), market-risk structure.** S1 was repeated with prices independent across markets (ρ = 0; S3a), with prices strongly linked (ρ = 0.95; S3b), and with all volatilities multiplied by 1.5 at the baseline ρ = 0.65 (S3c).',
);
bullet(
  '**Scenario 4 (S4), carcass quality.** S1 was repeated with 5 percentage points of carcasses moved from Choice to Prime (S4a), with 10 percentage points moved from Choice to Select (S4b), and with all carcasses graded Choice, which removes all grade premiums and discounts (S4c).',
);
H2('2.5 Sensitivity Analysis');
P(
  'A one-at-a-time sensitivity analysis was run around the S1 and S1b inputs. Seven drivers were each lowered and raised by 10%: retail beef price, wholesale beef price, fed cattle price, feeder cattle price, weaned calf price, feed cost, and saleable yield. Each variant was run deterministically, with no price shocks, no biological variation, and no mortality, so that each swing reflects only the input change. The swing for a driver was defined as half the absolute difference between chain economic profit at the high and low values. Together with the break-even prices (equation ' +
    eqBE +
    '), this analysis plays the role that opportunity costs and shadow prices play in LP models of the beef chain [@kk2021]: it shows how much chain profit changes per unit change in a constraint or input.',
);
H2('2.6 Software Implementation and Verification');
P(
  `The model was written in TypeScript and runs entirely in the user’s web browser, in a background Web Worker, within a statically hosted web application (https://beef-chain-simulator.vercel.app). No simulation data are sent to a server. Random numbers come from a seeded 32-bit generator (mulberry32), and trial *i* is seeded with the scenario seed plus 7,919 *i*, so every result can be reproduced exactly from its inputs. The test suite includes 24 automated tests of the simulation engine. They check that head counts reconcile (entered = completed + died + ending inventory), that each segment’s ledger identities hold, that results are identical for the same seed and scale linearly with head count, that P10 ≤ median ≤ P90, that edge cases (100% mortality, a single animal, 30 million head over 120 months) are handled, and that retail grade rows sum to the retail totals. The web application presents results in Profit, Cattle flow, and Stage details views and includes a market trends page for the USDA series (Figure 2). It also provides an optional, read-only conversational assistant that explains the current dashboard using the user’s own model provider key, and a WebMCP tool interface that lets external AI agents run scenarios. All results in this paper were generated by a version-controlled experiment script that calls the same simulation engine (Data Availability Statement). A 500-trial scenario took about 0.6 s to run in Node.js on a laptop.`,
);

FIGURE(
  'fig2-tool-interface.png',
  'The web-based decision support tool (https://beef-chain-simulator.vercel.app). The scenario panel (left) holds herd, timing, price, grade, cost, risk, and simulation settings, loaded from the selected USDA reference year. The results area (right) shows whole-chain profit with its P10–P90 range, completed head, beef produced, probability of loss, profit by segment, and the sensitivity tornado. The screenshot shows the tool’s default rolling-entry setting with 250 trials, so values differ slightly from S1b, which used 500 trials.',
);

// ======================================================================= 3 RESULTS
H1('3 Results');
H2('3.1 Baseline Cohort (Scenario 1)');
P(
  `Of the ${num(totalHead)} calves in S1, ${num(completed)} (${pct(completed / totalHead)}) reached retail sale and ${num(died)} (${pct(died / totalHead)}) died, with no animals left in inventory at the end of the horizon (Table 2). Median exit weights were ${num(calfExit)} lb at weaning, ${num(feederExit)} lb as feeder cattle, and ${num(fedExit)} lb as fed cattle, and each completed animal produced ${num(lbPerHead)} lb of saleable beef, for a total of ${mil(retailLb)} million lb.`,
);
P(
  `Median chain economic profit was ${$Mtext(s1.chain.economicProfit)}, or ${$(s1.chain.economicProfitPerStartedHead)} per calf entering the chain (Table 2; Figure 3). The P10–P90 range was ${$M(s1.chain.p10)}–${$M(s1.chain.p90)} million, and none of the ${R.trials} trials produced a chain-level loss. Chain operating contribution before overhead was ${$Mtext(s1.chain.operatingContribution)}. Profit was unevenly distributed among segments. The cow-calf segment earned ${$Mtext(ph(s1, 'cowCalf').economicProfit)} (${$(ph(s1, 'cowCalf').economicProfitPerExitedHead)} per weaned calf) and the retail segment ${$Mtext(ph(s1, 'retail').economicProfit)} (${$(ph(s1, 'retail').economicProfitPerExitedHead)} per head-equivalent sold). In contrast, the stocker (${$Mtext(ph(s1, 'stocker').economicProfit)}; ${$(ph(s1, 'stocker').economicProfitPerExitedHead)}/head), feedlot (${$Mtext(ph(s1, 'feedlot').economicProfit)}; ${$(ph(s1, 'feedlot').economicProfitPerExitedHead)}/head), and packer (${$Mtext(ph(s1, 'packer').economicProfit)}; ${$(ph(s1, 'packer').economicProfitPerExitedHead)}/head) segments incurred median losses. Losses were most likely for the packer (P(loss) = ${pct(ph(s1, 'packer').probabilityOfLoss)}) and feedlot (${pct(ph(s1, 'feedlot').probabilityOfLoss)}) segments. The stocker segment had the widest P10–P90 range relative to its median (${$M(ph(s1, 'stocker').p10)} to ${$M(ph(s1, 'stocker').p90)} million) and lost money in ${pct(ph(s1, 'stocker').probabilityOfLoss)} of trials.`,
);
P(
  `The Choice retail break-even price was ${$(breakEvenRetail, 2)}/lb, ${pct(1 - breakEvenRetail / retailPrice)} below the 2025 Choice retail value of ${$(retailPrice, 2)}/lb. The fed cattle break-even price for the feedlot segment was ${$(breakEvenFed, 2)}/cwt, ${$(breakEvenFed - fedPrice, 2)}/cwt (${pct(breakEvenFed / fedPrice - 1)}) above the 2025 fed steer price of ${$(fedPrice, 2)}/cwt.`,
);
const ledgerRow = (label, p, extra = {}) => ({
  cells: [
    label,
    num(p.enteredHead),
    num(p.exitedHead),
    mil(p.revenue),
    mil(p.acquisitionCost),
    mil(p.directCosts),
    mil(p.economicCosts),
    $M(p.economicProfit).replace('$', ''),
    $(p.economicProfitPerExitedHead),
    `${$M(p.p10).replace('$', '')} to ${$M(p.p90).replace('$', '')}`,
    pct(p.probabilityOfLoss),
  ],
  ...extra,
});
TABLE(
  `Median economic ledger by segment for the 2025 baseline cohort (S1; ${num(totalHead)} calves, ${R.trials} trials). Monetary values in million US$ unless noted.`,
  ['Segment', 'Head in', 'Head out', 'Revenue', 'Acquisition', 'Direct cost', 'Overhead', 'Economic profit', '$/head out', 'P10 to P90', 'P(loss)'],
  [
    ...PHASES.map((k) => ledgerRow(LABEL[k], ph(s1, k))),
    {
      cells: [
        'Whole chain',
        num(totalHead),
        num(completed),
        '–',
        '–',
        '–',
        '–',
        $M(s1.chain.economicProfit).replace('$', ''),
        $(s1.chain.economicProfit / completed),
        `${$M(s1.chain.p10).replace('$', '')} to ${$M(s1.chain.p90).replace('$', '')}`,
        pct(s1.chain.probabilityOfLoss),
      ],
      bold: true,
      rule: true,
    },
  ],
  {
    widths: [1000, 760, 760, 790, 870, 780, 760, 860, 780, 1200, 800],
    size: 15,
    note: 'Revenue for the packer includes the byproduct credit. The retail segment’s direct cost is the $1.55/lb store operating cost. Medians are taken line by line, and economic profit is recomputed from the median lines so that segment profits sum to the chain total. P10 and P90 are the 10th and 90th percentiles of per-trial economic profit, and P(loss) is the share of trials with negative economic profit. Chain $/head out is per completed animal.',
  },
);
FIGURE(
  'fig3-s1-stage-profit.png',
  `Median economic profit by segment and for the whole chain in the 2025 baseline cohort (S1). Whiskers show the 10th to 90th percentile across ${R.trials} Monte Carlo trials. Segment medians sum to the chain median (Section 2.2.5).`,
);

H2('3.2 Retail Economics by Quality Grade');
P(
  `With the 2024 grade mix applied to 2025, the blended grade index was ${num(blended, 4)}, so the average pound of beef sold for ${pct(blended - 1, 2)} more than the Choice price. Prime beef earned the highest retail margin, ${$(grades.prime.profitPerLb, 2)}/lb, compared with ${$(grades.choice.profitPerLb, 2)}/lb for Choice and ${$(grades.select.profitPerLb, 2)}/lb for Select (Table 3). Prime made up ${pct(grades.prime.share)} of pounds but ${pct(grades.prime.profit / ph(s1, 'retail').economicProfit)} of retail economic profit, whereas Select made up ${pct(grades.select.share)} of pounds and ${pct(grades.select.profit / ph(s1, 'retail').economicProfit)} of retail profit.`,
);
TABLE(
  'Retail-segment economics by USDA quality grade in the 2025 baseline cohort (S1).',
  ['Grade', 'Share of carcasses', 'Price index', 'Beef sold (M lb)', 'Price ($/lb)', 'Beef cost ($/lb)', 'Store cost ($/lb)', 'Margin ($/lb)', 'Profit ($M)', 'P10 to P90 ($M)'],
  ['prime', 'choice', 'select'].map((g) => {
    const r = grades[g];
    return [
      g[0].toUpperCase() + g.slice(1),
      pct(r.share, 2),
      num(r.priceIndex, 3),
      mil(r.pounds, 2),
      num(r.pricePerLb, 2),
      num(r.beefCostPerLb, 2),
      num(r.storeCostPerLb, 2),
      num(r.profitPerLb, 2),
      mil(r.profit),
      `${mil(r.p10Profit)} to ${mil(r.p90Profit)}`,
    ];
  }),
  {
    widths: [860, 960, 800, 920, 840, 920, 920, 840, 840, 1460],
    size: 15,
    note: 'Sales and beef cost are allocated by each grade’s share of value and store cost by its share of pounds (Section 2.2.5). Per-pound values cover beef sold. Grade indices apply to both the wholesale and the retail Choice price, so the wholesale cost of a pound of Prime beef is also higher.',
  },
);
H2('3.3 Effect of Entry Timing');
P(
  `With the tool’s default rolling entry (S1b), calves entering after about month 5 had not reached retail by the end of the 24-month horizon. Only ${num(s1b.chain.completedHead)} head (${pct(s1b.chain.completedHead / totalHead)}) completed the chain, and ${num(s1b.chain.endingInventoryHead)} head (${pct(s1b.chain.endingInventoryHead / totalHead)}) remained as ending inventory in some segment (Supplementary Table S2). Median chain economic profit was ${$Mtext(s1b.chain.economicProfit)} (P10–P90, ${$M(s1b.chain.p10)}–${$M(s1b.chain.p90)} million). Because inventory is valued at market prices for the cattle’s current weight, a large share of S1b profit was unrealized. The retail break-even price derived from S1b (${$(s1b.chain.breakEvenRetailPricePerLb, 2)}/lb) divides that profit over only the ${mil(s1b.chain.retailPounds)} million lb actually sold, so it is not comparable to the S1 value. The remaining results therefore use the cohort design.`,
);

H2('3.4 Historical Retrospective, 2015–2025 (Scenario 2)');
P(
  `Median chain economic profit was positive in every reference year but varied by more than an order of magnitude, from ${$Mtext(minChain.chain.economicProfit)} in ${minChain.referenceYear} to ${$Mtext(maxChain.chain.economicProfit)} in ${maxChain.referenceYear} (Table 4; Figure 4A). The probability of a chain-level loss exceeded 20% in ${listYears(yearsLossOver20)}, peaking at ${pct(minChain.chain.probabilityOfLoss)} in ${minChain.referenceYear}. From 2023 onward it was below 1%.`,
);
P(
  `The distribution of profit among segments shifted markedly over the decade (Figure 4B; Supplementary Table S3). Retail was the most profitable segment in every year (${$M(retailMin)} to ${$M(retailMax)} million), and the feedlot segment lost money in every year (${$M(feedlotMax)} to ${$M(feedlotMin)} million). The feedlot’s largest losses came in 2021 (${$Mtext(byYear[2021].phases.feedlot.economicProfit)}) and 2022 (${$Mtext(byYear[2022].phases.feedlot.economicProfit)}), when ration costs indexed to corn reached ${$(byYear[2021].inputs.feedCostPerTon, 0)} and ${$(byYear[2022].inputs.feedCostPerTon, 0)} per ton. The packer segment was profitable only in 2020 (${$Mtext(byYear[2020].phases.packer.economicProfit)}) and 2021 (${$Mtext(byYear[2021].phases.packer.economicProfit)}), when the Choice wholesale value rose relative to fed cattle prices. The cow-calf segment had median losses from 2016 through 2022 but returned to profit in 2023 as the weaned calf price rose from ${$(byYear[2022].inputs.calfPricePerCwt, 2)}/cwt in 2022 to ${$(byYear[2025].inputs.calfPricePerCwt, 2)}/cwt in 2025. It earned ${$Mtext(byYear[2025].phases.cowCalf.economicProfit)} in 2025. The Choice retail break-even price ranged from ${$(Math.min(...s2.map((r) => r.chain.breakEvenRetailPricePerLb)), 2)} to ${$(Math.max(...s2.map((r) => r.chain.breakEvenRetailPricePerLb)), 2)}/lb, and in every year it was below the observed Choice retail value.`,
);
TABLE(
  `Key inputs and simulated whole-chain outcomes by USDA reference year (S2; ${num(totalHead)}-calf cohort, ${R.trials} trials per year).`,
  ['Year', 'Calf ($/cwt)', 'Fed ($/cwt)', 'Retail ($/lb)', 'Feed ($/ton)', 'Chain profit ($M)', 'P10 to P90 ($M)', 'P(loss)', '$/calf', 'BE retail ($/lb)', 'BE fed ($/cwt)'],
  s2.map((r) => [
    String(r.referenceYear),
    num(r.inputs.calfPricePerCwt, 2),
    num(r.inputs.fedPricePerCwt, 2),
    num(r.inputs.retailPricePerLb, 2),
    num(r.inputs.feedCostPerTon, 0),
    mil(r.chain.economicProfit),
    `${$M(r.chain.p10).replace('$', '')} to ${$M(r.chain.p90).replace('$', '')}`,
    pct(r.chain.probabilityOfLoss),
    $(r.chain.economicProfitPerStartedHead),
    num(r.chain.breakEvenRetailPricePerLb, 2),
    num(r.chain.breakEvenFedPricePerCwt, 2),
  ]),
  {
    widths: [600, 800, 800, 780, 780, 900, 1300, 740, 760, 900, 1000],
    size: 15,
    note: 'Calf, 500–550 lb steers; Fed, 65–80% Choice steers; Retail, Choice retail value; Feed, ration cost indexed by corn price. BE, break-even (equation ' + eqBE + '). The BE retail price is the Choice retail price at which chain economic profit is zero, and the BE fed price is the price at which feedlot economic profit is zero.',
  },
);
FIGURE(
  'fig4-s2-historical.png',
  `Simulated economic profit for a ${num(totalHead)}-calf cohort under each USDA reference year from 2015 to 2025 (S2). **(A)** Whole-chain median with the 10th to 90th percentile band. **(B)** Median economic profit by segment.`,
);

H2('3.5 Market-Risk Structure (Scenario 3)');
P(
  `Changing the correlation between markets barely changed median chain profit (${$M(s3a.chain.economicProfit)} million at ρ = 0 and ${$M(s3b.chain.economicProfit)} million at ρ = 0.95, compared with ${$M(s1.chain.economicProfit)} million at ρ = 0.65) or chain-level risk. The chain P10–P90 range was ${$M(width(s3a.chain))}, ${$M(width(s1.chain))}, and ${$M(width(s3b.chain))} million at ρ = 0, 0.65, and 0.95 (Table 5; Figure 5). In contrast, segment-level risk depended strongly on ρ. Moving from independent to strongly linked prices narrowed the P10–P90 range of feedlot profit from ${$Mtext(width(ph(s3a, 'feedlot')))} to ${$Mtext(width(ph(s3b, 'feedlot')))}, of stocker profit from ${$Mtext(width(ph(s3a, 'stocker')))} to ${$Mtext(width(ph(s3b, 'stocker')))}, and of packer profit from ${$Mtext(width(ph(s3a, 'packer')))} to ${$Mtext(width(ph(s3b, 'packer')))}. The narrower ranges did not lower the chance of a loss: feedlot P(loss) rose from ${pct(ph(s3a, 'feedlot').probabilityOfLoss)} at ρ = 0 to ${pct(ph(s3b, 'feedlot').probabilityOfLoss)} at ρ = 0.95, and packer P(loss) from ${pct(ph(s3a, 'packer').probabilityOfLoss)} to ${pct(ph(s3b, 'packer').probabilityOfLoss)}, because their median margins were negative and correlation removed the favorable trials as well as the unfavorable ones. Multiplying all volatilities by 1.5 (S3c) left median chain profit almost unchanged (${$Mtext(s3c.chain.economicProfit)}) but widened the chain P10–P90 range by ${pct(width(s3c.chain) / width(s1.chain) - 1)}, to ${$Mtext(width(s3c.chain))}.`,
);
H2('3.6 Carcass Quality (Scenario 4)');
P(
  `Moving 5 percentage points of carcasses from Choice to Prime (S4a) raised the blended grade index from ${num(blended, 4)} to ${num(s4a.inputs.blendedGradeIndex, 4)}. Chain profit rose by ${$Mtext(delta(s4a))} (${signedPct(deltaPct(s4a))}), or ${$(delta(s4a) / completed, 2)} per completed head. Moving 10 percentage points from Choice to Select (S4b) reduced chain profit by ${$Mtext(-delta(s4b))} (${signedPct(deltaPct(s4b))}). Grading every carcass Choice (S4c) reduced chain profit by ${$Mtext(-delta(s4c))} (${signedPct(deltaPct(s4c))}), which is the net value of the 2024 grade distribution relative to an all-Choice supply. In all three variants the cow-calf, stocker, and feedlot results were identical to S1, because live cattle are priced without grade premiums in the model. The whole change fell to the packer and retail segments (Table 5). For example, in S4a packer profit improved by ${$Mtext(ph(s4a, 'packer').economicProfit - ph(s1, 'packer').economicProfit)} and retail profit by ${$Mtext(ph(s4a, 'retail').economicProfit - ph(s1, 'retail').economicProfit)}.`,
);
const scenarioRow = (label, s) => [
  label,
  mil(s.chain.economicProfit),
  s === s1 ? '–' : signedM(delta(s)).replace('$', ''),
  s === s1 ? '–' : signedPct(deltaPct(s)),
  mil(width(s.chain)),
  mil(width(ph(s, 'feedlot'))),
  mil(width(ph(s, 'packer'))),
  mil(ph(s, 'packer').economicProfit),
  mil(ph(s, 'retail').economicProfit),
  num(s.chain.breakEvenRetailPricePerLb, 2),
];
TABLE(
  'Whole-chain and selected segment outcomes for the market-risk (S3) and carcass-quality (S4) scenarios compared with the 2025 baseline cohort (S1). Monetary values in million US$ unless noted.',
  ['Scenario', 'Chain profit', 'Δ vs. S1', 'Δ vs. S1 (%)', 'Chain P10–P90 width', 'Feedlot P10–P90 width', 'Packer P10–P90 width', 'Packer profit', 'Retail profit', 'BE retail ($/lb)'],
  [
    scenarioRow('S1 Baseline (ρ = 0.65)', s1),
    { cells: scenarioRow('S3a Independent prices (ρ = 0)', s3a), rule: true },
    scenarioRow('S3b Linked prices (ρ = 0.95)', s3b),
    scenarioRow('S3c Volatility × 1.5', s3c),
    { cells: scenarioRow('S4a Prime +5 pp', s4a), rule: true },
    scenarioRow('S4b Select +10 pp', s4b),
    scenarioRow('S4c All Choice', s4c),
  ],
  {
    widths: [1900, 820, 820, 780, 900, 900, 900, 780, 780, 780],
    size: 15,
    note: 'pp, percentage points of carcasses moved from Choice. Width is P90 minus P10 of per-trial economic profit. BE retail, Choice retail break-even price (equation ' + eqBE + ').',
  },
);
FIGURE(
  'fig5-s3-risk-correlation.png',
  'Width of the 10th to 90th percentile range of economic profit by segment and for the whole chain under three levels of common-factor price correlation (S3a, S1, S3b). Correlated prices reduce risk for segments that buy and sell in linked markets, but chain-level risk is essentially unchanged because intermediate prices cancel in the chain total.',
);

H2('3.7 Sensitivity Analysis');
P(
  `In the deterministic baseline cohort (chain economic profit ${$Mtext(s1.sensitivityBase)} without mortality or shocks), only three of the seven drivers changed chain profit (Table 6; Figure 6A). A 10% change in the Choice retail price moved chain profit by ±${$Mtext(sens(s1, 'Retail beef price').swing)}, a 10% change in saleable yield by ±${$Mtext(sens(s1, 'Saleable yield').swing)}, and a 10% change in feed cost by ±${$Mtext(sens(s1, 'Feed cost').swing)}. Changes in the weaned calf, feeder cattle, fed cattle, and wholesale beef prices had no effect on chain profit. They shifted profit between the buying and selling segments in equal and opposite amounts. With rolling entry (S1b; Figure 6B), the calf, feeder, and fed cattle prices also affected chain profit (±${$M(sens(s1b, 'Weaned calf price').swing)}, ±${$M(sens(s1b, 'Feeder cattle price').swing)}, and ±${$Mtext(sens(s1b, 'Fed cattle price').swing)}), because they set the value of cattle still in inventory at the end of the horizon. The wholesale price did not affect chain profit in either design; it acted purely as a transfer between the packer and retail segments.`,
);
TABLE(
  'One-at-a-time sensitivity of whole-chain economic profit to a ±10% change in each driver (deterministic runs; million US$).',
  ['Driver', 'S1 −10%', 'S1 +10%', 'S1 swing (±)', 'S1b −10%', 'S1b +10%', 'S1b swing (±)'],
  s1.sensitivity.map((d) => {
    const b = sens(s1b, d.label);
    return [d.label, mil(d.lowEconomicProfit), mil(d.highEconomicProfit), mil(d.swing, 2), mil(b.lowEconomicProfit), mil(b.highEconomicProfit), mil(b.swing, 2)];
  }),
  {
    widths: [2400, 1160, 1160, 1160, 1160, 1160, 1160],
    note: `Deterministic base: ${$M(s1.sensitivityBase)} million (S1, single cohort) and ${$M(s1b.sensitivityBase)} million (S1b, rolling entry). Swing = |high − low| / 2. Deterministic runs exclude mortality, price shocks, and biological variation, so the bases differ from the stochastic medians in Tables 2 and 5.`,
  },
);
FIGURE(
  'fig6-sensitivity-tornado.png',
  'Change in deterministic whole-chain economic profit when each driver is lowered or raised by 10%. **(A)** Single-cohort baseline (S1), in which every animal completes the chain and intermediate cattle and beef prices cancel. **(B)** Rolling monthly entry (S1b), in which intermediate prices also value end-of-horizon inventory. Note the different horizontal scales.',
);

// ======================================================================= 4 DISCUSSION
H1('4 Discussion');
H2('4.1 The Utility of the IBSC Simulation Model');
P(
  `The IBSC simulation model complements the IBSC network LP model of Kaniyamattam et al. [@kk2021]. Both treat the US beef supply chain as a single system in which the output of one segment is the input of the next. The LP model answers a normative question: what is the least-cost way to route calves through the chain under given constraints? The simulation model answers a descriptive one: given observed market prices and plausible biology and costs, how are profit and risk distributed along the chain, and how do they respond to changes in market conditions? The two are therefore complementary. LP opportunity costs and shadow prices show the marginal value of relaxing a constraint, whereas the break-even prices, sensitivity swings, and percentile ranges reported here show how far a segment or the chain can absorb adverse price movements before economic profit becomes negative.`,
);
P(
  `A central result of this study is that intermediate prices redistribute profit among segments but do not change the profit of the chain as a whole. In the single-cohort baseline, a 10% change in the calf, feeder, fed cattle, or wholesale beef price had no effect on chain profit (Figure 6A). In the same scenarios the feedlot, packer, and stocker segments lost money while cow-calf and retail segments earned the largest margins. This follows directly from the accounting identity in equation ${eqLedger}, but it is easy to overlook when each segment is analyzed separately, as most existing decision tools do [@adekunle2025; @veettil2025]. It implies that public discussion of beef prices that focuses on which segment captures value, such as concerns about packer concentration [@macdonald2023] or record farm-to-retail spreads [@lusk2021], is a question about distribution, whereas the total value available to the chain is set by consumer demand (retail price), carcass yield and quality, and the real resource costs of production. The sensitivity results support this. Retail price and saleable yield were the dominant drivers of chain profit, and feed cost was the only intermediate input that mattered. Interventions that improve yield or quality therefore enlarge the total available to all segments, whereas changes in transfer prices only reallocate it.`,
);
P(
  `The tool is designed for several audiences. Cow-calf and stocker operators can examine how weaning weight, stocker gain, death loss, and calf and feeder prices affect their own margins and their exposure to the buyer’s market. Feedlot managers can relate fed cattle break-even prices to feed cost, days on feed, and placement price. Packers and integrated planners can explore how saleable yield, byproduct value, and the grade mix change wholesale margins. For extension educators and students, the dashboard makes the chain’s accounting visible: users can see how a dollar of retail revenue is divided among segments, and how risk at one stage relates to risk at the next. Because all computation runs in the browser on public USDA data, the tool can be used without installing software or sharing private data, which addresses barriers to adoption of agricultural decision support tools identified by Rose et al. [@rose2016].`,
);
H2('4.2 The Utility of the Simulation Scenarios');
P(
  `Although the model has not been formally calibrated (Section 4.3), several historical patterns it produced agree with documented market events. The packer segment was profitable only in 2020 and 2021, the years in which COVID-19 disruptions reduced packing capacity and farm-to-retail spreads reached records [@lusk2021]. The cow-calf segment moved from losses (2016–2022) to large profits (2023–2025) as calf prices more than doubled. This is consistent with the herd contraction phase of the cattle cycle [@rosen1994] and with the national inventory of 86.7 million head on January 1, 2025 [@nass2025]. Feedlot losses were largest in 2021 and 2022, when corn-indexed ration costs were highest. These patterns arise from the USDA input data alone, with the same biological and cost structure in every year. They therefore indicate that the model’s price-transmission structure is reasonable, but they are not a substitute for validation against observed segment returns.`,
);
P(
  `The market-risk scenarios show why intermediate segments can face risks quite different from those of the chain. When input and output prices are strongly correlated, a feedlot or packer that buys and sells in linked markets is naturally hedged: its P10–P90 profit range narrowed by more than half as ρ rose from 0 to 0.95. At the same time, the feedlot’s median profit changed little (${$M(ph(s3a, 'feedlot').economicProfit)} to ${$M(ph(s3b, 'feedlot').economicProfit)} million) and its probability of loss rose, because correlation reduces the variance of the margin but does not change its expected value. Chain-level risk was essentially independent of ρ, because it depends only on the end-market (retail) price, feed cost, and biology. These results imply that risk management tools such as forward contracts, futures, and margin insurance [@hardaker2015] have very different value to different segments depending on how closely their buy and sell markets move together. Market correlation is therefore an important input for segment-level analyses. Future versions of the model could estimate it from historical price series using multivariate empirical distributions [@richardson2000] instead of assuming it.`,
);
P(
  `The carcass quality scenarios quantify the value of the grade distribution under current price relationships: a 5 percentage point shift from Choice to Prime added ${$Mtext(delta(s4a))} per ${num(totalHead)} calves. In the current model all of this value accrues to the packer and retail segments, because cattle are sold on a live-weight basis without grid premiums. In practice, an increasing share of fed cattle is marketed on value-based grids that pass part of the quality premium back to feedlots, and through feeder cattle prices to cow-calf producers [CITATION NEEDED]. Adding grid pricing to the feedlot sale is therefore a priority extension, and it would allow the model to evaluate how genetic, nutritional, and management investments in carcass quality are rewarded along the chain.`,
);
H2('4.3 Limitations');
P('The results should be interpreted as scenario comparisons rather than forecasts of segment returns. The main limitations are as follows.');
bullet(
  '**No calibration or validation against observed returns.** Historical inputs come from USDA data, but simulated segment profits have not yet been compared with observed returns such as ERS cow-calf cost-and-return estimates or university feedlot closeout series [CITATION NEEDED]. Formal validation is the most important next step.',
);
bullet(
  '**Cost assumptions.** Stage costs, ration cost, and byproduct credit for 2025 are author assumptions. Earlier years scale these values by USDA ERS cow-calf cost, corn price, and byproduct value series, so every segment’s non-feed costs move with cow-calf costs. Segment-specific cost series would improve historical realism.',
);
bullet(
  '**Retail costs.** Retail operating costs are a single $1.55/lb store cost with no retail overhead. The Choice retail value also includes distribution and processing costs beyond the packer that the model does not represent separately. Retail profit is therefore likely overstated, and packer losses may reflect the assumed $695/head packer cost and the use of the Choice cutout value with a fixed saleable yield.',
);
bullet(
  '**Exogenous prices.** Prices are exogenous annual means with one shock per trial. The model has no supply response, inventory feedback, seasonality, or month-to-month price dynamics, and all price trends were set to zero in this study.',
);
bullet(
  '**Single animal type.** A single representative steer pathway is modeled. Heifers, cull cows and bulls, dairy-beef cross calves, calf-fed versus yearling programs, and alternative systems such as grass-finished or natural beef are not represented.',
);
bullet(
  '**Grade data.** The 2025 grade mix reuses 2024 because the weekly AMS grading report ended in December 2024, and the Prime price index probably overstates the carcass-wide Prime premium (Section 2.3).',
);
bullet(
  '**Sensitivity and inventory conventions.** Sensitivity runs exclude mortality, and ending inventory is valued at untrended prices. Both are documented conventions that users should keep in mind when interpreting break-even and rolling-entry results.',
);
H2('4.4 Future Work');
P(
  `The model was built as a foundation for the three priorities that guide decision support work in our group: producer profitability, reduced antimicrobial use, and environmental impact [@kk2025]. First, the IBSC network model differentiated nodes by health management and ABU strategy [@kk2021]. Adding health-status-specific pathways, BRD morbidity and treatment costs, and ABU constraints to the simulation model would combine stochastic profit and risk with those optimization results. Second, adding enteric methane and other emission factors per segment would allow economic and environmental outcomes to be evaluated together [@tedeschi2024]. Third, the static annual price inputs could be replaced or supplemented with machine learning forecasts of cattle prices [@veettil2025], turning the tool from a retrospective planning model into a forward-looking one. Fourth, replacing the independent representative agents with interacting agents that make marketing, placement, and retention decisions would move the model toward a full agent-based or hybrid intelligent representation of the beef chain [@kkTedeschi2023]. Finally, calibrating segment costs and validating outputs against observed returns would strengthen the model as a tool for policy analysis.`,
);

// ======================================================================= 5 CONCLUSION
H1('5 Conclusion');
P(
  `Economic outcomes in the US beef industry are determined jointly by five independently operated segments, yet most decision tools look at one segment at a time. We developed a stochastic IBSC simulation model and free web-based decision support tool that follows cattle from birth to retail sale using USDA reference data for 2015–2025, carcass quality grades, and correlated price and biological risk. For a 2025 cohort of ${num(totalHead)} calves, the chain earned a median economic profit of ${$Mtext(s1.chain.economicProfit)} (${$(s1.chain.economicProfitPerStartedHead)}/calf), but this profit was concentrated in the cow-calf and retail segments while the stocker, feedlot, and packer segments incurred losses. Simulated chain profit varied from ${$Mtext(minChain.chain.economicProfit)} to ${$Mtext(maxChain.chain.economicProfit)} across 2015–2025, and the segments that captured profit changed with the cattle cycle and with market disruptions. Intermediate cattle and beef prices redistributed profit among segments without changing chain profit, which depended on retail beef price, saleable yield, and feed cost. Price correlation reduced segment-level but not chain-level risk, and the value of improved carcass quality accrued to the packer and retail segments in the absence of grid pricing. The model is transparent, reproducible, and open source. With calibration against observed returns and the addition of animal health, antimicrobial use, and emissions pathways, it can support evidence-based decisions that balance profitability, animal welfare, and sustainability across the whole beef supply chain.`,
);

// ======================================================================= BACK MATTER
H1('Data Availability Statement');
P(
  `The simulation model, USDA data pipeline, and the scripts used to generate every result, table, and figure in this article are openly available at https://github.com/patricksemler/beef-chain-simulator (commit ${R.gitCommit.slice(0, 7)}; scripts/paper/) [@repo]. The web application is available at https://beef-chain-simulator.vercel.app. All input data are publicly available from USDA ERS and AMS as cited. Further inquiries can be directed to the corresponding author.`,
);
H1('Author Contributions');
P('[Initials] conceptualized the study and supervised the project. [Initials] developed the model, software, and data pipeline. [Initials] designed the simulation experiments, analyzed results, and wrote the first draft. All authors contributed to the article and approved the submitted version. [To be completed by the authors.]');
H1('Funding');
P('[Funding source(s) and grant numbers, e.g., Texas A&M AgriLife Research; USDA NIFA project number, to be completed by the authors.]');
H1('Acknowledgments');
P('[Optional; to be completed by the authors.]');
H1('Conflict of Interest');
P('The authors declare that the research was conducted in the absence of any commercial or financial relationships that could be construed as a potential conflict of interest.');
H1('Generative AI Statement');
P('[Disclose any use of generative AI in preparing this manuscript or software, as required by the target journal. The software includes an optional AI assistant (Section 2.6) that was not used to generate the results reported here.]');
H1('Supplementary Material');
P('Supplementary Tables S1–S3 are provided at the end of this document for review and will be submitted as a separate file.');

// ======================================================================= REFERENCES
pageBreak();
H1('References');
citeOrder.forEach((key, index) => {
  body.push(
    new Paragraph({
      children: [new TextRun({ text: `${index + 1}. ${REFS[key]}` })],
      spacing: { after: 100, line: 276 },
      indent: { left: 400, hanging: 400 },
    }),
  );
});
LX.bibliography(citeOrder, REFS);

// ======================================================================= SUPPLEMENTARY
pageBreak();
H1('Supplementary Tables');
TABLE(
  'USDA-derived reference-year inputs, 2015–2025.',
  ['Year', 'Calf ($/cwt)', 'Feeder ($/cwt)', 'Fed ($/cwt)', 'Whsl. ($/lb)', 'Retail ($/lb)', 'Feed ($/ton)', 'Byprod. ($/hd)', 'Dress. (%)', 'Prime / Choice / Select (%)', 'Index P / S', 'Cow-calf cost ($/hd)'],
  years.map((y) => {
    const p = R.historicalProfiles[y];
    return [
      String(y),
      num(p.calfPricePerCwt, 2),
      num(p.feederPricePerCwt, 2),
      num(p.fedPricePerCwt, 2),
      num(p.wholesalePricePerLb, 3),
      num(p.retailPricePerLb, 3),
      num(p.feedCostPerTon, 0),
      num(p.byproductCreditPerHead, 0),
      num(p.dressingPercentage * 100, 1),
      `${num(p.gradeMix.prime * 100, 1)} / ${num(p.gradeMix.choice * 100, 1)} / ${num(p.gradeMix.select * 100, 1)}${p.gradeMixYear !== p.year ? `^{a}` : ''}`,
      `${num(p.gradePriceIndex.prime, 3)} / ${num(p.gradePriceIndex.select, 3)}`,
      `${num(p.phases.cowCalf.directCostPerHead)} + ${num(p.phases.cowCalf.economicCostPerHead)}`,
    ];
  }),
  {
    supplementary: 1,
    widths: [520, 720, 760, 700, 700, 700, 640, 740, 640, 1360, 900, 980],
    size: 14,
    note: '^{a} 2025 uses the 2024 grade distribution (AMS grading report ended December 2024). Cow-calf cost is shown as fixed direct + overhead ($/head). Stocker, feedlot, and packer costs are indexed by the same ERS cow-calf cost series.',
  },
);
TABLE(
  `Median economic ledger by segment with rolling monthly entry (S1b; ${num(totalHead)} calves, ${R.trials} trials; million US$ unless noted).`,
  ['Segment', 'Head in', 'Head out', 'Ending inventory (head)', 'Revenue', 'Inventory value', 'Acquisition', 'Direct + overhead', 'Economic profit'],
  PHASES.map((k) => {
    const p = ph(s1b, k);
    return [LABEL[k], num(p.enteredHead), num(p.exitedHead), num(p.endingInventoryHead), mil(p.revenue), mil(p.terminalInventoryValue), mil(p.acquisitionCost), mil(p.directCosts + p.economicCosts), mil(p.economicProfit)];
  }).concat([{ cells: ['Whole chain', num(totalHead), num(s1b.chain.completedHead), num(s1b.chain.endingInventoryHead), '', '', '', '', mil(s1b.chain.economicProfit)], bold: true, rule: true }]),
  { supplementary: 2, widths: [1100, 920, 920, 1200, 980, 1080, 1060, 1060, 1040], size: 15 },
);

TABLE(
  'Median economic profit by segment for each reference year (S2; million US$).',
  ['Year', ...PHASES.map((k) => LABEL[k]), 'Whole chain'],
  s2.map((r) => [String(r.referenceYear), ...PHASES.map((k) => mil(r.phases[k].economicProfit)), mil(r.chain.economicProfit)]),
  { supplementary: 3, widths: [1200, 1360, 1360, 1360, 1360, 1360, 1360] },
);
// ======================================================================= DOCUMENT
const doc = new Document({
  creator: '[Authors]',
  title: 'Stochastic integrated beef supply chain simulation model',
  styles: {
    default: { document: { run: { font: FONT, size: 24 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 28, bold: true }, paragraph: { spacing: { before: 360, after: 160 }, outlineLevel: 0, keepNext: true } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 24, bold: true }, paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1, keepNext: true } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 24, bold: true, italics: true }, paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 2, keepNext: true } },
    ],
  },
  numbering: {
    config: [
      {
        reference: 'bullets',
        levels: [{ level: 0, format: 'bullet', text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } }],
      },
    ],
  },
  sections: [
    {
      properties: {
        page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } },
        lineNumbers: { countBy: 1, restart: LineNumberRestartFormat.CONTINUOUS, distance: 360 },
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], size: 20 })] })],
        }),
      },
      children: body,
    },
  ],
});

Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync(OUTFILE, buffer);
  const texDir = path.join(PAPER, 'latex');
  fs.mkdirSync(path.join(texDir, 'figures'), { recursive: true });
  for (const file of fs.readdirSync(path.join(PAPER, 'figures')).filter((f) => f.endsWith('.png'))) {
    fs.copyFileSync(path.join(PAPER, 'figures', file), path.join(texDir, 'figures', file));
  }
  fs.writeFileSync(
    path.join(texDir, 'main.tex'),
    LX.finish({
      commit: R.gitCommit.slice(0, 7),
      date: R.generatedAt.slice(0, 10),
      title: TITLE,
      runningTitle: 'Stochastic US beef supply chain simulation',
    }),
  );
  console.log(`wrote ${path.join(texDir, 'main.tex')}`);
  const unused = Object.keys(REFS).filter((k) => !citeOrder.includes(k));
  console.log(`wrote ${OUTFILE}`);
  console.log(`references cited: ${citeOrder.length}; unused: ${unused.join(', ') || 'none'}`);
  console.log(`figures: ${figureNumber}; tables: ${tableNumber}; equations: ${equationNumber}`);
});
