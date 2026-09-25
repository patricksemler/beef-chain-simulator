import { compactCurrency, currency, percent, whole } from '@/lib/model/format';
import type { ScenarioInput, SimulationSummary } from '@/lib/model/types';
import { PHASES } from './metrics';
import type { DashboardSnapshot, ResultsPage, ScenarioSection } from './types';

export const RESULT_PAGE_LABELS: Record<ResultsPage, string> = {
  profit: 'Profit',
  flow: 'Cattle flow',
  details: 'Stage details',
};

export const SCENARIO_SECTION_LABELS: Record<ScenarioSection, string> = {
  prices: 'Prices',
  biology: 'Herd & costs',
  yield: 'Yields & trends',
  risk: 'Price swings',
  run: 'Simulation settings',
  sources: 'Data sources',
};

const CADENCE_LABELS: Record<ScenarioInput['cadence'], string> = {
  even: 'Even monthly',
  upfront: 'All upfront',
  spring: 'Spring weighted',
  fall: 'Fall weighted',
  custom: 'Custom weights',
};

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export function hasStaleDisplayedResult(
  draftScenario: ScenarioInput,
  displayedResult: SimulationSummary | null,
) {
  return (
    displayedResult !== null &&
    JSON.stringify(draftScenario) !== JSON.stringify(displayedResult.scenario)
  );
}

const money = (value: number) =>
  `${compactCurrency(value)} (${currency(value)})`;
const pct = (fraction: number) => percent(fraction);
const perCwt = (value: number) => `$${value.toFixed(2)}/cwt`;
const perLb = (value: number) => `$${value.toFixed(3)}/lb`;
const perHead = (value: number) => `$${value.toFixed(2)}/head`;
const horizonLabel = (months: number) =>
  months === 12 ? '1 year' : `${months / 12} years`;

/** Every scenario input as the Scenario panel labels it. */
export function describeScenario(scenario: ScenarioInput) {
  const phaseRows = PHASES.map(({ key, label }) => {
    const phase = scenario.phases[key];
    return `  - ${label}: Days ${phase.durationDays}; Daily gain ${phase.averageDailyGain} lb; Mortality ${pct(phase.mortalityRate)}; Direct cost ${perHead(phase.directCostPerHead)}; Daily cost ${perHead(phase.dailyCostPerHead)}; Overhead ${perHead(phase.economicCostPerHead)}`;
  });
  const cadence =
    scenario.cadence === 'custom'
      ? `Custom weights (${scenario.customCadence
          .map((weight, index) => `${MONTHS[index]} ${weight}`)
          .join(', ')})`
      : CADENCE_LABELS[scenario.cadence];
  const risk = scenario.marketRisk;
  return [
    `- Calves entering: ${whole(scenario.totalHead)} head`,
    `- Time period: ${horizonLabel(scenario.horizonMonths)} (${scenario.horizonMonths} months)`,
    `- When calves enter: ${cadence}`,
    '- Prices:',
    `  - Weaned calf ${perCwt(scenario.calfPricePerCwt)}; Feeder cattle ${perCwt(scenario.feederPricePerCwt)}; Fed cattle ${perCwt(scenario.fedPricePerCwt)}`,
    `  - Wholesale beef ${perLb(scenario.wholesalePricePerLb)}; Retail beef ${perLb(scenario.retailPricePerLb)}`,
    `  - Feed $${scenario.feedCostPerTon.toFixed(2)}/ton; Byproduct ${perHead(scenario.byproductCreditPerHead)}`,
    '- Herd & costs:',
    `  - Start weight ${scenario.startWeight} lb; Animal variation ${pct(scenario.biologicalVariation)}`,
    ...phaseRows,
    '- Yields & trends:',
    `  - Dressing yield ${pct(scenario.dressingPercentage)}; Saleable yield ${pct(scenario.saleableYield)}; Feed intake ${scenario.feedDryMatterLbPerDay} lb/day`,
    `  - Cattle price trend ${pct(scenario.annualCattlePriceTrend)}/yr; Wholesale price trend ${pct(scenario.annualWholesalePriceTrend)}/yr; Retail price trend ${pct(scenario.annualRetailPriceTrend)}/yr; Feed cost trend ${pct(scenario.annualFeedCostTrend)}/yr`,
    '- Price swings (annual volatility used for the Monte Carlo runs):',
    `  - Calf ${pct(risk.calfVolatility)}; Feeder ${pct(risk.feederVolatility)}; Fed ${pct(risk.fedVolatility)}; Wholesale ${pct(risk.wholesaleVolatility)}; Retail ${pct(risk.retailVolatility)}; Feed cost ${pct(risk.feedVolatility)}; Correlation ${risk.commonMarketCorrelation}`,
    '- Simulation settings:',
    `  - Reference year ${scenario.referenceYear} (USDA profile); Runs ${whole(scenario.trials)}; Random seed ${scenario.seed}`,
  ].join('\n');
}

