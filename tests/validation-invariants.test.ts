/**
 * # Validation.Invariants.Test
 *
 * ## What this file is for
 * Property-style tests: rules that must hold for any valid scenario, checked
 * across many randomly drawn scenarios. A fixed generator seed draws the same
 * scenarios on every run, so a failure can always be reproduced.
 */
import { describe, expect, it } from 'vitest';
import {
  AVAILABLE_HISTORICAL_YEARS,
  applyHistoricalYear,
} from '../lib/model/historical';
import { PHASE_ORDER } from '../lib/model/phases';
import { runSimulation, validateScenario } from '../lib/model/simulate';
import type { EntryCadence, ScenarioInput } from '../lib/model/types';
import { cohortScenario, seededRandom } from './validation-helpers';

const SCENARIO_COUNT = 60;
const CADENCES: EntryCadence[] = ['even', 'upfront', 'spring', 'fall', 'custom'];

function randomScenario(random: () => number): ScenarioInput {
  const between = (low: number, high: number) => low + (high - low) * random();
  const pick = <T>(values: readonly T[]) =>
    values[Math.floor(random() * values.length)];
  const scenario = applyHistoricalYear(
    cohortScenario(),
    pick(AVAILABLE_HISTORICAL_YEARS),
  );
  scenario.totalHead = Math.max(1, Math.round(10 ** between(0, 7)));
  scenario.horizonMonths = Math.round(between(12, 120));
  scenario.cadence = pick(CADENCES);
  scenario.customCadence = Array.from({ length: 12 }, () =>
    random() < 0.4 ? 0 : between(0, 3),
  );
  scenario.customCadence[Math.floor(random() * 12)] = 1;
  scenario.seed = Math.floor(between(0, 1_000_000));
  scenario.trials = 1 + Math.floor(between(0, 8));
  scenario.biologicalVariation = between(0, 0.3);
  scenario.retailPricePerLb *= between(0.5, 1.5);
  scenario.fedPricePerCwt *= between(0.5, 1.5);
  scenario.feedCostPerTon *= between(0.5, 2);
  scenario.saleableYield = between(0.55, 0.8);
  for (const phase of Object.values(scenario.phases)) {
    phase.durationDays *= between(0.5, 1.5);
    phase.mortalityRate = random() < 0.1 ? 1 : between(0, 0.1);
  }
  scenario.marketRisk.commonMarketCorrelation = between(0, 0.95);
  for (const key of Object.keys(scenario.marketRisk) as Array<
    keyof ScenarioInput['marketRisk']
  >)
    if (key !== 'commonMarketCorrelation')
      scenario.marketRisk[key] *= between(0, 2);
  return scenario;
}

function drawScenarios(seed: number) {
  const random = seededRandom(seed);
  return Array.from({ length: SCENARIO_COUNT }, () => randomScenario(random));
}

