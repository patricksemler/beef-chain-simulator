/**
 * # Simulate
 *
 * ## What this file is for
 * This file helps run the simulator experience and shows the controls and results people use to test scenarios.
 *
 * ## What it does
 * - Helps the app show the right page, section, or feature.
 * - Accepts or sends data needed by the rest of the app.
 * - Keeps the code organized so it is easier to understand and update.
 *
 * ## Main pieces in this file
 * - `validateScenario`: the main thing this file provides to the app.
 * - Other small helper functions or values support that main work.
 *
 * ## Important tools and connections
 * - Uses project code and libraries that help the app run smoothly.
 * - Works with the rest of the simulator, dashboard, or UI layers.
 *
 * ## How data moves through it
 * Data usually comes in from a user action or from another part of the app. This file reads that information, applies the needed logic, and then sends it on or displays it on screen.
 *
 * ## Errors and edge cases
 * The code checks for missing, unusual, or invalid values and tries to handle them safely. If something is not valid, it usually falls back to a safe default or prevents the bad input from continuing.
 *
 * ## How it fits into the app
 * This file is one small part of the larger system. It connects to other sections so the app feels like one working tool instead of separate pieces.
 *
 * ## Helpful notes
 * The goal here is to keep the code simple, clear, and easy to maintain without changing how the app behaves.
 */
import { historicalDataVintage, isHistoricalYear } from './historical';
import { PHASE_ORDER } from './phases';
import type {
  EntryCadence,
  GradeKey,
  GradeResult,
  MonthlyResult,
  PhaseKey,
  PhaseResult,
  ScenarioInput,
  SensitivityResult,
  SimulationProgress,
  SimulationSummary,
} from './types';

const MONTH_DAYS = 30.4375;
const GRADES: GradeKey[] = ['prime', 'choice', 'select'];
/** Retail store operating cost per pound of saleable beef. */
const RETAIL_COST_PER_LB = 1.55;

type Ledger = Omit<
  PhaseResult,
  | 'p10EconomicProfit'
  | 'p90EconomicProfit'
  | 'probabilityOfLoss'
  | 'economicProfitPerStartedHead'
  | 'economicProfitPerExitedHead'
  | 'margin'
>;

interface TrialResult {
  phases: Record<PhaseKey, Ledger>;
  monthly: MonthlyResult[];
  completedHead: number;
  mortalityHead: number;
  endingInventoryHead: number;
  retailPounds: number;
  /** Retail dollars for beef actually sold, excluding beef still on hand. */
  retailSales: RetailSales;
  chainEconomicProfit: number;
  chainOperatingContribution: number;
  fedLiveCwtSold: number;
}