const INPUT_LABELS: Array<[string, (scenario: ScenarioInput) => string]> = [
  ['Reference year', (s) => String(s.referenceYear)],
  ['Calves entering', (s) => `${whole(s.totalHead)} head`],
  ['Time period', (s) => horizonLabel(s.horizonMonths)],
  ['When calves enter', (s) => CADENCE_LABELS[s.cadence]],
  ['Custom monthly weights', (s) => s.customCadence.join(',')],
  ['Random seed', (s) => String(s.seed)],
  ['Runs', (s) => String(s.trials)],
  ['Animal variation', (s) => pct(s.biologicalVariation)],
  ['Start weight', (s) => `${s.startWeight} lb`],
  ['Weaned calf price', (s) => perCwt(s.calfPricePerCwt)],
  ['Feeder cattle price', (s) => perCwt(s.feederPricePerCwt)],
  ['Fed cattle price', (s) => perCwt(s.fedPricePerCwt)],
  ['Wholesale beef price', (s) => perLb(s.wholesalePricePerLb)],
  ['Retail beef price', (s) => perLb(s.retailPricePerLb)],
  ['Feed cost', (s) => `$${s.feedCostPerTon.toFixed(2)}/ton`],
  ['Byproduct credit', (s) => perHead(s.byproductCreditPerHead)],
  ['Dressing yield', (s) => pct(s.dressingPercentage)],
  ['Saleable yield', (s) => pct(s.saleableYield)],
  ['Feed intake', (s) => `${s.feedDryMatterLbPerDay} lb/day`],
  ['Cattle price trend', (s) => pct(s.annualCattlePriceTrend)],
  ['Wholesale price trend', (s) => pct(s.annualWholesalePriceTrend)],
  ['Retail price trend', (s) => pct(s.annualRetailPriceTrend)],
  ['Feed cost trend', (s) => pct(s.annualFeedCostTrend)],
  ...PHASES.flatMap<[string, (scenario: ScenarioInput) => string]>(
    ({ key, label }) => [
      [`${label} days`, (s) => String(s.phases[key].durationDays)],
      [`${label} daily gain`, (s) => `${s.phases[key].averageDailyGain} lb`],
      [`${label} mortality`, (s) => pct(s.phases[key].mortalityRate)],
      [`${label} direct cost`, (s) => perHead(s.phases[key].directCostPerHead)],
      [`${label} daily cost`, (s) => perHead(s.phases[key].dailyCostPerHead)],
      [`${label} overhead`, (s) => perHead(s.phases[key].economicCostPerHead)],
    ],
  ),
  ['Calf price swing', (s) => pct(s.marketRisk.calfVolatility)],
  ['Feeder price swing', (s) => pct(s.marketRisk.feederVolatility)],
  ['Fed price swing', (s) => pct(s.marketRisk.fedVolatility)],
  ['Wholesale price swing', (s) => pct(s.marketRisk.wholesaleVolatility)],
  ['Retail price swing', (s) => pct(s.marketRisk.retailVolatility)],
  ['Feed cost swing', (s) => pct(s.marketRisk.feedVolatility)],
  ['Correlation', (s) => String(s.marketRisk.commonMarketCorrelation)],
];

/** Inputs the user has edited since the displayed results were produced. */
export function describeScenarioDifferences(
  draft: ScenarioInput,
  displayed: ScenarioInput,
) {
  return INPUT_LABELS.flatMap(([label, read]) => {
    const before = read(displayed);
    const after = read(draft);
    return before === after ? [] : [`  - ${label}: ${before} → ${after}`];
  });
}

