/**
 * # Validation.Supply-Chain.Test
 *
 * ## What this file is for
 * Checks that cattle, beef, and money move correctly between the cow-calf,
 * stocker, feedlot, packer, and retail stages, and that the engine rejects
 * settings it cannot simulate.
 *
 * ## How the checks work
 * Most tests run a single trial, so every ledger line is that trial's exact
 * value rather than a median. Identities that hold within one trial can then
 * be compared to many decimal places. Deterministic runs (no price shocks,
 * biological variation, or mortality) are compared with hand calculations.
 */
import { describe, expect, it } from 'vitest';
import { PHASE_ORDER } from '../lib/model/phases';
import { runSimulation, validateScenario } from '../lib/model/simulate';
import type { EntryCadence, SimulationSummary } from '../lib/model/types';
import {
  cohortScenario,
  deterministicCohort,
  RETAIL_COST_PER_LB,
} from './validation-helpers';

function sumPhases(
  result: SimulationSummary,
  pick: (phase: SimulationSummary['phases']['cowCalf']) => number,
) {
  return PHASE_ORDER.reduce((sum, key) => sum + pick(result.phases[key]), 0);
}

function expectHeadFlowToReconcile(result: SimulationSummary) {
  const { phases } = result;
  for (const key of PHASE_ORDER) {
    const phase = phases[key];
    expect(phase.enteredHead).toBeCloseTo(
      phase.exitedHead + phase.mortalityHead + phase.endingInventoryHead,
      6,
    );
    for (const value of [
      phase.enteredHead,
      phase.exitedHead,
      phase.mortalityHead,
      phase.endingInventoryHead,
    ])
      expect(value).toBeGreaterThanOrEqual(0);
  }
  for (let index = 1; index < PHASE_ORDER.length; index += 1) {
    expect(phases[PHASE_ORDER[index]].enteredHead).toBeCloseTo(
      phases[PHASE_ORDER[index - 1]].exitedHead,
      6,
    );
  }
  expect(phases.cowCalf.enteredHead).toBeCloseTo(result.totalStartedHead, 6);
  expect(phases.retail.exitedHead).toBeCloseTo(result.completedHead, 6);
  expect(sumPhases(result, (phase) => phase.mortalityHead)).toBeCloseTo(
    result.mortalityHead,
    6,
  );
  expect(sumPhases(result, (phase) => phase.endingInventoryHead)).toBeCloseTo(
    result.endingInventoryHead,
    6,
  );
}

describe('cattle movement between stages', () => {
  it('moves every animal through the cohort without losing or duplicating head', () => {
    const scenario = cohortScenario();
    scenario.trials = 1;
    const result = runSimulation(scenario);
    expectHeadFlowToReconcile(result);
    expect(result.endingInventoryHead).toBeCloseTo(0, 6);
    expect(result.mortalityHead).toBeGreaterThan(0);
  });

  const cadences: EntryCadence[] = ['even', 'upfront', 'spring', 'fall', 'custom'];
  for (const cadence of cadences) {
    it(`reconciles head at every stage with ${cadence} entry over ten years`, () => {
      const scenario = cohortScenario();
      scenario.trials = 1;
      scenario.cadence = cadence;
      scenario.customCadence = [3, 0, 0, 1, 0, 0, 2, 0, 0, 1, 0, 5];
      scenario.horizonMonths = 120;
      const result = runSimulation(scenario);
      expectHeadFlowToReconcile(result);
      expect(
        result.completedHead +
          result.mortalityHead +
          result.endingInventoryHead,
      ).toBeCloseTo(scenario.totalHead, 6);
    });
  }

  it('reconciles head when cattle are still in progress at the horizon', () => {
    const scenario = cohortScenario();
    scenario.trials = 1;
    scenario.cadence = 'even';
    const result = runSimulation(scenario);
    expectHeadFlowToReconcile(result);
    for (const key of ['cowCalf', 'stocker', 'feedlot'] as const)
      expect(result.phases[key].endingInventoryHead).toBeGreaterThan(0);
  });

  it('keeps cattle whose stage ends exactly at the horizon in the head count', () => {
    const scenario = deterministicCohort();
    scenario.horizonMonths = 12;
    // 12 months of days, so the cow-calf stage ends exactly at the horizon.
    scenario.phases.cowCalf.durationDays = 12 * 30.4375;
    const result = runSimulation(scenario);
    expectHeadFlowToReconcile(result);
    expect(result.phases.cowCalf.endingInventoryHead).toBeCloseTo(
      scenario.totalHead,
      6,
    );
    expect(result.phases.cowCalf.revenue).toBe(0);
    expect(result.phases.cowCalf.terminalInventoryValue).toBeGreaterThan(0);
  });

  it('counts retail finishing exactly at the horizon as a completed sale', () => {
    const scenario = deterministicCohort();
    const chainDays = Object.values(scenario.phases).reduce(
      (sum, phase) => sum + phase.durationDays,
      0,
    );
    // Stretch the retail stage so the chain ends exactly at month 24.
    scenario.phases.retail.durationDays += 24 * 30.4375 - chainDays;
    const result = runSimulation(scenario);
    expectHeadFlowToReconcile(result);
    expect(result.completedHead).toBeCloseTo(scenario.totalHead, 6);
    expect(result.endingInventoryHead).toBeCloseTo(0, 6);
  });
});

