/**
 * # Historical
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
 * - `isHistoricalYear`: the main thing this file provides to the app.
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
import historicalData from '@/lib/data/historical-scenarios.json';
import type { PhaseKey, ScenarioInput } from './types';

const PHASE_KEYS: PhaseKey[] = [
  'cowCalf',
  'stocker',
  'feedlot',
  'packer',
  'retail',
];

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
  next.wholesalePricePerLb = profile.wholesalePricePerLb;
  next.retailPricePerLb = profile.retailPricePerLb;
  next.feedCostPerTon = profile.feedCostPerTon;
  next.byproductCreditPerHead = profile.byproductCreditPerHead;
  next.dressingPercentage = profile.dressingPercentage;
  for (const phase of PHASE_KEYS) {
    next.phases[phase] = { ...next.phases[phase], ...profile.phases[phase] };
  }
  return next;
}
