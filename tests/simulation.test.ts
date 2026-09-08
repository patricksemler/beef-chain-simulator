import { describe, expect, it } from 'vitest';
import { cloneDefaultScenario } from '../lib/model/defaults';
import { allocateEntryMonths, runSimulation, validateScenario } from '../lib/model/simulate';

function quickScenario() {
  const scenario = cloneDefaultScenario();
  scenario.totalHead = 10_000;
  scenario.trials = 12;
  return scenario;
}

describe('entry allocation', () => {
  it('allocates the exact requested head count across the horizon', () => {
    const scenario = quickScenario();
    scenario.totalHead = 100_003;
    const allocation = allocateEntryMonths(scenario);
    expect(allocation).toHaveLength(24);
    expect(allocation.reduce((sum, value) => sum + value, 0)).toBe(100_003);
    expect(Math.max(...allocation) - Math.min(...allocation)).toBeLessThanOrEqual(1);
  });

  it('puts every animal in month one for an upfront cadence', () => {
    const scenario = quickScenario();
    scenario.cadence = 'upfront';
    expect(allocateEntryMonths(scenario)).toEqual([10_000, ...Array(23).fill(0)]);
  });
});

describe('scenario validation', () => {
  it('rejects out-of-range head counts, horizons, and custom cadence', () => {
    const scenario = quickScenario();
    scenario.totalHead = 0;
    scenario.horizonMonths = 11;
    scenario.cadence = 'custom';
    scenario.customCadence = Array(12).fill(0);
    expect(validateScenario(scenario)).toHaveLength(3);
  });
});

describe('simulation accounting', () => {
  it('is reproducible for the same scenario and seed', () => {
    const scenario = quickScenario();
    const first = runSimulation(scenario);
    const second = runSimulation(scenario);
    expect(second.chainEconomicProfit).toBe(first.chainEconomicProfit);
    expect(second.completedHead).toBe(first.completedHead);
    expect(second.phases.feedlot.p10EconomicProfit).toBe(first.phases.feedlot.p10EconomicProfit);
  });

  it('conserves all cattle and orders uncertainty percentiles', () => {
    const result = runSimulation(quickScenario());
    expect(result.completedHead + result.mortalityHead + result.endingInventoryHead).toBeCloseTo(result.totalStartedHead, 6);
    expect(result.reconciliationDifference).toBeCloseTo(0, 6);
    expect(result.chainP10).toBeLessThanOrEqual(result.chainEconomicProfit);
    expect(result.chainEconomicProfit).toBeLessThanOrEqual(result.chainP90);
    for (const phase of Object.values(result.phases)) {
      expect(phase.operatingContribution).toBeCloseTo(phase.revenue + phase.terminalInventoryValue - phase.acquisitionCost - phase.directCosts, 4);
      expect(phase.economicProfit).toBeCloseTo(phase.operatingContribution - phase.economicCosts, 4);
    }
  });

  it('scales weighted-agent totals proportionally', () => {
    const smaller = quickScenario();
    smaller.totalHead = 100_000;
    const larger = structuredClone(smaller);
    larger.totalHead = 200_000;
    const smallResult = runSimulation(smaller);
    const largeResult = runSimulation(larger);
    expect(largeResult.chainEconomicProfit / smallResult.chainEconomicProfit).toBeCloseTo(2, 8);
    expect(largeResult.completedHead / smallResult.completedHead).toBeCloseTo(2, 8);
  });

  it('handles complete mortality without breaking reconciliation', () => {
    const scenario = quickScenario();
    scenario.cadence = 'upfront';
    scenario.phases.cowCalf.mortalityRate = 1;
    const result = runSimulation(scenario);
    expect(result.mortalityHead).toBeCloseTo(scenario.totalHead, 6);
    expect(result.completedHead).toBe(0);
    expect(result.endingInventoryHead).toBe(0);
    expect(result.reconciliationDifference).toBeCloseTo(0, 6);
  });

  it('marks unfinished cattle as ending inventory', () => {
    const scenario = quickScenario();
    scenario.horizonMonths = 12;
    const result = runSimulation(scenario);
    expect(result.endingInventoryHead).toBeGreaterThan(0);
    expect(result.completedHead).toBe(0);
    expect(Object.values(result.phases).reduce((sum, phase) => sum + phase.endingInventoryHead, 0)).toBeGreaterThan(0);
  });

  it('runs the maximum scale without allocating one object per animal', () => {
    const scenario = quickScenario();
    scenario.totalHead = 30_000_000;
    scenario.horizonMonths = 120;
    scenario.trials = 2;
    const result = runSimulation(scenario);
    expect(result.totalStartedHead).toBe(30_000_000);
    expect(result.reconciliationDifference).toBeCloseTo(0, 4);
    expect(Number.isFinite(result.chainEconomicProfit)).toBe(true);
  });

  it('supports a single animal scenario', () => {
    const scenario = quickScenario();
    scenario.totalHead = 1;
    scenario.cadence = 'upfront';
    const result = runSimulation(scenario);
    expect(result.totalStartedHead).toBe(1);
    expect(result.completedHead + result.mortalityHead + result.endingInventoryHead).toBeCloseTo(1, 8);
  });

  it('returns finite losses with zero output prices and extreme costs', () => {
    const scenario = quickScenario();
    scenario.calfPricePerCwt = 0;
    scenario.feederPricePerCwt = 0;
    scenario.fedPricePerCwt = 0;
    scenario.retailPricePerLb = 0;
    for (const phase of Object.values(scenario.phases)) phase.directCostPerHead = 1_000_000;
    const result = runSimulation(scenario);
    expect(result.chainEconomicProfit).toBeLessThan(0);
    expect(Number.isFinite(result.chainEconomicProfit)).toBe(true);
  });

  it('collapses uncertainty when all stochastic inputs are disabled', () => {
    const scenario = quickScenario();
    scenario.cadence = 'upfront';
    scenario.biologicalVariation = 0;
    for (const phase of Object.values(scenario.phases)) phase.mortalityRate = 0;
    for (const key of Object.keys(scenario.marketRisk) as Array<keyof typeof scenario.marketRisk>) scenario.marketRisk[key] = key === 'commonMarketCorrelation' ? 0.65 : 0;
    const result = runSimulation(scenario);
    expect(result.chainP10).toBeCloseTo(result.chainP90, 8);
    expect(result.chainProbabilityOfLoss === 0 || result.chainProbabilityOfLoss === 1).toBe(true);
  });
});