/** Every value the results panel is showing, tab by tab. */
export function describeResults(result: SimulationSummary) {
  const entered = Math.max(result.totalStartedHead, 1);
  const completedShare = result.completedHead / entered;
  const sectorRows = [...PHASES]
    .sort(
      (a, b) =>
        result.phases[b.key].economicProfit -
        result.phases[a.key].economicProfit,
    )
    .map(
      ({ key, label }) =>
        `  - ${label}: Profit ${money(result.phases[key].economicProfit)}`,
    );
  const flowRows = PHASES.map(({ key, label }) => {
    const phase = result.phases[key];
    const share = phase.exitedHead / entered;
    const weight =
      phase.averageExitWeight > 0
        ? `; average exit weight ${whole(phase.averageExitWeight)} lb`
        : '';
    return `  - ${label}: ${whole(phase.exitedHead)} head exited (${pct(share)} of calves in)${weight}`;
  });
  const outcomeRows = PHASES.map(({ key, label }) => {
    const phase = result.phases[key];
    return `  - ${label}: ${whole(phase.enteredHead)} entered; ${whole(phase.exitedHead)} moved on or sold; ${whole(phase.endingInventoryHead)} still in this stage at period end; ${whole(phase.mortalityHead)} died`;
  });
  const journeyDays = PHASES.reduce(
    (sum, { key }) => sum + result.scenario.phases[key].durationDays,
    0,
  );
  const journeyMonths = journeyDays / 30.4375;
  const lastEntryMonth = Math.floor(
    Math.max(result.scenario.horizonMonths - journeyMonths, 0),
  );
  const stageRows = PHASES.map(({ key, label }) => {
    const phase = result.phases[key];
    const moneyIn = phase.revenue + phase.terminalInventoryValue;
    const moneyOut =
      phase.acquisitionCost + phase.directCosts + phase.economicCosts;
    const perAnimal = phase.economicProfit / Math.max(phase.enteredHead, 1);
    return `  - ${label}: Money in ${currency(moneyIn)} (sales ${currency(phase.revenue)} + ending inventory value ${currency(phase.terminalInventoryValue)}); Money out ${currency(moneyOut)} (buying cattle ${currency(phase.acquisitionCost)} + direct costs ${currency(phase.directCosts)} + overhead ${currency(phase.economicCosts)}); Cash profit ${currency(phase.operatingContribution)}; Total profit ${currency(phase.economicProfit)}; Per animal entering the stage ${currency(perAnimal)}; Margin ${pct(phase.margin)}; Range of outcomes P10 ${currency(phase.p10EconomicProfit)} to P90 ${currency(phase.p90EconomicProfit)}; Chance of a loss ${pct(phase.probabilityOfLoss)}`;
  });
  const sensitivityRows = [...result.sensitivity]
    .sort((a, b) => b.swing - a.swing)
    .map(
      (driver) =>
        `  - ${driver.label}: 10% lower → ${currency(driver.lowEconomicProfit)}; 10% higher → ${currency(driver.highEconomicProfit)}; bar label ±${money(driver.swing)}`,
    );
  const retailCushion =
    (result.scenario.retailPricePerLb - result.breakEvenRetailPricePerLb) /
    Math.max(result.scenario.retailPricePerLb, 0.01);
  const fedGap =
    (result.breakEvenFedPricePerCwt - result.scenario.fedPricePerCwt) /
    Math.max(result.scenario.fedPricePerCwt, 0.01);
  return [
    `Results are based on the ${result.scenario.referenceYear} USDA profile (${result.dataVintage}). Every result below is a model output, not a USDA statistic.`,
    '',
    '"Profit" tab, headline card:',
    `  - Total profit (headline, median across runs): ${money(result.chainEconomicProfit)}`,
    `  - Range bar under it: P10 ${currency(result.chainP10)} to P90 ${currency(result.chainP90)}`,
    `  - Cash profit (before overhead): ${money(result.chainOperatingContribution)}`,
    `  - Cattle finished: ${whole(result.completedHead)} (${pct(completedShare)} of calves)`,
    `  - Beef produced: ${whole(result.retailPounds)} lb at retail`,
    `  - Chance of a loss: ${pct(result.chainProbabilityOfLoss)} across ${whole(result.scenario.trials)} runs`,
    '"Profit" tab, "Profit by stage" card (bars sorted from most to least profitable):',
    ...sectorRows,
    `"Profit" tab, "What moves profit most" card (change in total profit when one input moves 10%, from a base case of ${currency(result.sensitivityBase)} run without random price swings):`,
    ...sensitivityRows,
    'Break-even prices (computed by the model, not shown on screen):',
    `  - Retail beef price: today $${result.scenario.retailPricePerLb.toFixed(2)}/lb vs break-even $${result.breakEvenRetailPricePerLb.toFixed(2)}/lb (retail price where total chain profit is zero); ${retailCushion >= 0 ? `${pct(retailCushion)} cushion` : `needs +${pct(-retailCushion)}`}`,
    `  - Fed cattle price: today ${perCwt(result.scenario.fedPricePerCwt)} vs break-even ${perCwt(result.breakEvenFedPricePerCwt)} (fed price where feedlot profit is zero); ${fedGap <= 0 ? `${pct(-fedGap)} cushion` : `needs +${pct(fedGap)}`}`,
    '',
    '"Cattle flow" tab:',
    `  - ${whole(result.totalStartedHead)} calves in`,
    `  - Current chain status: Completed ${pct(completedShare)}; Still in chain ${pct(result.endingInventoryHead / entered)}; Mortality ${pct(result.mortalityHead / entered)}`,
    ...flowRows,
    `  - Calf to retail: ${whole(journeyDays)} days; Finished weight: ${whole(result.phases.feedlot.averageExitWeight)} lb; Beef per animal sold: ${whole(result.completedHead > 0 ? result.retailPounds / result.completedHead : 0)} lb; Died: ${whole(result.mortalityHead)}`,
    '  - "What happened at each stage" card:',
    ...outcomeRows.map((row) => `  ${row}`),
    `  - "Calf-to-retail timeline" card: the journey takes about ${journeyMonths.toFixed(1)} months against a ${result.scenario.horizonMonths}-month period, so ${lastEntryMonth > 0 ? `only calves entering in roughly the first ${lastEntryMonth} month(s) can reach retail` : 'no calves can reach retail'} before the period ends`,
    '',
    '"Stage details" tab (the user picks one stage; the panel shows its profit, per-animal profit, margin, chance of a loss, range of outcomes, a profit bridge, cost mix, and a cost-pressure chart, then a table of all stages):',
    ...stageRows,
  ].join('\n');
}