describe('money moving between stages', () => {
  it('charges each stage the previous stage sale value under price risk', () => {
    const scenario = cohortScenario();
    scenario.trials = 1;
    const { phases } = runSimulation(scenario);
    expect(phases.cowCalf.acquisitionCost).toBe(0);
    expect(phases.stocker.acquisitionCost).toBeCloseTo(phases.cowCalf.revenue, 4);
    expect(phases.feedlot.acquisitionCost).toBeCloseTo(phases.stocker.revenue, 4);
    expect(phases.packer.acquisitionCost).toBeCloseTo(phases.feedlot.revenue, 4);
    expect(phases.retail.acquisitionCost).toBeCloseTo(
      phases.packer.revenue -
        scenario.byproductCreditPerHead * phases.packer.exitedHead,
      4,
    );
  });

  it('reconciles chain profit with final sales, inventory, and real costs', () => {
    for (const cadence of ['upfront', 'even', 'spring'] as const) {
      const scenario = cohortScenario();
      scenario.trials = 1;
      scenario.cadence = cadence;
      const result = runSimulation(scenario);
      const { phases } = result;
      const independent =
        phases.retail.revenue +
        scenario.byproductCreditPerHead * phases.packer.exitedHead +
        sumPhases(result, (phase) => phase.terminalInventoryValue) -
        sumPhases(result, (phase) => phase.directCosts) -
        sumPhases(result, (phase) => phase.economicCosts);
      expect(result.chainEconomicProfit).toBeCloseTo(independent, 3);
      expect(result.chainEconomicProfit).toBeCloseTo(
        sumPhases(result, (phase) => phase.economicProfit),
        6,
      );
    }
  });

  it('makes segment medians add up to the chain median across many trials', () => {
    const scenario = cohortScenario();
    scenario.trials = 101;
    const result = runSimulation(scenario);
    expect(sumPhases(result, (phase) => phase.economicProfit)).toBeCloseTo(
      result.chainEconomicProfit,
      6,
    );
    expect(
      sumPhases(result, (phase) => phase.operatingContribution),
    ).toBeCloseTo(result.chainOperatingContribution, 6);
  });
});

