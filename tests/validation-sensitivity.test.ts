/**
 * # Validation.Sensitivity.Test
 *
 * ## What this file is for
 * Checks the one-at-a-time sensitivity analysis and the direction and size of
 * each driver's effect on profit.
 *
 * ## How the checks work
 * The engine's sensitivity swings are recomputed independently by running the
 * full simulation with each input lowered and raised by 10%, and by closed-form
 * expressions derived from the stage ledgers. Each driver is changed alone.
 */
import { describe, expect, it } from 'vitest';
import { PHASE_ORDER } from '../lib/model/phases';
import { runSimulation } from '../lib/model/simulate';
import type { PhaseKey, ScenarioInput } from '../lib/model/types';
import {
  cohortScenario,
  deterministicCohort,
  makeDeterministic,
} from './validation-helpers';

type Driver = {
  key: string;
  apply: (scenario: ScenarioInput, factor: number) => void;
};

const DRIVERS: Driver[] = [
  { key: 'retailPrice', apply: (s, f) => void (s.retailPricePerLb *= f) },
  { key: 'wholesalePrice', apply: (s, f) => void (s.wholesalePricePerLb *= f) },
  { key: 'fedPrice', apply: (s, f) => void (s.fedPricePerCwt *= f) },
  { key: 'feederPrice', apply: (s, f) => void (s.feederPricePerCwt *= f) },
  { key: 'calfPrice', apply: (s, f) => void (s.calfPricePerCwt *= f) },
  { key: 'feedCost', apply: (s, f) => void (s.feedCostPerTon *= f) },
  { key: 'yield', apply: (s, f) => void (s.saleableYield *= f) },
];

/** Transfer prices: the seller's revenue and the buyer's purchase cost. */
const TRANSFERS: Array<{ key: string; seller: PhaseKey; buyer: PhaseKey }> = [
  { key: 'calfPrice', seller: 'cowCalf', buyer: 'stocker' },
  { key: 'feederPrice', seller: 'stocker', buyer: 'feedlot' },
  { key: 'fedPrice', seller: 'feedlot', buyer: 'packer' },
  { key: 'wholesalePrice', seller: 'packer', buyer: 'retail' },
];

function scaled(scenario: ScenarioInput, key: string, factor: number) {
  const next = structuredClone(scenario);
  DRIVERS.find((driver) => driver.key === key)!.apply(next, factor);
  return next;
}

function chainProfit(scenario: ScenarioInput) {
  return runSimulation(scenario).chainEconomicProfit;
}

describe('direction of effects', () => {
  const steps = [0.8, 0.9, 1, 1.1, 1.2];

  it('raises chain profit at every step as retail price rises, with risk on', () => {
    const base = cohortScenario();
    const profits = steps.map((factor) =>
      chainProfit(scaled(base, 'retailPrice', factor)),
    );
    for (let index = 1; index < profits.length; index += 1)
      expect(profits[index]).toBeGreaterThan(profits[index - 1]);
  });

  it('lowers chain profit at every step as feed cost rises, with risk on', () => {
    const base = cohortScenario();
    const profits = steps.map((factor) =>
      chainProfit(scaled(base, 'feedCost', factor)),
    );
    for (let index = 1; index < profits.length; index += 1)
      expect(profits[index]).toBeLessThan(profits[index - 1]);
  });

  it('raises chain profit at every step as saleable yield rises, with risk on', () => {
    const base = cohortScenario();
    const profits = steps.map((factor) =>
      chainProfit(scaled(base, 'yield', factor)),
    );
    for (let index = 1; index < profits.length; index += 1)
      expect(profits[index]).toBeGreaterThan(profits[index - 1]);
  });

  it('changes chain profit linearly in retail price and feed cost', () => {
    const base = deterministicCohort();
    for (const key of ['retailPrice', 'feedCost']) {
      const [low, mid, high] = [0.9, 1, 1.1].map((factor) =>
        chainProfit(scaled(base, key, factor)),
      );
      expect(high - mid).toBeCloseTo(mid - low, 2);
    }
  });
});

describe('engine sensitivity output', () => {
  it('matches an independent rerun of every driver at -10% and +10%', () => {
    const scenario = cohortScenario();
    const result = runSimulation(scenario);
    const deterministic = makeDeterministic(structuredClone(scenario));
    expect(result.sensitivity).toHaveLength(DRIVERS.length);
    expect(result.sensitivityBase).toBeCloseTo(chainProfit(deterministic), 2);
    for (const driver of result.sensitivity) {
      const low = chainProfit(scaled(deterministic, driver.key, 0.9));
      const high = chainProfit(scaled(deterministic, driver.key, 1.1));
      expect(driver.lowEconomicProfit, driver.key).toBeCloseTo(low, 2);
      expect(driver.highEconomicProfit, driver.key).toBeCloseTo(high, 2);
      expect(driver.swing, driver.key).toBeCloseTo(Math.abs(high - low) / 2, 2);
    }
  });

  it('ranks drivers from largest to smallest swing', () => {
    const { sensitivity } = runSimulation(cohortScenario());
    for (let index = 1; index < sensitivity.length; index += 1)
      expect(sensitivity[index].swing).toBeLessThanOrEqual(
        sensitivity[index - 1].swing,
      );
    expect(sensitivity.slice(0, 3).map((driver) => driver.key)).toEqual([
      'retailPrice',
      'yield',
      'feedCost',
    ]);
  });

  it('matches closed-form swings for retail price, saleable yield, and feed cost', () => {
    const scenario = deterministicCohort();
    const result = runSimulation(scenario);
    const swing = (key: string) =>
      result.sensitivity.find((driver) => driver.key === key)!.swing;
    const retailRevenue = result.phases.retail.revenue;
    const storeCost = result.phases.retail.directCosts;
    const ration =
      (scenario.feedDryMatterLbPerDay *
        scenario.phases.feedlot.durationDays *
        scenario.feedCostPerTon *
        scenario.totalHead) /
      2_000;
    // Retail price scales only retail revenue.
    expect(swing('retailPrice')).toBeCloseTo(0.1 * retailRevenue, 2);
    // Yield scales pounds sold; wholesale value cancels between packer and retail.
    expect(swing('yield')).toBeCloseTo(0.1 * (retailRevenue - storeCost), 2);
    // Feed cost scales the feedlot ration only.
    expect(swing('feedCost')).toBeCloseTo(0.1 * ration, 2);
  });
});

