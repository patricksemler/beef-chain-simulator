export type PhaseKey = 'cowCalf' | 'stocker' | 'feedlot' | 'packer' | 'retail';

export type GradeKey = 'prime' | 'choice' | 'select';

/** Share of saleable beef in each USDA quality grade; shares sum to 1. */
export type GradeMix = Record<GradeKey, number>;

/** Prime and Select prices as a multiple of the Choice price (Choice = 1). */
export type GradePriceIndex = Record<Exclude<GradeKey, 'choice'>, number>;

export type EntryCadence = 'even' | 'upfront' | 'spring' | 'fall' | 'custom';

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
  wholesaleVolatility: number;
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
  wholesalePricePerLb: number;
  retailPricePerLb: number;
  feedCostPerTon: number;
  byproductCreditPerHead: number;
  dressingPercentage: number;
  saleableYield: number;
  feedDryMatterLbPerDay: number;
  gradeMix: GradeMix;
  gradePriceIndex: GradePriceIndex;
  annualCattlePriceTrend: number;
  annualWholesalePriceTrend: number;
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
  packer: number;
  retail: number;
  chain: number;
}

export interface GradeResult {
  key: GradeKey;
  share: number;
  priceIndex: number;
  pounds: number;
  revenue: number;
  beefCost: number;
  storeCost: number;
  profit: number;
  /** Per-pound figures cover beef sold; the totals above also include beef on hand. */
  pricePerLb: number;
  beefCostPerLb: number;
  storeCostPerLb: number;
  profitPerLb: number;
  p10Profit: number;
  p90Profit: number;
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
  /** Retail stage profit split across USDA quality grades. */
  retailByGrade: Record<GradeKey, GradeResult>;
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