interface RetailSales {
  revenue: number;
  beefCost: number;
  storeCost: number;
}
function mulberry32(seed: number) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function normal(random: () => number) {
  const u = Math.max(random(), Number.EPSILON);
  const v = Math.max(random(), Number.EPSILON);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function percentile(values: number[], quantile: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * quantile;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function gradePriceIndex(input: ScenarioInput, key: GradeKey) {
  return key === 'choice' ? 1 : input.gradePriceIndex[key];
}

/** Mix-weighted price multiplier applied to Choice wholesale and retail prices. */
export function blendedGradeIndex(input: ScenarioInput) {
  return GRADES.reduce(
    (sum, key) => sum + input.gradeMix[key] * gradePriceIndex(input, key),
    0,
  );
}

type GradeSplit = Omit<
  GradeResult,
  'key' | 'share' | 'priceIndex' | 'p10Profit' | 'p90Profit'
>;

/**
 * Splits a retail ledger across grades. Sales and beef purchases follow each
 * grade's share of value (share x price index); store costs follow its share of
 * pounds. The grade rows sum to the ledger's totals. Per-pound figures use only
 * beef actually sold, since the totals also carry beef still on hand.
 */
function splitRetailByGrade(
  input: ScenarioInput,
  ledger: Pick<
    Ledger,
    | 'revenue'
    | 'terminalInventoryValue'
    | 'acquisitionCost'
    | 'directCosts'
    | 'economicCosts'
  >,
  pounds: number,
  sales: RetailSales,
): Record<GradeKey, GradeSplit> {
  const blended = Math.max(blendedGradeIndex(input), Number.EPSILON);
  return Object.fromEntries(
    GRADES.map((key) => {
      const share = input.gradeMix[key];
      const valueShare = (share * gradePriceIndex(input, key)) / blended;
      const revenue =
        (ledger.revenue + ledger.terminalInventoryValue) * valueShare;
      const beefCost = ledger.acquisitionCost * valueShare;
      const storeCost = (ledger.directCosts + ledger.economicCosts) * share;
      const gradePounds = pounds * share;
      const perLb = (value: number) =>
        gradePounds > 0 ? value / gradePounds : 0;
      const pricePerLb = perLb(sales.revenue * valueShare);
      const beefCostPerLb = perLb(sales.beefCost * valueShare);
      const storeCostPerLb = perLb(sales.storeCost * share);
      return [
        key,
        {
          pounds: gradePounds,
          revenue,
          beefCost,
          storeCost,
          profit: revenue - beefCost - storeCost,
          pricePerLb,
          beefCostPerLb,
          storeCostPerLb,
          profitPerLb: pricePerLb - beefCostPerLb - storeCostPerLb,
        },
      ];
    }),
  ) as Record<GradeKey, GradeSplit>;
}

export function validateScenario(input: ScenarioInput) {
  const errors: string[] = [];
  if (!isHistoricalYear(input.referenceYear)) {
    errors.push(
      'Reference year must be one of the available USDA annual profiles.',
    );
  }
  if (
    !Number.isInteger(input.totalHead) ||
    input.totalHead < 1 ||
    input.totalHead > 30_000_000
  ) {
    errors.push('Head count must be a whole number from 1 to 30,000,000.');
  }
  if (
    !Number.isInteger(input.horizonMonths) ||
    input.horizonMonths < 12 ||
    input.horizonMonths > 120
  ) {
    errors.push('Horizon must be between 12 and 120 months.');
  }
  if (
    !Number.isInteger(input.trials) ||
    input.trials < 1 ||
    input.trials > 500
  ) {
    errors.push('Trials must be between 1 and 500.');
  }
  if (input.biologicalVariation < 0 || input.biologicalVariation > 1) {
    errors.push('Biological variation must be between 0% and 100%.');
  }
  if (
    input.customCadence.length !== 12 ||
    input.customCadence.some((value) => value < 0)
  ) {
    errors.push('Custom cadence must contain 12 non-negative monthly weights.');
  }
  if (
    input.cadence === 'custom' &&
    input.customCadence.every((value) => value === 0)
  ) {
    errors.push('At least one custom cadence month must be greater than zero.');
  }
  const shares = GRADES.map((key) => input.gradeMix[key]);
  if (
    shares.some((share) => !(share >= 0 && share <= 1)) ||
    Math.abs(shares.reduce((sum, share) => sum + share, 0) - 1) > 0.001
  ) {
    errors.push('Grade shares must each be 0-100% and add up to 100%.');
  }
  if (
    !(input.gradePriceIndex.prime > 0 && input.gradePriceIndex.prime <= 5) ||
    !(input.gradePriceIndex.select > 0 && input.gradePriceIndex.select <= 5)
  ) {
    errors.push('Grade price indexes must be between 0 and 5 times Choice.');
  }
  for (const key of PHASE_ORDER) {
    const phase = input.phases[key];
    if (phase.durationDays < 0 || phase.averageDailyGain < 0)
      errors.push(`${phase.label} timing values cannot be negative.`);
    if (phase.mortalityRate < 0 || phase.mortalityRate > 1)
      errors.push(`${phase.label} mortality must be between 0% and 100%.`);
  }
  return errors;
}

function cadenceWeights(cadence: EntryCadence, custom: number[]) {
  if (cadence === 'upfront') return [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  if (cadence === 'spring')
    return [0.5, 0.85, 1.5, 1.9, 1.6, 1, 0.55, 0.35, 0.3, 0.3, 0.3, 0.4];
  if (cadence === 'fall')
    return [0.35, 0.3, 0.3, 0.35, 0.45, 0.6, 0.8, 1.15, 1.7, 1.9, 1.45, 0.85];
  if (cadence === 'custom') return custom;
  return Array(12).fill(1);
}

export function allocateEntryMonths(
  input: Pick<
    ScenarioInput,
    'totalHead' | 'horizonMonths' | 'cadence' | 'customCadence'
  >,
) {
  const weights = cadenceWeights(input.cadence, input.customCadence);
  const monthWeights = Array.from(
    { length: input.horizonMonths },
    (_, month) =>
      input.cadence === 'upfront' ? (month === 0 ? 1 : 0) : weights[month % 12],
  );
  const totalWeight = monthWeights.reduce((sum, value) => sum + value, 0);
  const raw = monthWeights.map(
    (value) => (value / totalWeight) * input.totalHead,
  );
  const allocated = raw.map(Math.floor);
  const remaining =
    input.totalHead - allocated.reduce((sum, value) => sum + value, 0);
  const remainderOrder = raw
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction);
  for (let i = 0; i < remaining; i += 1)
    allocated[remainderOrder[i % remainderOrder.length].index] += 1;
  return allocated;
}

function emptyLedger(key: PhaseKey, label: string): Ledger {
  return {
    key,
    label,
    enteredHead: 0,
    exitedHead: 0,
    mortalityHead: 0,
    endingInventoryHead: 0,
    revenue: 0,
    terminalInventoryValue: 0,
    acquisitionCost: 0,
    directCosts: 0,
    economicCosts: 0,
    operatingContribution: 0,
    economicProfit: 0,
    averageExitWeight: 0,
  };
}

function trend(base: number, annualRate: number, month: number) {
  return base * Math.pow(1 + annualRate, month / 12);
}

function simulateTrial(
  input: ScenarioInput,
  trialIndex: number,
  deterministic = false,
): TrialResult {
  const random = mulberry32(input.seed + trialIndex * 7_919);
  const agentCount = Math.min(input.totalHead, 2_500);
  const entryAllocation = allocateEntryMonths(input);
  const entryCumulative: number[] = [];
  let running = 0;
  for (const value of entryAllocation) {
    running += value;
    entryCumulative.push(running);
  }
  const phases = Object.fromEntries(
    PHASE_ORDER.map((key) => [key, emptyLedger(key, input.phases[key].label)]),
  ) as Record<PhaseKey, Ledger>;
  const monthly = Array.from({ length: input.horizonMonths }, (_, index) => ({
    month: index + 1,
    cowCalf: 0,
    stocker: 0,
    feedlot: 0,
    packer: 0,
    retail: 0,
    chain: 0,
  }));
  const common = deterministic ? 0 : normal(random);
  const rho = clamp(input.marketRisk.commonMarketCorrelation, 0, 0.95);
  const linkedShock = (volatility: number) =>
    deterministic
      ? 1
      : Math.exp(
          volatility *
            (rho * common + Math.sqrt(1 - rho * rho) * normal(random)) -
            0.5 * volatility * volatility,
        );
  const calfShock = linkedShock(input.marketRisk.calfVolatility);
  const feederShock = linkedShock(input.marketRisk.feederVolatility);
  const fedShock = linkedShock(input.marketRisk.fedVolatility);
  const wholesaleShock = linkedShock(input.marketRisk.wholesaleVolatility);
  const retailShock = linkedShock(input.marketRisk.retailVolatility);
  const gradeIndex = blendedGradeIndex(input);
  const feedShock = deterministic
    ? 1
    : Math.exp(
        input.marketRisk.feedVolatility *
          (-0.2 * common + Math.sqrt(0.96) * normal(random)) -
          0.5 * input.marketRisk.feedVolatility ** 2,
      );

  let completedHead = 0;
  let mortalityHead = 0;
  let endingInventoryHead = 0;
  let retailPounds = 0;
  const retailSales: RetailSales = { revenue: 0, beefCost: 0, storeCost: 0 };
  let fedLiveCwtSold = 0;

  for (let agent = 0; agent < agentCount; agent += 1) {
    const agentStart = (agent / agentCount) * input.totalHead;
    const nextAgentStart = ((agent + 1) / agentCount) * input.totalHead;
    const weight = nextAgentStart - agentStart;
    const targetHead = (agent + 0.5) * weight;
    const entryMonth = entryCumulative.findIndex((value) => targetHead < value);
    let currentMonth = Math.max(0, entryMonth);
    let liveWeight =
      input.startWeight *
      (deterministic
        ? 1
        : clamp(
            1 + normal(random) * input.biologicalVariation * 0.85,
            0.8,
            1.2,
          ));
    let acquisitionValue = 0;
    let isFinished = false;
    let isDead = false;

    for (const key of PHASE_ORDER) {
      const phase = input.phases[key];
      const ledger = phases[key];
      if (currentMonth >= input.horizonMonths || isDead || isFinished) break;
      ledger.enteredHead += weight;
      ledger.acquisitionCost += acquisitionValue * weight;

      const durationFactor = deterministic
        ? 1
        : clamp(1 + normal(random) * input.biologicalVariation, 0.78, 1.22);
      const durationDays = Math.max(0, phase.durationDays * durationFactor);
      const durationMonths = durationDays / MONTH_DAYS;
      const availableMonths = input.horizonMonths - currentMonth;
      const completionRatio = clamp(
        availableMonths / Math.max(durationMonths, 0.001),
        0,
        1,
      );
      const daysInPhase = durationDays * completionRatio;
      const gainFactor = deterministic
        ? 1
        : clamp(
            1 + normal(random) * input.biologicalVariation * 0.7,
            0.82,
            1.18,
          );
      const exitWeight =
        liveWeight + phase.averageDailyGain * daysInPhase * gainFactor;
      const stageDirectCost =
        phase.directCostPerHead * completionRatio +
        phase.dailyCostPerHead * daysInPhase;
      const feedCost =
        key === 'feedlot'
          ? (input.feedDryMatterLbPerDay *
              daysInPhase *
              trend(
                input.feedCostPerTon,
                input.annualFeedCostTrend,
                currentMonth,
              ) *
              feedShock) /
            2_000
          : 0;
      ledger.directCosts += (stageDirectCost + feedCost) * weight;
      ledger.economicCosts +=
        phase.economicCostPerHead * completionRatio * weight;

      // A stage that ends on the horizon leaves no time to enter the next one,
      // so the animal stays in this stage as ending inventory. Retail is the
      // last stage, so finishing it on the horizon is still a completed sale.
      const endsAtHorizon =
        key !== 'retail' &&
        currentMonth + durationMonths >= input.horizonMonths;
      const completedPhase = completionRatio >= 0.999999 && !endsAtHorizon;
      if (!completedPhase) {
        const terminalValue =
          key === 'cowCalf'
            ? (exitWeight / 100) * input.calfPricePerCwt * calfShock
            : key === 'stocker'
              ? (exitWeight / 100) * input.feederPricePerCwt * feederShock
              : key === 'feedlot'
                ? (exitWeight / 100) * input.fedPricePerCwt * fedShock
                : key === 'packer'
                  ? exitWeight *
                      input.dressingPercentage *
                      input.saleableYield *
                      input.wholesalePricePerLb *
                      gradeIndex *
                      wholesaleShock +
                    input.byproductCreditPerHead
                  : exitWeight *
                    input.dressingPercentage *
                    input.saleableYield *
                    input.retailPricePerLb *
                    gradeIndex *
                    retailShock;
        ledger.terminalInventoryValue += terminalValue * weight;
        ledger.endingInventoryHead += weight;
        endingInventoryHead += weight;
        liveWeight = exitWeight;
        break;
      }

      const deathProbability = clamp(phase.mortalityRate, 0, 1);
      if (!deterministic && random() < deathProbability) {
        ledger.mortalityHead += weight;
        mortalityHead += weight;
        isDead = true;
        break;
      }

      currentMonth += durationMonths;
      const resultMonth = clamp(
        Math.floor(currentMonth),
        0,
        input.horizonMonths - 1,
      );
      ledger.exitedHead += weight;
      ledger.averageExitWeight += exitWeight * weight;

      let saleValue = 0;
      let nextAcquisitionValue = 0;
      if (key === 'cowCalf') {
        saleValue =
          (exitWeight / 100) *
          trend(
            input.calfPricePerCwt,
            input.annualCattlePriceTrend,
            currentMonth,
          ) *
          calfShock;
        nextAcquisitionValue = saleValue;
      } else if (key === 'stocker') {
        saleValue =
          (exitWeight / 100) *
          trend(
            input.feederPricePerCwt,
            input.annualCattlePriceTrend,
            currentMonth,
          ) *
          feederShock;
        nextAcquisitionValue = saleValue;
      } else if (key === 'feedlot') {
        saleValue =
          (exitWeight / 100) *
          trend(
            input.fedPricePerCwt,
            input.annualCattlePriceTrend,
            currentMonth,
          ) *
          fedShock;
        nextAcquisitionValue = saleValue;
        fedLiveCwtSold += (exitWeight / 100) * weight;
      } else if (key === 'packer') {
        const pounds =
          exitWeight * input.dressingPercentage * input.saleableYield;
        const wholesaleValue =
          pounds *
          trend(
            input.wholesalePricePerLb,
            input.annualWholesalePriceTrend,
            currentMonth,
          ) *
          gradeIndex *
          wholesaleShock;
        saleValue = wholesaleValue + input.byproductCreditPerHead;
        nextAcquisitionValue = wholesaleValue;
      } else {
        const pounds =
          exitWeight * input.dressingPercentage * input.saleableYield;
        saleValue =
          pounds *
          trend(
            input.retailPricePerLb,
            input.annualRetailPriceTrend,
            currentMonth,
          ) *
          gradeIndex *
          retailShock;
        const retailCost = pounds * RETAIL_COST_PER_LB;
        ledger.directCosts += retailCost * weight;
        retailPounds += pounds * weight;
        retailSales.revenue += saleValue * weight;
        retailSales.beefCost += acquisitionValue * weight;
        retailSales.storeCost +=
          (stageDirectCost + retailCost + phase.economicCostPerHead) * weight;
        completedHead += weight;
        isFinished = true;
      }
      ledger.revenue += saleValue * weight;
      acquisitionValue = nextAcquisitionValue;
      liveWeight = exitWeight;
      const contribution = saleValue * weight;
      monthly[resultMonth][key] += contribution;
    }
  }

  for (const key of PHASE_ORDER) {
    const ledger = phases[key];
    ledger.operatingContribution =
      ledger.revenue +
      ledger.terminalInventoryValue -
      ledger.acquisitionCost -
      ledger.directCosts;
    ledger.economicProfit = ledger.operatingContribution - ledger.economicCosts;
    ledger.averageExitWeight =
      ledger.exitedHead > 0 ? ledger.averageExitWeight / ledger.exitedHead : 0;
  }

  const chainEconomicProfit = PHASE_ORDER.reduce(
    (sum, key) => sum + phases[key].economicProfit,
    0,
  );
  const chainOperatingContribution = PHASE_ORDER.reduce(
    (sum, key) => sum + phases[key].operatingContribution,
    0,
  );
  for (const key of PHASE_ORDER) {
    const activity = monthly.reduce((sum, month) => sum + month[key], 0);
    if (activity > 0) {
      for (const month of monthly)
        month[key] = phases[key].economicProfit * (month[key] / activity);
    } else {
      monthly[monthly.length - 1][key] = phases[key].economicProfit;
    }
  }
  for (const month of monthly) {
    month.chain = PHASE_ORDER.reduce((sum, key) => sum + month[key], 0);
  }

  return {
    phases,
    monthly,
    completedHead,
    mortalityHead,
    endingInventoryHead,
    retailPounds,
    retailSales,
    chainEconomicProfit,
    chainOperatingContribution,
    fedLiveCwtSold,
  };
}

function aggregate(
  input: ScenarioInput,
  trials: TrialResult[],
  runtimeMs: number,
): SimulationSummary {
  const medianTrial = trials[Math.floor(trials.length / 2)];
  const phases = {} as Record<PhaseKey, PhaseResult>;
  for (const key of PHASE_ORDER) {
    const economicProfits = trials.map(
      (trial) => trial.phases[key].economicProfit,
    );
    const base = medianTrial.phases[key];
    const medianRevenue = percentile(
      trials.map((trial) => trial.phases[key].revenue),
      0.5,
    );
    const medianTerminalValue = percentile(
      trials.map((trial) => trial.phases[key].terminalInventoryValue),
      0.5,
    );
    const medianAcquisitionCost = percentile(
      trials.map((trial) => trial.phases[key].acquisitionCost),
      0.5,
    );
    const medianDirectCosts = percentile(
      trials.map((trial) => trial.phases[key].directCosts),
      0.5,
    );
    const medianEconomicCosts = percentile(
      trials.map((trial) => trial.phases[key].economicCosts),
      0.5,
    );
    const operatingContribution =
      medianRevenue +
      medianTerminalValue -
      medianAcquisitionCost -
      medianDirectCosts;
    const economicProfit = operatingContribution - medianEconomicCosts;
    phases[key] = {
      ...base,
      economicProfit,
      operatingContribution,
      revenue: medianRevenue,
      terminalInventoryValue: medianTerminalValue,
      acquisitionCost: medianAcquisitionCost,
      directCosts: medianDirectCosts,
      economicCosts: medianEconomicCosts,
      enteredHead: percentile(
        trials.map((trial) => trial.phases[key].enteredHead),
        0.5,
      ),
      exitedHead: percentile(
        trials.map((trial) => trial.phases[key].exitedHead),
        0.5,
      ),
      mortalityHead: percentile(
        trials.map((trial) => trial.phases[key].mortalityHead),
        0.5,
      ),
      endingInventoryHead: percentile(
        trials.map((trial) => trial.phases[key].endingInventoryHead),
        0.5,
      ),
      averageExitWeight: percentile(
        trials.map((trial) => trial.phases[key].averageExitWeight),
        0.5,
      ),
      economicProfitPerStartedHead: economicProfit / input.totalHead,
      economicProfitPerExitedHead:
        economicProfit / Math.max(base.exitedHead, 1),
      margin:
        economicProfit /
        Math.max(base.revenue + base.terminalInventoryValue, 1),
      p10EconomicProfit: percentile(economicProfits, 0.1),
      p90EconomicProfit: percentile(economicProfits, 0.9),
      probabilityOfLoss:
        economicProfits.filter((value) => value < 0).length /
        economicProfits.length,
    };
  }

  const monthly = Array.from({ length: input.horizonMonths }, (_, month) => {
    const row = {
      month: month + 1,
      cowCalf: 0,
      stocker: 0,
      feedlot: 0,
      packer: 0,
      retail: 0,
      chain: 0,
    };
    for (const key of PHASE_ORDER)
      row[key] = percentile(
        trials.map((trial) => trial.monthly[month][key]),
        0.5,
      );
    row.chain = PHASE_ORDER.reduce((sum, key) => sum + row[key], 0);
    return row;
  });

  const chainValues = trials.map((trial) => trial.chainEconomicProfit);
  const chainEconomicProfit = PHASE_ORDER.reduce(
    (sum, key) => sum + phases[key].economicProfit,
    0,
  );
  const chainOperatingContribution = PHASE_ORDER.reduce(
    (sum, key) => sum + phases[key].operatingContribution,
    0,
  );
  const completedHead = percentile(
    trials.map((trial) => trial.completedHead),
    0.5,
  );
  const mortalityHead = percentile(
    trials.map((trial) => trial.mortalityHead),
    0.5,
  );
  const endingInventoryHead = Math.max(
    0,
    input.totalHead - completedHead - mortalityHead,
  );
  const retailPounds = percentile(
    trials.map((trial) => trial.retailPounds),
    0.5,
  );
  const fedCwt = percentile(
    trials.map((trial) => trial.fedLiveCwtSold),
    0.5,
  );
  const medianSales: RetailSales = {
    revenue: percentile(
      trials.map((trial) => trial.retailSales.revenue),
      0.5,
    ),
    beefCost: percentile(
      trials.map((trial) => trial.retailSales.beefCost),
      0.5,
    ),
    storeCost: percentile(
      trials.map((trial) => trial.retailSales.storeCost),
      0.5,
    ),
  };
  const medianGrades = splitRetailByGrade(
    input,
    phases.retail,
    retailPounds,
    medianSales,
  );
  const trialGrades = trials.map((trial) =>
    splitRetailByGrade(
      input,
      trial.phases.retail,
      trial.retailPounds,
      trial.retailSales,
    ),
  );
  const retailByGrade = Object.fromEntries(
    GRADES.map((key) => {
      const grade = medianGrades[key];
      const profits = trialGrades.map((split) => split[key].profit);
      return [
        key,
        {
          key,
          share: input.gradeMix[key],
          priceIndex: gradePriceIndex(input, key),
          ...grade,
          p10Profit: percentile(profits, 0.1),
          p90Profit: percentile(profits, 0.9),
        },
      ];
    }),
  ) as Record<GradeKey, GradeResult>;
  const sensitivity = buildSensitivity(input);
  const sensitivityBase = simulateTrial(
    { ...input, trials: 1 },
    0,
    true,
  ).chainEconomicProfit;

  return {
    scenario: input,
    dataVintage: historicalDataVintage(input.referenceYear),
    phases,
    monthly,
    sensitivity,
    sensitivityBase,
    totalStartedHead: input.totalHead,
    completedHead,
    mortalityHead,
    endingInventoryHead,
    retailPounds,
    retailByGrade,
    chainEconomicProfit,
    chainOperatingContribution,
    chainP10: percentile(chainValues, 0.1),
    chainP90: percentile(chainValues, 0.9),
    chainProbabilityOfLoss:
      chainValues.filter((value) => value < 0).length / chainValues.length,
    // Expressed as the Choice retail price; each pound sells at Choice x the
    // mix-weighted grade index.
    breakEvenRetailPricePerLb: Math.max(
      0,
      input.retailPricePerLb -
        chainEconomicProfit /
          Math.max(retailPounds * blendedGradeIndex(input), 1),
    ),
    breakEvenFedPricePerCwt: Math.max(
      0,
      input.fedPricePerCwt -
        phases.feedlot.economicProfit / Math.max(fedCwt, 1),
    ),
    reconciliationDifference:
      input.totalHead - completedHead - mortalityHead - endingInventoryHead,
    runtimeMs,
  };
}

function buildSensitivity(input: ScenarioInput): SensitivityResult[] {
  const drivers: Array<{
    key: string;
    label: string;
    apply: (scenario: ScenarioInput, factor: number) => void;
  }> = [
    {
      key: 'retailPrice',
      label: 'Retail beef price',
      apply: (scenario, factor) => {
        scenario.retailPricePerLb *= factor;
      },
    },
    {
      key: 'wholesalePrice',
      label: 'Wholesale beef price',
      apply: (scenario, factor) => {
        scenario.wholesalePricePerLb *= factor;
      },
    },
    {
      key: 'fedPrice',
      label: 'Fed cattle price',
      apply: (scenario, factor) => {
        scenario.fedPricePerCwt *= factor;
      },
    },
    {
      key: 'feederPrice',
      label: 'Feeder cattle price',
      apply: (scenario, factor) => {
        scenario.feederPricePerCwt *= factor;
      },
    },
    {
      key: 'calfPrice',
      label: 'Weaned calf price',
      apply: (scenario, factor) => {
        scenario.calfPricePerCwt *= factor;
      },
    },
    {
      key: 'feedCost',
      label: 'Feed cost',
      apply: (scenario, factor) => {
        scenario.feedCostPerTon *= factor;
      },
    },
    {
      key: 'yield',
      label: 'Saleable yield',
      apply: (scenario, factor) => {
        scenario.saleableYield = clamp(
          scenario.saleableYield * factor,
          0.4,
          0.85,
        );
      },
    },
  ];
  return drivers
    .map((driver) => {
      const low = structuredClone(input);
      const high = structuredClone(input);
      driver.apply(low, 0.9);
      driver.apply(high, 1.1);
      const lowProfit = simulateTrial(
        { ...low, trials: 1 },
        0,
        true,
      ).chainEconomicProfit;
      const highProfit = simulateTrial(
        { ...high, trials: 1 },
        0,
        true,
      ).chainEconomicProfit;
      return {
        key: driver.key,
        label: driver.label,
        lowEconomicProfit: lowProfit,
        highEconomicProfit: highProfit,
        swing: Math.abs(highProfit - lowProfit) / 2,
      };
    })
    .sort((a, b) => b.swing - a.swing);
}

export function runSimulation(
  input: ScenarioInput,
  onProgress?: (progress: SimulationProgress) => void,
): SimulationSummary {
  const errors = validateScenario(input);
  if (errors.length) throw new Error(errors.join(' '));
  const startedAt = performance.now();
  const trials: TrialResult[] = [];
  for (let trial = 0; trial < input.trials; trial += 1) {
    trials.push(simulateTrial(input, trial));
    if (onProgress && (trial % 10 === 0 || trial === input.trials - 1)) {
      onProgress({ completed: trial + 1, total: input.trials });
    }
  }
  trials.sort((a, b) => a.chainEconomicProfit - b.chainEconomicProfit);
  return aggregate(input, trials, performance.now() - startedAt);
}
