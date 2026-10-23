/**
 * Reproduces every number reported in the manuscript draft in output/paper/.
 *
 * Bundle and run (esbuild resolves the tsconfig "@/" alias):
 *   npx esbuild scripts/paper/run-experiments.ts --bundle --platform=node \
 *     --format=esm --outfile=output/paper/.run-experiments.mjs
 *   node output/paper/.run-experiments.mjs
 *
 * Scenarios build on one another, following the scenario design of
 * Kaniyamattam et al. (2021, Front. Vet. Sci. 8:606810):
 *   S1 baseline: one 100,000-head calf cohort entering in month 1 (2025 USDA
 *      reference year, otherwise default settings, 500 trials), so every
 *      surviving animal reaches retail inside the 24-month horizon
 *   S1b the tool's default rolling (even) monthly entry, for comparison
 *   S2 historical retrospective (S1 re-run for each reference year 2015-2025)
 *   S3 market-risk structure (S1 with altered correlation and volatility)
 *   S4 carcass quality (S1 with altered grade mixes)
 */
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { cloneDefaultScenario } from '@/lib/model/defaults';
import {
  AVAILABLE_HISTORICAL_YEARS,
  applyHistoricalYear,
  getHistoricalProfile,
  HISTORICAL_DATA_GENERATED_AT,
} from '@/lib/model/historical';
import { blendedGradeIndex, runSimulation } from '@/lib/model/simulate';
import type {
  PhaseKey,
  ScenarioInput,
  SimulationSummary,
} from '@/lib/model/types';

const PHASES: PhaseKey[] = ['cowCalf', 'stocker', 'feedlot', 'packer', 'retail'];
const TRIALS = 500;

function baseline(): ScenarioInput {
  const scenario = cloneDefaultScenario();
  scenario.trials = TRIALS;
  scenario.cadence = 'upfront';
  return scenario;
}

function summarize(label: string, result: SimulationSummary) {
  const s = result.scenario;
  return {
    label,
    referenceYear: s.referenceYear,
    inputs: {
      calfPricePerCwt: s.calfPricePerCwt,
      feederPricePerCwt: s.feederPricePerCwt,
      fedPricePerCwt: s.fedPricePerCwt,
      wholesalePricePerLb: s.wholesalePricePerLb,
      retailPricePerLb: s.retailPricePerLb,
      feedCostPerTon: s.feedCostPerTon,
      byproductCreditPerHead: s.byproductCreditPerHead,
      dressingPercentage: s.dressingPercentage,
      gradeMix: s.gradeMix,
      gradePriceIndex: s.gradePriceIndex,
      blendedGradeIndex: blendedGradeIndex(s),
      marketRisk: s.marketRisk,
    },
    chain: {
      economicProfit: result.chainEconomicProfit,
      operatingContribution: result.chainOperatingContribution,
      p10: result.chainP10,
      p90: result.chainP90,
      probabilityOfLoss: result.chainProbabilityOfLoss,
      economicProfitPerStartedHead:
        result.chainEconomicProfit / result.totalStartedHead,
      breakEvenRetailPricePerLb: result.breakEvenRetailPricePerLb,
      breakEvenFedPricePerCwt: result.breakEvenFedPricePerCwt,
      completedHead: result.completedHead,
      mortalityHead: result.mortalityHead,
      endingInventoryHead: result.endingInventoryHead,
      retailPounds: result.retailPounds,
      reconciliationDifference: result.reconciliationDifference,
    },
    phases: Object.fromEntries(
      PHASES.map((key) => {
        const p = result.phases[key];
        return [
          key,
          {
            enteredHead: p.enteredHead,
            exitedHead: p.exitedHead,
            mortalityHead: p.mortalityHead,
            endingInventoryHead: p.endingInventoryHead,
            revenue: p.revenue,
            terminalInventoryValue: p.terminalInventoryValue,
            acquisitionCost: p.acquisitionCost,
            directCosts: p.directCosts,
            economicCosts: p.economicCosts,
            operatingContribution: p.operatingContribution,
            economicProfit: p.economicProfit,
            economicProfitPerExitedHead: p.economicProfitPerExitedHead,
            margin: p.margin,
            p10: p.p10EconomicProfit,
            p90: p.p90EconomicProfit,
            probabilityOfLoss: p.probabilityOfLoss,
            averageExitWeight: p.averageExitWeight,
          },
        ];
      }),
    ),
    retailByGrade: result.retailByGrade,
    sensitivityBase: result.sensitivityBase,
    sensitivity: result.sensitivity,
  };
}