describe(`invariants over ${SCENARIO_COUNT} random scenarios`, () => {
  const scenarios = drawScenarios(20_251_002);

  it('draws only scenarios the engine accepts', () => {
    for (const scenario of scenarios) expect(validateScenario(scenario)).toEqual([]);
  });

  it('never reports negative quantities, weights, revenues, or costs', () => {
    for (const scenario of scenarios) {
      const result = runSimulation(scenario);
      for (const value of [
        result.completedHead,
        result.mortalityHead,
        result.endingInventoryHead,
        result.retailPounds,
        result.breakEvenRetailPricePerLb,
        result.breakEvenFedPricePerCwt,
      ])
        expect(value).toBeGreaterThanOrEqual(0);
      for (const key of PHASE_ORDER) {
        const phase = result.phases[key];
        for (const value of [
          phase.enteredHead,
          phase.exitedHead,
          phase.mortalityHead,
          phase.endingInventoryHead,
          phase.revenue,
          phase.terminalInventoryValue,
          phase.acquisitionCost,
          phase.directCosts,
          phase.economicCosts,
          phase.averageExitWeight,
        ])
          expect(value).toBeGreaterThanOrEqual(0);
      }
      for (const grade of Object.values(result.retailByGrade))
        expect(grade.pounds).toBeGreaterThanOrEqual(0);
    }
  });

  it('returns finite numbers for every reported value', () => {
    for (const scenario of scenarios) {
      const result = runSimulation(scenario);
      const numbers = [
        result.chainEconomicProfit,
        result.chainOperatingContribution,
        result.chainP10,
        result.chainP90,
        result.chainProbabilityOfLoss,
        result.breakEvenRetailPricePerLb,
        result.breakEvenFedPricePerCwt,
        result.sensitivityBase,
        ...result.sensitivity.map((driver) => driver.swing),
        ...result.monthly.map((month) => month.chain),
        ...PHASE_ORDER.flatMap((key) => Object.values(result.phases[key])),
      ].filter((value): value is number => typeof value === 'number');
      for (const value of numbers) expect(Number.isFinite(value)).toBe(true);
    }
  });

  it('conserves head: completed + died + ending inventory equals head started', () => {
    for (const scenario of scenarios) {
      const result = runSimulation(scenario);
      expect(
        result.completedHead + result.mortalityHead + result.endingInventoryHead,
      ).toBeCloseTo(scenario.totalHead, 4);
      expect(result.completedHead).toBeLessThanOrEqual(scenario.totalHead + 1e-6);
    }
  });

  it('balances every stage ledger exactly in single-trial runs', () => {
    for (const scenario of scenarios) {
      const result = runSimulation({ ...scenario, trials: 1 });
      for (const key of PHASE_ORDER) {
        const phase = result.phases[key];
        expect(phase.enteredHead).toBeCloseTo(
          phase.exitedHead + phase.mortalityHead + phase.endingInventoryHead,
          4,
        );
      }
      for (let index = 1; index < PHASE_ORDER.length; index += 1)
        expect(result.phases[PHASE_ORDER[index]].enteredHead).toBeCloseTo(
          result.phases[PHASE_ORDER[index - 1]].exitedHead,
          4,
        );
    }
  });

  it('makes segment profits sum to chain profit and orders the percentiles', () => {
    for (const scenario of scenarios) {
      const result = runSimulation(scenario);
      const scale = Math.max(1, Math.abs(result.chainEconomicProfit));
      const segments = PHASE_ORDER.reduce(
        (sum, key) => sum + result.phases[key].economicProfit,
        0,
      );
      expect(Math.abs(segments - result.chainEconomicProfit) / scale).toBeLessThan(
        1e-9,
      );
      expect(result.chainP10).toBeLessThanOrEqual(result.chainP90);
      expect(result.chainProbabilityOfLoss).toBeGreaterThanOrEqual(0);
      expect(result.chainProbabilityOfLoss).toBeLessThanOrEqual(1);
      for (const key of PHASE_ORDER)
        expect(result.phases[key].p10EconomicProfit).toBeLessThanOrEqual(
          result.phases[key].p90EconomicProfit,
        );
    }
  });

  it('keeps the monthly profit series consistent with the stage totals', () => {
    for (const scenario of scenarios) {
      const result = runSimulation({ ...scenario, trials: 1 });
      expect(result.monthly).toHaveLength(scenario.horizonMonths);
      for (const key of PHASE_ORDER) {
        const total = result.monthly.reduce((sum, month) => sum + month[key], 0);
        const scale = Math.max(1, Math.abs(result.phases[key].economicProfit));
        expect(
          Math.abs(total - result.phases[key].economicProfit) / scale,
        ).toBeLessThan(1e-9);
      }
    }
  });

  it('never lets an animal finish faster than the chain allows', () => {
    for (const scenario of scenarios) {
      const result = runSimulation(scenario);
      // Biological variation can shorten a stage to at most 78% of its mean.
      const shortestChain =
        Object.values(scenario.phases).reduce(
          (sum, phase) => sum + phase.durationDays,
          0,
        ) * 0.78;
      if (shortestChain / 30.4375 > scenario.horizonMonths)
        expect(result.completedHead).toBe(0);
    }
  });

  it('is deterministic for every drawn scenario', () => {
    for (const scenario of scenarios.slice(0, 20)) {
      const first = runSimulation(scenario);
      const second = runSimulation(structuredClone(scenario));
      expect(second.chainEconomicProfit).toBe(first.chainEconomicProfit);
      expect(second.chainP10).toBe(first.chainP10);
      expect(second.completedHead).toBe(first.completedHead);
    }
  });

  it('never changes the scenario object it is given', () => {
    for (const scenario of scenarios.slice(0, 20)) {
      const before = structuredClone(scenario);
      runSimulation(scenario);
      expect(scenario).toEqual(before);
    }
  });
});
