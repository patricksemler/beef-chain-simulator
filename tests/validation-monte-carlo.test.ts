/**
 * # Validation.Monte-Carlo.Test
 *
 * ## What this file is for
 * Checks how the Monte Carlo layer behaves with risk disabled and enabled:
 * that disabling every source of randomness collapses the distribution, that
 * each source of risk widens it in the expected place, and that results are
 * stable across seeds and trial counts.
 */
import { describe, expect, it } from 'vitest';
import { PHASE_ORDER } from '../lib/model/phases';
import { runSimulation } from '../lib/model/simulate';
import type { ScenarioInput } from '../lib/model/types';
import { cohortScenario, makeDeterministic } from './validation-helpers';

function width(p10: number, p90: number) {
  return p90 - p10;
}

function withRisk(rho: number, volatilityScale = 1, trials = 300) {
  const scenario = cohortScenario();
  scenario.trials = trials;
  scenario.marketRisk.commonMarketCorrelation = rho;
  for (const key of Object.keys(scenario.marketRisk) as Array<
    keyof ScenarioInput['marketRisk']
  >)
    if (key !== 'commonMarketCorrelation')
      scenario.marketRisk[key] *= volatilityScale;
  return runSimulation(scenario);
}

describe('risk disabled', () => {
  it('gives identical trials, so every percentile equals the median', () => {
    const scenario = makeDeterministic(cohortScenario());
    scenario.trials = 50;
    const result = runSimulation(scenario);
    expect(result.chainP10).toBeCloseTo(result.chainEconomicProfit, 4);
    expect(result.chainP90).toBeCloseTo(result.chainEconomicProfit, 4);
    for (const key of PHASE_ORDER) {
      const phase = result.phases[key];
      expect(phase.p10EconomicProfit).toBeCloseTo(phase.economicProfit, 4);
      expect(phase.p90EconomicProfit).toBeCloseTo(phase.economicProfit, 4);
      expect([0, 1]).toContain(phase.probabilityOfLoss);
    }
  });

  it('matches the deterministic base used by the sensitivity analysis', () => {
    const scenario = makeDeterministic(cohortScenario());
    scenario.trials = 20;
    const result = runSimulation(scenario);
    expect(result.chainEconomicProfit).toBeCloseTo(result.sensitivityBase, 2);
  });

  it('gives the same result for any seed', () => {
    const results = [1, 2025, 987_654].map((seed) => {
      const scenario = makeDeterministic(cohortScenario());
      scenario.seed = seed;
      return runSimulation(scenario).chainEconomicProfit;
    });
    for (const value of results) expect(value).toBeCloseTo(results[0], 4);
  });
});

describe('risk enabled', () => {
  it('spreads chain and live-cattle stage results around the median', () => {
    const result = withRisk(0.65);
    expect(result.chainP10).toBeLessThan(result.chainEconomicProfit);
    expect(result.chainEconomicProfit).toBeLessThan(result.chainP90);
    for (const key of PHASE_ORDER) {
      const phase = result.phases[key];
      expect(phase.p10EconomicProfit).toBeLessThan(phase.p90EconomicProfit);
      expect(phase.probabilityOfLoss).toBeGreaterThanOrEqual(0);
      expect(phase.probabilityOfLoss).toBeLessThanOrEqual(1);
    }
  });

  it('keeps the median close to the deterministic result because shocks have mean one', () => {
    const scenario = cohortScenario();
    scenario.trials = 500;
    scenario.biologicalVariation = 0;
    for (const phase of Object.values(scenario.phases)) phase.mortalityRate = 0;
    const result = runSimulation(scenario);
    expect(
      Math.abs(result.chainEconomicProfit / result.sensitivityBase - 1),
    ).toBeLessThan(0.03);
  });

  it('widens the chain range by about the volatility multiplier', () => {
    const base = withRisk(0.65, 1);
    const wider = withRisk(0.65, 1.5);
    const ratio =
      width(wider.chainP10, wider.chainP90) / width(base.chainP10, base.chainP90);
    expect(ratio).toBeGreaterThan(1.35);
    expect(ratio).toBeLessThan(1.65);
    expect(
      Math.abs(wider.chainEconomicProfit / base.chainEconomicProfit - 1),
    ).toBeLessThan(0.03);
  });

  it('narrows stage ranges but not the chain range as prices become correlated', () => {
    const independent = withRisk(0);
    const linked = withRisk(0.95);
    for (const key of ['stocker', 'feedlot', 'packer'] as const) {
      const before = independent.phases[key];
      const after = linked.phases[key];
      expect(
        width(after.p10EconomicProfit, after.p90EconomicProfit),
      ).toBeLessThan(
        0.6 * width(before.p10EconomicProfit, before.p90EconomicProfit),
      );
    }
    const chainRatio =
      width(linked.chainP10, linked.chainP90) /
      width(independent.chainP10, independent.chainP90);
    expect(Math.abs(chainRatio - 1)).toBeLessThan(0.15);
  });

  it('produces spread from biological variation alone when prices are fixed', () => {
    const scenario = makeDeterministic(cohortScenario());
    scenario.trials = 100;
    scenario.biologicalVariation = 0.07;
    const result = runSimulation(scenario);
    expect(result.chainP10).toBeLessThan(result.chainP90);
    expect(result.phases.feedlot.averageExitWeight).toBeGreaterThan(1_300);
    expect(result.phases.feedlot.averageExitWeight).toBeLessThan(1_500);
  });

  it('loses close to the expected share of cattle to mortality', () => {
    const scenario = cohortScenario();
    scenario.trials = 200;
    const survival = (['cowCalf', 'stocker', 'feedlot'] as const).reduce(
      (product, key) => product * (1 - scenario.phases[key].mortalityRate),
      1,
    );
    const result = runSimulation(scenario);
    expect(result.mortalityHead / scenario.totalHead).toBeCloseTo(
      1 - survival,
      2,
    );
  });
});

describe('stability', () => {
  it('reproduces every reported value for the same seed', () => {
    const scenario = cohortScenario();
    const first = runSimulation(scenario);
    const second = runSimulation(structuredClone(scenario));
    const { runtimeMs: _first, ...firstValues } = first;
    const { runtimeMs: _second, ...secondValues } = second;
    expect(secondValues).toEqual(firstValues);
  });

  it('gives different trials for different seeds but similar medians', () => {
    const medians = [11, 2025, 4_242, 77_777, 123_456].map((seed) => {
      const scenario = cohortScenario();
      scenario.trials = 200;
      scenario.seed = seed;
      return runSimulation(scenario);
    });
    const values = medians.map((result) => result.chainEconomicProfit);
    expect(new Set(values).size).toBe(values.length);
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    for (const result of medians) {
      expect(Math.abs(result.chainEconomicProfit / mean - 1)).toBeLessThan(0.05);
      expect(result.chainP10).toBeLessThan(mean);
      expect(result.chainP90).toBeGreaterThan(mean);
    }
  });

  it('settles as the number of trials increases', () => {
    const run = (trials: number) => {
      const scenario = cohortScenario();
      scenario.trials = trials;
      return runSimulation(scenario);
    };
    const reference = run(500);
    const smaller = run(100);
    expect(
      Math.abs(smaller.chainEconomicProfit / reference.chainEconomicProfit - 1),
    ).toBeLessThan(0.05);
    expect(
      Math.abs(
        width(smaller.chainP10, smaller.chainP90) /
          width(reference.chainP10, reference.chainP90) -
          1,
      ),
    ).toBeLessThan(0.15);
  });
});