function run(label: string, scenario: ScenarioInput) {
  return summarize(label, runSimulation(scenario));
}

// S1: baseline. Run twice to confirm seed reproducibility.
const s1 = run('S1 Baseline cohort (2025)', baseline());
const s1Repeat = run('S1 repeat', baseline());
const reproducible =
  JSON.stringify({ ...s1, label: '' }) ===
  JSON.stringify({ ...s1Repeat, label: '' });

// S1b: the tool's default even monthly entry. Calves entering after about
// month 5 are still in the chain at month 24 and are valued as inventory.
const s1Rolling = (() => {
  const scenario = baseline();
  scenario.cadence = 'even';
  return run('S1b Rolling monthly entry (tool default)', scenario);
})();

// S2: historical reference years.
const s2 = AVAILABLE_HISTORICAL_YEARS.map((year) =>
  run(`S2 ${year}`, applyHistoricalYear(baseline(), year)),
);

// S3: market-risk structure.
function withRisk(label: string, rho: number, volScale: number) {
  const scenario = baseline();
  const risk = scenario.marketRisk;
  scenario.marketRisk = {
    calfVolatility: risk.calfVolatility * volScale,
    feederVolatility: risk.feederVolatility * volScale,
    fedVolatility: risk.fedVolatility * volScale,
    wholesaleVolatility: risk.wholesaleVolatility * volScale,
    retailVolatility: risk.retailVolatility * volScale,
    feedVolatility: risk.feedVolatility * volScale,
    commonMarketCorrelation: rho,
  };
  return run(label, scenario);
}
const s3 = [
  withRisk('S3a Independent prices (rho = 0)', 0, 1),
  withRisk('S3b Highly linked prices (rho = 0.95)', 0.95, 1),
  withRisk('S3c Volatility x1.5 (rho = 0.65)', 0.65, 1.5),
];

// S4: carcass quality.
function withGrades(
  label: string,
  mix: ScenarioInput['gradeMix'],
) {
  const scenario = baseline();
  scenario.gradeMix = mix;
  return run(label, scenario);
}
const base = baseline().gradeMix;
const s4 = [
  withGrades('S4a Prime +5 pp (from Choice)', {
    prime: base.prime + 0.05,
    choice: base.choice - 0.05,
    select: base.select,
  }),
  withGrades('S4b Select +10 pp (from Choice)', {
    prime: base.prime,
    choice: base.choice - 0.1,
    select: base.select + 0.1,
  }),
  withGrades('S4c All Choice (no grade premium/discount)', {
    prime: 0,
    choice: 1,
    select: 0,
  }),
];

function git(command: string) {
  try {
    return execSync(`git ${command}`, { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

const modelDirty = git('status --porcelain -- lib scripts/data tests') !== '';

const output = {
  generatedAt: new Date().toISOString(),
  gitCommit: git('rev-parse HEAD'),
  modelFilesDirty: modelDirty,
  historicalDataGeneratedAt: HISTORICAL_DATA_GENERATED_AT,
  trials: TRIALS,
  reproducible,
  scenarioSettings: {
    totalHead: baseline().totalHead,
    horizonMonths: baseline().horizonMonths,
    cadence: baseline().cadence,
    seed: baseline().seed,
    biologicalVariation: baseline().biologicalVariation,
    startWeight: baseline().startWeight,
    saleableYield: baseline().saleableYield,
    feedDryMatterLbPerDay: baseline().feedDryMatterLbPerDay,
    phases: baseline().phases,
    marketRisk: baseline().marketRisk,
  },
  historicalProfiles: Object.fromEntries(
    AVAILABLE_HISTORICAL_YEARS.map((year) => [
      year,
      getHistoricalProfile(year),
    ]),
  ),
  s1,
  s1Rolling,
  s2,
  s3,
  s4,
};

mkdirSync('output/paper', { recursive: true });
writeFileSync('output/paper/results.json', JSON.stringify(output, null, 2));

const m = (value: number) => `$${(value / 1e6).toFixed(2)}M`;
console.log(`commit ${output.gitCommit} dirty=${modelDirty} reproducible=${reproducible}`);
for (const row of [s1, s1Rolling, ...s2, ...s3, ...s4]) {
  console.log(
    `${row.label.padEnd(44)} chain ${m(row.chain.economicProfit)} ` +
      `P10 ${m(row.chain.p10)} P90 ${m(row.chain.p90)} ` +
      `Ploss ${(row.chain.probabilityOfLoss * 100).toFixed(1)}% | ` +
      PHASES.map((key) => `${key} ${m(row.phases[key].economicProfit)}`).join(
        ' ',
      ),
  );
}
