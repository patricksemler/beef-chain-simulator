import historicalData from '@/lib/data/historical-scenarios.json';
import type { PhaseKey, ScenarioInput } from './types';

const PHASE_KEYS: PhaseKey[] = ['cowCalf', 'stocker', 'feedlot', 'downstream'];

export type HistoricalYear =
  keyof typeof historicalData.years extends `${infer Year extends number}`
    ? Year
    : never;

export const AVAILABLE_HISTORICAL_YEARS =
  historicalData.availableYears as HistoricalYear[];
export const LATEST_HISTORICAL_YEAR =
  historicalData.latestYear as HistoricalYear;
export const HISTORICAL_DATA_GENERATED_AT = historicalData.generatedAt;
export const HISTORICAL_METHODOLOGY = historicalData.methodology;

export function isHistoricalYear(year: number): year is HistoricalYear {
  return AVAILABLE_HISTORICAL_YEARS.includes(year as HistoricalYear);
}

export function historicalDataVintage(year: number) {
  return `Based on ${year} USDA annual averages`;
}

export function getHistoricalProfile(year: HistoricalYear) {
  return historicalData.years[
    String(year) as keyof typeof historicalData.years
  ];
}

/**
 * Loads only data-backed assumptions. User-owned scenario choices such as head
 * count, time horizon, entry cadence, risk, biology, and random seed remain intact.
 */
export function applyHistoricalYear(
  scenario: ScenarioInput,
  year: HistoricalYear,
): ScenarioInput {
  const profile = getHistoricalProfile(year);
  const next = structuredClone(scenario);
  next.referenceYear = year;
  next.calfPricePerCwt = profile.calfPricePerCwt;
  next.feederPricePerCwt = profile.feederPricePerCwt;
  next.fedPricePerCwt = profile.fedPricePerCwt;
  next.retailPricePerLb = profile.retailPricePerLb;
  next.feedCostPerTon = profile.feedCostPerTon;
  next.byproductCreditPerHead = profile.byproductCreditPerHead;
  next.dressingPercentage = profile.dressingPercentage;
  for (const phase of PHASE_KEYS) {
    next.phases[phase] = { ...next.phases[phase], ...profile.phases[phase] };
  }
  return next;
}