/**
 * Text description of everything on screen, used as the model's only source
 * of truth for numbers the user is looking at.
 */
export function describeDashboard(snapshot: DashboardSnapshot) {
  const { draftScenario: draft, displayedResult: result } = snapshot;
  const status: string[] = [
    `- Results tab open: "${RESULT_PAGE_LABELS[snapshot.activeResultsPage]}"`,
    `- Scenario sections expanded: ${
      snapshot.openScenarioSections.length
        ? snapshot.openScenarioSections
            .map((section) => `"${SCENARIO_SECTION_LABELS[section]}"`)
            .join(', ')
        : 'none'
    }`,
  ];
  if (snapshot.isRunning) {
    status.push(
      '- A simulation is running right now; the displayed results may be replaced shortly.',
    );
  }
  if (result && snapshot.isStale) {
    const differences = describeScenarioDifferences(draft, result.scenario);
    status.push(
      '- STALE: the user edited inputs after the displayed results were produced and has not pressed "Run Simulation" yet. The results below still reflect the previous inputs. Edited inputs (displayed → current):',
      ...(differences.length
        ? differences
        : ['  - (no visible field differs)']),
    );
  } else if (result) {
    status.push(
      '- The displayed results match the current inputs (nothing is stale).',
    );
  }
  const scenarioHeading = result
    ? snapshot.isStale
      ? 'CURRENT SCENARIO INPUTS (as edited; not yet run)'
      : 'SCENARIO INPUTS (these produced the displayed results)'
    : 'SCENARIO INPUTS';
  return [
    `CURRENT DASHBOARD STATE (captured ${snapshot.capturedAt})`,
    '',
    'STATUS',
    ...status,
    '',
    scenarioHeading,
    describeScenario(draft),
    '',
    'DISPLAYED RESULTS',
    result
      ? describeResults(result)
      : 'No results are displayed yet (the first simulation has not finished).',
  ].join('\n');
}
