import { DATA_VINTAGE } from './defaults';
import type {
  EntryCadence,
  MonthlyResult,
  PhaseKey,
  PhaseResult,
  ScenarioInput,
  SensitivityResult,
  SimulationProgress,
  SimulationSummary,
} from './types';

const PHASES: PhaseKey[] = ['cowCalf', 'stocker', 'feedlot', 'downstream'];
const MONTH_DAYS = 30.4375;

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
  chainEconomicProfit: number;
  chainOperatingContribution: number;
  fedLiveCwtSold: number;
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

export function validateScenario(input: ScenarioInput) {
  const errors: string[] = [];
  if (!Number.isInteger(input.totalHead) || input.totalHead < 1 || input.totalHead > 30_000_000) {
    errors.push('Head count must be a whole number from 1 to 30,000,000.');
  }
  if (!Number.isInteger(input.horizonMonths) || input.horizonMonths < 12 || input.horizonMonths > 120) {
    errors.push('Horizon must be between 12 and 120 months.');
  }
  if (!Number.isInteger(input.trials) || input.trials < 1 || input.trials > 500) {
    errors.push('Trials must be between 1 and 500.');
  }
  if (input.biologicalVariation < 0 || input.biologicalVariation > 1) {
    errors.push('Biological variation must be between 0% and 100%.');
  }
  if (input.customCadence.length !== 12 || input.customCadence.some((value) => value < 0)) {
    errors.push('Custom cadence must contain 12 non-negative monthly weights.');
  }
  if (input.cadence === 'custom' && input.customCadence.every((value) => value === 0)) {
    errors.push('At least one custom cadence month must be greater than zero.');
  }
  for (const key of PHASES) {
    const phase = input.phases[key];
    if (phase.durationDays < 0 || phase.averageDailyGain < 0) errors.push(`${phase.label} timing values cannot be negative.`);
    if (phase.mortalityRate < 0 || phase.mortalityRate > 1) errors.push(`${phase.label} mortality must be between 0% and 100%.`);
  }
  return errors;
}