describe('transfer prices between stages', () => {
  for (const { key, seller, buyer } of TRANSFERS) {
    it(`shifts profit from ${buyer} to ${seller} without changing chain profit (${key})`, () => {
      const base = deterministicCohort();
      const baseResult = runSimulation(base);
      const raised = runSimulation(scaled(base, key, 1.1));
      const sellerGain =
        raised.phases[seller].economicProfit -
        baseResult.phases[seller].economicProfit;
      const buyerLoss =
        baseResult.phases[buyer].economicProfit -
        raised.phases[buyer].economicProfit;
      expect(sellerGain).toBeGreaterThan(0);
      expect(sellerGain).toBeCloseTo(buyerLoss, 2);
      expect(raised.chainEconomicProfit).toBeCloseTo(
        baseResult.chainEconomicProfit,
        2,
      );
      for (const other of PHASE_ORDER.filter(
        (phase) => phase !== seller && phase !== buyer,
      ))
        expect(raised.phases[other].economicProfit).toBeCloseTo(
          baseResult.phases[other].economicProfit,
          4,
        );
    });
  }

  it('keeps chain profit unchanged when every transfer price moves at once', () => {
    const base = deterministicCohort();
    const moved = structuredClone(base);
    for (const { key } of TRANSFERS)
      DRIVERS.find((driver) => driver.key === key)!.apply(moved, 1.25);
    expect(chainProfit(moved)).toBeCloseTo(chainProfit(base), 2);
  });

  it('also cancels transfer prices in the median chain profit under price risk', () => {
    const base = cohortScenario();
    for (const { key } of TRANSFERS)
      expect(chainProfit(scaled(base, key, 1.1))).toBeCloseTo(
        chainProfit(base),
        2,
      );
  });

  it('lets cattle prices affect chain profit only through ending inventory', () => {
    const base = deterministicCohort();
    base.cadence = 'even';
    const result = runSimulation(base);
    const swing = (key: string) =>
      result.sensitivity.find((driver) => driver.key === key)!.swing;
    expect(swing('calfPrice')).toBeCloseTo(
      0.1 * result.phases.cowCalf.terminalInventoryValue,
      2,
    );
    expect(swing('feederPrice')).toBeCloseTo(
      0.1 * result.phases.stocker.terminalInventoryValue,
      2,
    );
    expect(swing('fedPrice')).toBeCloseTo(
      0.1 * result.phases.feedlot.terminalInventoryValue,
      2,
    );
    expect(swing('calfPrice')).toBeGreaterThan(0);
  });
});

describe('combined changes', () => {
  it('adds independent drivers without interaction', () => {
    const base = deterministicCohort();
    const baseProfit = chainProfit(base);
    const retailOnly = chainProfit(scaled(base, 'retailPrice', 1.1)) - baseProfit;
    const feedOnly = chainProfit(scaled(base, 'feedCost', 0.9)) - baseProfit;
    const both = chainProfit(
      scaled(scaled(base, 'retailPrice', 1.1), 'feedCost', 0.9),
    );
    expect(both - baseProfit).toBeCloseTo(retailOnly + feedOnly, 2);
  });

  it('shows the expected interaction between retail price and yield', () => {
    const base = deterministicCohort();
    const result = runSimulation(base);
    const baseProfit = result.chainEconomicProfit;
    const priceOnly = chainProfit(scaled(base, 'retailPrice', 1.1)) - baseProfit;
    const yieldOnly = chainProfit(scaled(base, 'yield', 1.1)) - baseProfit;
    const both =
      chainProfit(scaled(scaled(base, 'retailPrice', 1.1), 'yield', 1.1)) -
      baseProfit;
    // Revenue is price x pounds, so the cross term is 0.1 x 0.1 x revenue.
    expect(both - priceOnly - yieldOnly).toBeCloseTo(
      0.01 * result.phases.retail.revenue,
      2,
    );
  });

  it('reports the low-cost and high-cost scenario gap the sensitivity predicts', () => {
    const scenario = cohortScenario();
    const { sensitivity } = runSimulation(scenario);
    const deterministic = makeDeterministic(structuredClone(scenario));
    const lowCost = chainProfit(scaled(deterministic, 'feedCost', 0.9));
    const highCost = chainProfit(scaled(deterministic, 'feedCost', 1.1));
    const feed = sensitivity.find((driver) => driver.key === 'feedCost')!;
    expect(lowCost).toBeGreaterThan(highCost);
    expect(lowCost - highCost).toBeCloseTo(2 * feed.swing, 2);
  });
});