describe('meat production and stage values', () => {
  it('matches hand calculations for weight, beef, and revenue in a deterministic cohort', () => {
    const scenario = deterministicCohort();
    const result = runSimulation(scenario);
    const { phases } = scenario;
    const head = scenario.totalHead;
    const weaning =
      scenario.startWeight +
      phases.cowCalf.averageDailyGain * phases.cowCalf.durationDays;
    const feeder =
      weaning + phases.stocker.averageDailyGain * phases.stocker.durationDays;
    const fed =
      feeder + phases.feedlot.averageDailyGain * phases.feedlot.durationDays;
    const beefPerHead = fed * scenario.dressingPercentage * scenario.saleableYield;
    const gradeIndex =
      scenario.gradeMix.prime * scenario.gradePriceIndex.prime +
      scenario.gradeMix.choice +
      scenario.gradeMix.select * scenario.gradePriceIndex.select;

    expect(result.phases.cowCalf.averageExitWeight).toBeCloseTo(weaning, 6);
    expect(result.phases.stocker.averageExitWeight).toBeCloseTo(feeder, 6);
    expect(result.phases.feedlot.averageExitWeight).toBeCloseTo(fed, 6);
    expect(result.retailPounds).toBeCloseTo(beefPerHead * head, 2);
    expect(result.phases.cowCalf.revenue).toBeCloseTo(
      (weaning / 100) * scenario.calfPricePerCwt * head,
      2,
    );
    expect(result.phases.stocker.revenue).toBeCloseTo(
      (feeder / 100) * scenario.feederPricePerCwt * head,
      2,
    );
    expect(result.phases.feedlot.revenue).toBeCloseTo(
      (fed / 100) * scenario.fedPricePerCwt * head,
      2,
    );
    expect(result.phases.packer.revenue).toBeCloseTo(
      (beefPerHead * scenario.wholesalePricePerLb * gradeIndex +
        scenario.byproductCreditPerHead) *
        head,
      2,
    );
    expect(result.phases.retail.revenue).toBeCloseTo(
      beefPerHead * scenario.retailPricePerLb * gradeIndex * head,
      2,
    );
    expect(result.phases.retail.directCosts).toBeCloseTo(
      beefPerHead * RETAIL_COST_PER_LB * head,
      2,
    );
  });

  it('matches hand calculations for each stage cost, including feedlot ration', () => {
    const scenario = deterministicCohort();
    const result = runSimulation(scenario);
    const head = scenario.totalHead;
    for (const key of ['cowCalf', 'stocker', 'packer'] as const) {
      const phase = scenario.phases[key];
      expect(result.phases[key].directCosts).toBeCloseTo(
        (phase.directCostPerHead + phase.dailyCostPerHead * phase.durationDays) *
          head,
        2,
      );
    }
    const feedlot = scenario.phases.feedlot;
    const ration =
      (scenario.feedDryMatterLbPerDay *
        feedlot.durationDays *
        scenario.feedCostPerTon) /
      2_000;
    expect(result.phases.feedlot.directCosts).toBeCloseTo(
      (feedlot.directCostPerHead +
        feedlot.dailyCostPerHead * feedlot.durationDays +
        ration) *
        head,
      2,
    );
    for (const key of PHASE_ORDER)
      expect(result.phases[key].economicCosts).toBeCloseTo(
        scenario.phases[key].economicCostPerHead * head,
        2,
      );
  });
});

describe('herd size', () => {
  it('gives the same per-head profit from 1 to 30 million head', () => {
    const perHead = [1, 10, 2_499, 2_500, 100_000, 1_000_000, 30_000_000].map(
      (totalHead) => {
        const scenario = deterministicCohort();
        scenario.totalHead = totalHead;
        const result = runSimulation(scenario);
        expect(result.completedHead).toBeCloseTo(totalHead, 4);
        return result.chainEconomicProfit / totalHead;
      },
    );
    for (const value of perHead) expect(value).toBeCloseTo(perHead[0], 6);
  });

  it('scales stochastic results exactly once the agent count is fixed', () => {
    const base = cohortScenario();
    base.totalHead = 2_500;
    const results = [2_500, 250_000, 30_000_000].map((totalHead) =>
      runSimulation({ ...structuredClone(base), totalHead }),
    );
    for (const result of results) {
      const factor = result.totalStartedHead / 2_500;
      expect(result.chainEconomicProfit / factor).toBeCloseTo(
        results[0].chainEconomicProfit,
        2,
      );
      expect(result.mortalityHead / factor).toBeCloseTo(
        results[0].mortalityHead,
        6,
      );
    }
  });
});

