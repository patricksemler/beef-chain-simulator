import { describe, expect, it } from 'vitest';
import { cloneDefaultScenario } from '../lib/model/defaults';
import {
  applyHistoricalYear,
  AVAILABLE_HISTORICAL_YEARS,
  LATEST_HISTORICAL_YEAR,
} from '../lib/model/historical';
import {
  allocateEntryMonths,
  runSimulation,
  validateScenario,
} from '../lib/model/simulate';

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
    expect(
      Math.max(...allocation) - Math.min(...allocation),
    ).toBeLessThanOrEqual(1);
  });

  it('puts every animal in month one for an upfront cadence', () => {
    const scenario = quickScenario();
    scenario.cadence = 'upfront';
    expect(allocateEntryMonths(scenario)).toEqual([
      10_000,
      ...Array(23).fill(0),
    ]);
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

  it('rejects a reference year without a complete USDA profile', () => {
    const scenario = quickScenario();
    scenario.referenceYear = 2014;
    expect(validateScenario(scenario)).toContain(
      'Reference year must be one of the available USDA annual profiles.',
    );
  });
});

describe('historical USDA profiles', () => {
  it('includes every requested year from 2015 through 2025', () => {
    expect(AVAILABLE_HISTORICAL_YEARS).toEqual([
      2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025,
    ]);
    expect(LATEST_HISTORICAL_YEAR).toBe(2025);
  });

  it('loads historical economics while keeping user-owned scenario inputs', () => {
    const current = quickScenario();
    current.totalHead = 123_456;
    current.horizonMonths = 60;
    current.cadence = 'fall';
    current.marketRisk.calfVolatility = 0.2;
    const historical = applyHistoricalYear(current, 2015);

    expect(historical.referenceYear).toBe(2015);
    expect(historical.totalHead).toBe(123_456);
    expect(historical.horizonMonths).toBe(60);
    expect(historical.cadence).toBe('fall');
    expect(historical.marketRisk.calfVolatility).toBe(0.2);
    expect(historical.calfPricePerCwt).toBe(254.54);
    expect(historical.feederPricePerCwt).toBe(202.37);
    expect(historical.wholesalePricePerLb).toBe(3.628);
    expect(historical.retailPricePerLb).toBe(6.038);
  });

  it('changes sector economics across historical years', () => {
    const current = quickScenario();
    current.cadence = 'upfront';
    const result2015 = runSimulation(applyHistoricalYear(current, 2015));
    const result2025 = runSimulation(applyHistoricalYear(current, 2025));

    expect(result2015.dataVintage).toBe('Based on 2015 USDA annual averages');
    expect(result2025.dataVintage).toBe('Based on 2025 USDA annual averages');
    expect(result2015.phases.stocker.economicProfit).not.toBe(
      result2025.phases.stocker.economicProfit,
    );
  });
});

describe('simulation accounting', () => {
  it('is reproducible for the same scenario and seed', () => {
    const scenario = quickScenario();
    const first = runSimulation(scenario);
    const second = runSimulation(scenario);
    expect(second.chainEconomicProfit).toBe(first.chainEconomicProfit);
    expect(second.completedHead).toBe(first.completedHead);
    expect(second.phases.feedlot.p10EconomicProfit).toBe(
      first.phases.feedlot.p10EconomicProfit,
    );
  });

  it('conserves all cattle and orders uncertainty percentiles', () => {
    const result = runSimulation(quickScenario());
    expect(
      result.completedHead + result.mortalityHead + result.endingInventoryHead,
    ).toBeCloseTo(result.totalStartedHead, 6);
    expect(result.reconciliationDifference).toBeCloseTo(0, 6);
    expect(result.chainP10).toBeLessThanOrEqual(result.chainEconomicProfit);
    expect(result.chainEconomicProfit).toBeLessThanOrEqual(result.chainP90);
    for (const phase of Object.values(result.phases)) {
      expect(phase.operatingContribution).toBeCloseTo(
        phase.revenue +
          phase.terminalInventoryValue -
          phase.acquisitionCost -
          phase.directCosts,
        4,
      );
      expect(phase.economicProfit).toBeCloseTo(
        phase.operatingContribution - phase.economicCosts,
        4,
      );
    }
  });

  it('scales weighted-agent totals proportionally', () => {
    const smaller = quickScenario();
    smaller.totalHead = 100_000;
    const larger = structuredClone(smaller);
    larger.totalHead = 200_000;
    const smallResult = runSimulation(smaller);
    const largeResult = runSimulation(larger);
    expect(
      largeResult.chainEconomicProfit / smallResult.chainEconomicProfit,
    ).toBeCloseTo(2, 8);
    expect(largeResult.completedHead / smallResult.completedHead).toBeCloseTo(
      2,
      8,
    );
  });

  it('accounts for packer and retail as separate stages', () => {
    const scenario = quickScenario();
    scenario.cadence = 'upfront';
    scenario.trials = 1;
    scenario.biologicalVariation = 0;
    for (const phase of Object.values(scenario.phases)) phase.mortalityRate = 0;
    for (const key of Object.keys(scenario.marketRisk) as Array<
      keyof typeof scenario.marketRisk
    >) {
      scenario.marketRisk[key] = key === 'commonMarketCorrelation' ? 0.65 : 0;
    }

    const result = runSimulation(scenario);
    expect(result.phases.packer.label).toBe('Packer');
    expect(result.phases.retail.label).toBe('Retail');
    expect(result.phases.packer.exitedHead).toBeCloseTo(scenario.totalHead, 6);
    expect(result.phases.retail.exitedHead).toBeCloseTo(scenario.totalHead, 6);
    expect(result.phases.retail.acquisitionCost).toBeCloseTo(
      result.phases.packer.revenue -
        scenario.byproductCreditPerHead * result.phases.packer.exitedHead,
      4,
    );
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
    expect(
      Object.values(result.phases).reduce(
        (sum, phase) => sum + phase.endingInventoryHead,
        0,
      ),
    ).toBeGreaterThan(0);
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
    expect(
      result.completedHead + result.mortalityHead + result.endingInventoryHead,
    ).toBeCloseTo(1, 8);
  });

  it('returns finite losses with zero output prices and extreme costs', () => {
    const scenario = quickScenario();
    scenario.calfPricePerCwt = 0;
    scenario.feederPricePerCwt = 0;
    scenario.fedPricePerCwt = 0;
    scenario.retailPricePerLb = 0;
    for (const phase of Object.values(scenario.phases))
      phase.directCostPerHead = 1_000_000;
    const result = runSimulation(scenario);
    expect(result.chainEconomicProfit).toBeLessThan(0);
    expect(Number.isFinite(result.chainEconomicProfit)).toBe(true);
  });

  it('collapses uncertainty when all stochastic inputs are disabled', () => {
    const scenario = quickScenario();
    scenario.cadence = 'upfront';
    scenario.biologicalVariation = 0;
    for (const phase of Object.values(scenario.phases)) phase.mortalityRate = 0;
    for (const key of Object.keys(scenario.marketRisk) as Array<
      keyof typeof scenario.marketRisk
    >)
      scenario.marketRisk[key] = key === 'commonMarketCorrelation' ? 0.65 : 0;
    const result = runSimulation(scenario);
    expect(result.chainP10).toBeCloseTo(result.chainP90, 8);
    expect(
      result.chainProbabilityOfLoss === 0 ||
        result.chainProbabilityOfLoss === 1,
    ).toBe(true);
  });
});
