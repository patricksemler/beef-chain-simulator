/**
 * # Validation.Helpers
 *
 * ## What this file is for
 * Shared scenario builders for the validation test files. It is not a test
 * file itself, so Vitest does not collect it.
 *
 * ## Main pieces in this file
 * - `cohortScenario`: the paper's single-cohort design (upfront entry, every
 *   surviving animal reaches retail inside the 24-month horizon).
 * - `makeDeterministic`: turns off price shocks, biological variation, and
 *   mortality so results can be compared with hand calculations.
 * - `seededRandom`: a small seeded generator for property-style tests.
 */
import { cloneDefaultScenario } from '../lib/model/defaults';
import {
  applyHistoricalYear,
  LATEST_HISTORICAL_YEAR,
  type HistoricalYear,
} from '../lib/model/historical';
import type { ScenarioInput } from '../lib/model/types';

export const RETAIL_COST_PER_LB = 1.55;
export const MONTH_DAYS = 30.4375;

export function cohortScenario(
  year: HistoricalYear = LATEST_HISTORICAL_YEAR,
): ScenarioInput {
  const scenario = applyHistoricalYear(cloneDefaultScenario(), year);
  scenario.totalHead = 100_000;
  scenario.horizonMonths = 24;
  scenario.cadence = 'upfront';
  scenario.trials = 25;
  return scenario;
}

export function makeDeterministic(scenario: ScenarioInput): ScenarioInput {
  scenario.trials = 1;
  scenario.biologicalVariation = 0;
  for (const phase of Object.values(scenario.phases)) phase.mortalityRate = 0;
  for (const key of Object.keys(scenario.marketRisk) as Array<
    keyof ScenarioInput['marketRisk']
  >) {
    if (key !== 'commonMarketCorrelation') scenario.marketRisk[key] = 0;
  }
  return scenario;
}

export function deterministicCohort(
  year: HistoricalYear = LATEST_HISTORICAL_YEAR,
) {
  return makeDeterministic(cohortScenario(year));
}

/** Months from birth to the end of the last stage, in days per month. */
export function chainLengthMonths(scenario: ScenarioInput) {
  return (
    Object.values(scenario.phases).reduce(
      (sum, phase) => sum + phase.durationDays,
      0,
    ) / MONTH_DAYS
  );
}

/** mulberry32, so property tests draw the same scenarios on every run. */
export function seededRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}
