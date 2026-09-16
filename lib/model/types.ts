export type PhaseKey = 'cowCalf' | 'stocker' | 'feedlot' | 'downstream';

export type EntryCadence =
  | 'even'
  | 'upfront'
  | 'spring'
  | 'fall'
  | 'custom';

export interface PhaseAssumptions {
  label: string;
  durationDays: number;
  averageDailyGain: number;
  mortalityRate: number;
  directCostPerHead: number;
  dailyCostPerHead: number;
  economicCostPerHead: number;
}

export interface MarketRisk {
  calfVolatility: number;
  feederVolatility: number;
  fedVolatility: number;
  retailVolatility: number;
  feedVolatility: number;
  commonMarketCorrelation: number;
}

export interface ScenarioInput {
  referenceYear: number;
  totalHead: number;
  horizonMonths: number;
  cadence: EntryCadence;
  customCadence: number[];
  seed: number;
  trials: number;
  biologicalVariation: number;
  startWeight: number;
  calfPricePerCwt: number;
  feederPricePerCwt: number;
  fedPricePerCwt: number;
  retailPricePerLb: number;
  feedCostPerTon: number;
  byproductCreditPerHead: number;
  dressingPercentage: number;
  saleableYield: number;
  feedDryMatterLbPerDay: number;
  annualCattlePriceTrend: number;
  annualRetailPriceTrend: number;
  annualFeedCostTrend: number;
  phases: Record<PhaseKey, PhaseAssumptions>;
  marketRisk: MarketRisk;
}

export interface PhaseResult {
  key: PhaseKey;
  label: string;
  enteredHead: number;
  exitedHead: number;
  mortalityHead: number;
  endingInventoryHead: number;
  revenue: number;
  terminalInventoryValue: number;
  acquisitionCost: number;
  directCosts: number;
  economicCosts: number;
  operatingContribution: number;
  economicProfit: number;
  economicProfitPerStartedHead: number;
  economicProfitPerExitedHead: number;
  margin: number;
  p10EconomicProfit: number;
  p90EconomicProfit: number;
  probabilityOfLoss: number;
  averageExitWeight: number;
}

export interface MonthlyResult {
  month: number;
  cowCalf: number;
  stocker: number;
  feedlot: number;
  downstream: number;
  chain: number;
}

export interface SensitivityResult {
  key: string;
  label: string;
  lowEconomicProfit: number;
  highEconomicProfit: number;
  swing: number;
}

export interface SimulationSummary {
  scenario: ScenarioInput;
  dataVintage: string;
  phases: Record<PhaseKey, PhaseResult>;
  monthly: MonthlyResult[];
  sensitivity: SensitivityResult[];
  /** Deterministic base-case chain profit the sensitivity swings are measured against. */
  sensitivityBase: number;
  totalStartedHead: number;
  completedHead: number;
  mortalityHead: number;
  endingInventoryHead: number;
  retailPounds: number;
  chainEconomicProfit: number;
  chainOperatingContribution: number;
  chainP10: number;
  chainP90: number;
  chainProbabilityOfLoss: number;
  breakEvenRetailPricePerLb: number;
  breakEvenFedPricePerCwt: number;
  reconciliationDifference: number;
  runtimeMs: number;
}

export interface SimulationProgress {
  completed: number;
  total: number;
}
