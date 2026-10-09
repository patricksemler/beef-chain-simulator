/**
 * # Types
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
 * - `PhaseKey`: the main thing this file provides to the app.
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
export type PhaseKey = 'cowCalf' | 'stocker' | 'feedlot' | 'packer' | 'retail';

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