function cadenceWeights(cadence: EntryCadence, custom: number[]) {
  if (cadence === 'upfront') return [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  if (cadence === 'spring') return [0.5, 0.85, 1.5, 1.9, 1.6, 1, 0.55, 0.35, 0.3, 0.3, 0.3, 0.4];
  if (cadence === 'fall') return [0.35, 0.3, 0.3, 0.35, 0.45, 0.6, 0.8, 1.15, 1.7, 1.9, 1.45, 0.85];
  if (cadence === 'custom') return custom;
  return Array(12).fill(1);
}

export function allocateEntryMonths(input: Pick<ScenarioInput, 'totalHead' | 'horizonMonths' | 'cadence' | 'customCadence'>) {
  const weights = cadenceWeights(input.cadence, input.customCadence);
  const monthWeights = Array.from({ length: input.horizonMonths }, (_, month) =>
    input.cadence === 'upfront' ? (month === 0 ? 1 : 0) : weights[month % 12],
  );
  const totalWeight = monthWeights.reduce((sum, value) => sum + value, 0);
  const raw = monthWeights.map((value) => (value / totalWeight) * input.totalHead);
  const allocated = raw.map(Math.floor);
  const remaining = input.totalHead - allocated.reduce((sum, value) => sum + value, 0);
  const remainderOrder = raw
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction);
  for (let i = 0; i < remaining; i += 1) allocated[remainderOrder[i % remainderOrder.length].index] += 1;
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

function simulateTrial(input: ScenarioInput, trialIndex: number, deterministic = false): TrialResult {
  const random = mulberry32(input.seed + trialIndex * 7_919);
  const agentCount = Math.min(input.totalHead, 2_500);
  const entryAllocation = allocateEntryMonths(input);
  const entryCumulative: number[] = [];
  let running = 0;
  for (const value of entryAllocation) {
    running += value;
    entryCumulative.push(running);
  }
  const phases = Object.fromEntries(PHASES.map((key) => [key, emptyLedger(key, input.phases[key].label)])) as Record<PhaseKey, Ledger>;
  const monthly = Array.from({ length: input.horizonMonths }, (_, index) => ({
    month: index + 1,
    cowCalf: 0,
    stocker: 0,
    feedlot: 0,
    downstream: 0,
    chain: 0,
  }));
  const common = deterministic ? 0 : normal(random);
  const rho = clamp(input.marketRisk.commonMarketCorrelation, 0, 0.95);
  const linkedShock = (volatility: number) =>
    deterministic ? 1 : Math.exp(volatility * (rho * common + Math.sqrt(1 - rho * rho) * normal(random)) - 0.5 * volatility * volatility);
  const calfShock = linkedShock(input.marketRisk.calfVolatility);
  const feederShock = linkedShock(input.marketRisk.feederVolatility);
  const fedShock = linkedShock(input.marketRisk.fedVolatility);
  const retailShock = linkedShock(input.marketRisk.retailVolatility);
  const feedShock = deterministic
    ? 1
    : Math.exp(input.marketRisk.feedVolatility * (-0.2 * common + Math.sqrt(0.96) * normal(random)) - 0.5 * input.marketRisk.feedVolatility ** 2);

  let completedHead = 0;
  let mortalityHead = 0;
  let endingInventoryHead = 0;
  let retailPounds = 0;
  let fedLiveCwtSold = 0;

  for (let agent = 0; agent < agentCount; agent += 1) {
    const agentStart = (agent / agentCount) * input.totalHead;
    const nextAgentStart = ((agent + 1) / agentCount) * input.totalHead;
    const weight = nextAgentStart - agentStart;
    const targetHead = (agent + 0.5) * weight;
    const entryMonth = entryCumulative.findIndex((value) => targetHead < value);
    let currentMonth = Math.max(0, entryMonth);
    let liveWeight = input.startWeight * (deterministic ? 1 : clamp(1 + normal(random) * input.biologicalVariation * 0.85, 0.8, 1.2));
    let acquisitionValue = 0;
    let isFinished = false;
    let isDead = false;

    for (const key of PHASES) {
      const phase = input.phases[key];
      const ledger = phases[key];
      if (currentMonth >= input.horizonMonths || isDead || isFinished) break;
      ledger.enteredHead += weight;
      ledger.acquisitionCost += acquisitionValue * weight;

      const durationFactor = deterministic ? 1 : clamp(1 + normal(random) * input.biologicalVariation, 0.78, 1.22);
      const durationDays = Math.max(0, phase.durationDays * durationFactor);
      const durationMonths = durationDays / MONTH_DAYS;
      const availableMonths = input.horizonMonths - currentMonth;
      const completionRatio = clamp(availableMonths / Math.max(durationMonths, 0.001), 0, 1);
      const daysInPhase = durationDays * completionRatio;
      const gainFactor = deterministic ? 1 : clamp(1 + normal(random) * input.biologicalVariation * 0.7, 0.82, 1.18);
      const exitWeight = liveWeight + phase.averageDailyGain * daysInPhase * gainFactor;
      const stageDirectCost = phase.directCostPerHead * completionRatio + phase.dailyCostPerHead * daysInPhase;
      const feedCost = key === 'feedlot'
        ? (input.feedDryMatterLbPerDay * daysInPhase * trend(input.feedCostPerTon, input.annualFeedCostTrend, currentMonth) * feedShock) / 2_000
        : 0;
      ledger.directCosts += (stageDirectCost + feedCost) * weight;
      ledger.economicCosts += phase.economicCostPerHead * completionRatio * weight;

      const completedPhase = completionRatio >= 0.999999;
      if (!completedPhase) {
        const phasePrice = key === 'cowCalf'
          ? input.calfPricePerCwt * calfShock
          : key === 'stocker'
            ? input.feederPricePerCwt * feederShock
            : input.fedPricePerCwt * fedShock;
        const terminalValue = key === 'downstream'
          ? exitWeight * input.dressingPercentage * input.saleableYield * input.retailPricePerLb * retailShock + input.byproductCreditPerHead
          : (exitWeight / 100) * phasePrice;
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
      const resultMonth = clamp(Math.floor(currentMonth), 0, input.horizonMonths - 1);
      ledger.exitedHead += weight;
      ledger.averageExitWeight += exitWeight * weight;

      let saleValue = 0;
      if (key === 'cowCalf') {
        saleValue = (exitWeight / 100) * trend(input.calfPricePerCwt, input.annualCattlePriceTrend, currentMonth) * calfShock;
      } else if (key === 'stocker') {
        saleValue = (exitWeight / 100) * trend(input.feederPricePerCwt, input.annualCattlePriceTrend, currentMonth) * feederShock;
      } else if (key === 'feedlot') {
        saleValue = (exitWeight / 100) * trend(input.fedPricePerCwt, input.annualCattlePriceTrend, currentMonth) * fedShock;
        fedLiveCwtSold += (exitWeight / 100) * weight;
      } else {
        const pounds = exitWeight * input.dressingPercentage * input.saleableYield;
        saleValue = pounds * trend(input.retailPricePerLb, input.annualRetailPriceTrend, currentMonth) * retailShock + input.byproductCreditPerHead;
        const retailCost = pounds * 1.55;
        ledger.directCosts += retailCost * weight;
        retailPounds += pounds * weight;
        completedHead += weight;
        isFinished = true;
      }
      ledger.revenue += saleValue * weight;
      acquisitionValue = saleValue;
      liveWeight = exitWeight;
      const contribution = saleValue * weight;
      monthly[resultMonth][key] += contribution;
    }
  }

  for (const key of PHASES) {
    const ledger = phases[key];
    ledger.operatingContribution = ledger.revenue + ledger.terminalInventoryValue - ledger.acquisitionCost - ledger.directCosts;
    ledger.economicProfit = ledger.operatingContribution - ledger.economicCosts;
    ledger.averageExitWeight = ledger.exitedHead > 0 ? ledger.averageExitWeight / ledger.exitedHead : 0;
  }

  const chainEconomicProfit = PHASES.reduce((sum, key) => sum + phases[key].economicProfit, 0);
  const chainOperatingContribution = PHASES.reduce((sum, key) => sum + phases[key].operatingContribution, 0);
  for (const key of PHASES) {
    const activity = monthly.reduce((sum, month) => sum + month[key], 0);
    if (activity > 0) {
      for (const month of monthly) month[key] = phases[key].economicProfit * (month[key] / activity);
    } else {
      monthly[monthly.length - 1][key] = phases[key].economicProfit;
    }
  }
  for (const month of monthly) {
    month.chain = PHASES.reduce((sum, key) => sum + month[key], 0);
  }

  return {
    phases,
    monthly,
    completedHead,
    mortalityHead,
    endingInventoryHead,
    retailPounds,
    chainEconomicProfit,
    chainOperatingContribution,
    fedLiveCwtSold,
  };
}

function aggregate(input: ScenarioInput, trials: TrialResult[], runtimeMs: number): SimulationSummary {
  const medianTrial = trials[Math.floor(trials.length / 2)];
  const phases = {} as Record<PhaseKey, PhaseResult>;
  for (const key of PHASES) {
    const economicProfits = trials.map((trial) => trial.phases[key].economicProfit);
    const base = medianTrial.phases[key];
    const medianRevenue = percentile(trials.map((trial) => trial.phases[key].revenue), 0.5);
    const medianTerminalValue = percentile(trials.map((trial) => trial.phases[key].terminalInventoryValue), 0.5);
    const medianAcquisitionCost = percentile(trials.map((trial) => trial.phases[key].acquisitionCost), 0.5);
    const medianDirectCosts = percentile(trials.map((trial) => trial.phases[key].directCosts), 0.5);
    const medianEconomicCosts = percentile(trials.map((trial) => trial.phases[key].economicCosts), 0.5);
    const operatingContribution = medianRevenue + medianTerminalValue - medianAcquisitionCost - medianDirectCosts;
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
      enteredHead: percentile(trials.map((trial) => trial.phases[key].enteredHead), 0.5),
      exitedHead: percentile(trials.map((trial) => trial.phases[key].exitedHead), 0.5),
      mortalityHead: percentile(trials.map((trial) => trial.phases[key].mortalityHead), 0.5),
      endingInventoryHead: percentile(trials.map((trial) => trial.phases[key].endingInventoryHead), 0.5),
      averageExitWeight: percentile(trials.map((trial) => trial.phases[key].averageExitWeight), 0.5),
      economicProfitPerStartedHead: economicProfit / input.totalHead,
      economicProfitPerExitedHead: economicProfit / Math.max(base.exitedHead, 1),
      margin: economicProfit / Math.max(base.revenue + base.terminalInventoryValue, 1),
      p10EconomicProfit: percentile(economicProfits, 0.1),
      p90EconomicProfit: percentile(economicProfits, 0.9),
      probabilityOfLoss: economicProfits.filter((value) => value < 0).length / economicProfits.length,
    };
  }

  const monthly = Array.from({ length: input.horizonMonths }, (_, month) => {
    const row = { month: month + 1, cowCalf: 0, stocker: 0, feedlot: 0, downstream: 0, chain: 0 };
    for (const key of PHASES) row[key] = percentile(trials.map((trial) => trial.monthly[month][key]), 0.5);
    row.chain = PHASES.reduce((sum, key) => sum + row[key], 0);
    return row;
  });

  const chainValues = trials.map((trial) => trial.chainEconomicProfit);
  const chainEconomicProfit = PHASES.reduce((sum, key) => sum + phases[key].economicProfit, 0);
  const chainOperatingContribution = PHASES.reduce((sum, key) => sum + phases[key].operatingContribution, 0);
  const completedHead = percentile(trials.map((trial) => trial.completedHead), 0.5);
  const mortalityHead = percentile(trials.map((trial) => trial.mortalityHead), 0.5);
  const endingInventoryHead = Math.max(0, input.totalHead - completedHead - mortalityHead);
  const retailPounds = percentile(trials.map((trial) => trial.retailPounds), 0.5);
  const fedCwt = percentile(trials.map((trial) => trial.fedLiveCwtSold), 0.5);
  const sensitivity = buildSensitivity(input);
  const sensitivityBase = simulateTrial({ ...input, trials: 1 }, 0, true).chainEconomicProfit;

  return {
    scenario: input,
    dataVintage: DATA_VINTAGE,
    phases,
    monthly,
    sensitivity,
    sensitivityBase,
    totalStartedHead: input.totalHead,
    completedHead,
    mortalityHead,
    endingInventoryHead,
    retailPounds,
    chainEconomicProfit,
    chainOperatingContribution,
    chainP10: percentile(chainValues, 0.1),
    chainP90: percentile(chainValues, 0.9),
    chainProbabilityOfLoss: chainValues.filter((value) => value < 0).length / chainValues.length,
    breakEvenRetailPricePerLb: Math.max(0, input.retailPricePerLb - chainEconomicProfit / Math.max(retailPounds, 1)),
    breakEvenFedPricePerCwt: Math.max(0, input.fedPricePerCwt - phases.feedlot.economicProfit / Math.max(fedCwt, 1)),
    reconciliationDifference: input.totalHead - completedHead - mortalityHead - endingInventoryHead,
    runtimeMs,
  };
}

function buildSensitivity(input: ScenarioInput): SensitivityResult[] {
  const drivers: Array<{ key: string; label: string; apply: (scenario: ScenarioInput, factor: number) => void }> = [
    { key: 'retailPrice', label: 'Retail beef price', apply: (scenario, factor) => { scenario.retailPricePerLb *= factor; } },
    { key: 'fedPrice', label: 'Fed cattle price', apply: (scenario, factor) => { scenario.fedPricePerCwt *= factor; } },
    { key: 'feederPrice', label: 'Feeder cattle price', apply: (scenario, factor) => { scenario.feederPricePerCwt *= factor; } },
    { key: 'calfPrice', label: 'Weaned calf price', apply: (scenario, factor) => { scenario.calfPricePerCwt *= factor; } },
    { key: 'feedCost', label: 'Feed cost', apply: (scenario, factor) => { scenario.feedCostPerTon *= factor; } },
    { key: 'yield', label: 'Saleable yield', apply: (scenario, factor) => { scenario.saleableYield = clamp(scenario.saleableYield * factor, 0.4, 0.85); } },
  ];
  return drivers.map((driver) => {
    const low = structuredClone(input);
    const high = structuredClone(input);
    driver.apply(low, 0.9);
    driver.apply(high, 1.1);
    const lowProfit = simulateTrial({ ...low, trials: 1 }, 0, true).chainEconomicProfit;
    const highProfit = simulateTrial({ ...high, trials: 1 }, 0, true).chainEconomicProfit;
    return {
      key: driver.key,
      label: driver.label,
      lowEconomicProfit: lowProfit,
      highEconomicProfit: highProfit,
      swing: Math.abs(highProfit - lowProfit) / 2,
    };
  }).sort((a, b) => b.swing - a.swing);
}

export function runSimulation(input: ScenarioInput, onProgress?: (progress: SimulationProgress) => void): SimulationSummary {
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