describe('extreme conditions', () => {
  for (const stage of ['cowCalf', 'stocker', 'feedlot'] as const) {
    it(`stops every animal at the ${stage} stage under 100% mortality there`, () => {
      const scenario = cohortScenario();
      scenario.trials = 1;
      scenario.phases[stage].mortalityRate = 1;
      const result = runSimulation(scenario);
      const index = PHASE_ORDER.indexOf(stage);
      expect(result.phases[stage].exitedHead).toBe(0);
      expect(result.phases[stage].revenue).toBe(0);
      expect(result.phases[stage].directCosts).toBeGreaterThan(0);
      for (const later of PHASE_ORDER.slice(index + 1))
        expect(result.phases[later].enteredHead).toBe(0);
      expect(result.completedHead).toBe(0);
      expect(result.mortalityHead).toBeCloseTo(scenario.totalHead, 6);
      expect(result.phases[stage].mortalityHead).toBeCloseTo(
        result.phases[stage].enteredHead,
        6,
      );
      expectHeadFlowToReconcile(result);
      expect(result.chainEconomicProfit).toBeLessThan(0);
    });
  }

  it('loses exactly the total cost when every selling price is zero', () => {
    const scenario = deterministicCohort();
    scenario.calfPricePerCwt = 0;
    scenario.feederPricePerCwt = 0;
    scenario.fedPricePerCwt = 0;
    scenario.wholesalePricePerLb = 0;
    scenario.retailPricePerLb = 0;
    scenario.byproductCreditPerHead = 0;
    const result = runSimulation(scenario);
    for (const key of PHASE_ORDER) expect(result.phases[key].revenue).toBe(0);
    expect(result.chainEconomicProfit).toBeCloseTo(
      -sumPhases(result, (phase) => phase.directCosts + phase.economicCosts),
      2,
    );
    expect(result.breakEvenRetailPricePerLb).toBeGreaterThan(0);
  });

  it('lowers chain profit by exactly the added cost when costs rise tenfold', () => {
    const base = deterministicCohort();
    const expensive = structuredClone(base);
    for (const phase of Object.values(expensive.phases)) {
      phase.directCostPerHead *= 10;
      phase.dailyCostPerHead *= 10;
      phase.economicCostPerHead *= 10;
    }
    const baseResult = runSimulation(base);
    const expensiveResult = runSimulation(expensive);
    // Ration and the per-pound store cost are not per-head costs, so they stay put.
    const perHeadCosts = Object.values(base.phases).reduce(
      (sum, phase) =>
        sum +
        phase.directCostPerHead +
        phase.dailyCostPerHead * phase.durationDays +
        phase.economicCostPerHead,
      0,
    );
    const addedCost = 9 * perHeadCosts * base.totalHead;
    expect(expensiveResult.chainEconomicProfit).toBeCloseTo(
      baseResult.chainEconomicProfit - addedCost,
      2,
    );
    expect(expensiveResult.chainEconomicProfit).toBeLessThan(0);
    expect(Number.isFinite(expensiveResult.breakEvenRetailPricePerLb)).toBe(true);
  });
});

describe('input checks', () => {
  it('rejects settings outside the supported ranges', () => {
    const scenario = cohortScenario();
    scenario.trials = 501;
    scenario.biologicalVariation = 1.5;
    scenario.phases.feedlot.mortalityRate = 1.2;
    scenario.phases.stocker.durationDays = -1;
    scenario.gradePriceIndex = { prime: 0, select: 6 };
    scenario.totalHead = 30_000_001;
    expect(validateScenario(scenario)).toEqual([
      'Head count must be a whole number from 1 to 30,000,000.',
      'Trials must be between 1 and 500.',
      'Biological variation must be between 0% and 100%.',
      'Grade price indexes must be between 0 and 5 times Choice.',
      'Stocker timing values cannot be negative.',
      'Feedlot mortality must be between 0% and 100%.',
    ]);
    expect(() => runSimulation(scenario)).toThrow(/Head count/);
  });

  it('rejects fractional head counts and horizons', () => {
    const scenario = cohortScenario();
    scenario.totalHead = 100.5;
    scenario.horizonMonths = 24.5;
    expect(validateScenario(scenario)).toHaveLength(2);
  });

  it('accepts the published default scenario and every boundary value', () => {
    const scenario = cohortScenario();
    expect(validateScenario(scenario)).toEqual([]);
    for (const [totalHead, horizonMonths, trials] of [
      [1, 12, 1],
      [30_000_000, 120, 500],
    ]) {
      const edge = cohortScenario();
      edge.totalHead = totalHead;
      edge.horizonMonths = horizonMonths;
      edge.trials = trials;
      expect(validateScenario(edge)).toEqual([]);
    }
  });
});
