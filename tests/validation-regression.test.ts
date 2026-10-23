/**
 * # Validation.Regression.Test
 *
 * ## What this file is for
 * Golden-master tests. They rerun the manuscript's scenarios
 * (scripts/paper/run-experiments.ts) and compare the results with the values
 * published in the paper's tables, to the precision printed there. A change to
 * the engine that moves a published number fails here first.
 *
 * ## Updating
 * If a model change is intended to move these numbers, rerun the paper script,
 * update the manuscript tables, and then update the expected values below.
 */
import { describe, expect, it } from 'vitest';
import { AVAILABLE_HISTORICAL_YEARS } from '../lib/model/historical';
import { runSimulation } from '../lib/model/simulate';
import { cohortScenario } from './validation-helpers';

const MILLION = 1_000_000;

/** Paper scenario S1: 2025 inputs, 100,000 calves, upfront entry, 500 trials. */
function paperBaseline(year = 2025 as (typeof AVAILABLE_HISTORICAL_YEARS)[number]) {
  const scenario = cohortScenario(year);
  scenario.trials = 500;
  scenario.seed = 2025;
  return scenario;
}

/** Compares in millions, rounded to the one decimal shown in the tables. */
function expectMillions(actual: number, published: number) {
  expect(Math.round((actual / MILLION) * 10) / 10).toBeCloseTo(published, 6);
}

describe('paper Table 2: 2025 baseline cohort (S1)', () => {
  const result = runSimulation(paperBaseline());

  it('reproduces head counts', () => {
    expect(result.completedHead).toBeCloseTo(96_520, 6);
    expect(result.mortalityHead).toBeCloseTo(3_480, 6);
    expect(result.endingInventoryHead).toBeCloseTo(0, 6);
    expect(result.phases.cowCalf.exitedHead).toBeCloseTo(98_480, 6);
    expect(result.phases.stocker.exitedHead).toBeCloseTo(97_720, 6);
  });

  it('reproduces chain profit and its 10th to 90th percentile range', () => {
    expectMillions(result.chainEconomicProfit, 146.8);
    expectMillions(result.chainP10, 114.6);
    expectMillions(result.chainP90, 177.1);
    expectMillions(result.chainOperatingContribution, 215.3);
    expect(result.chainProbabilityOfLoss).toBe(0);
  });

  it('reproduces every segment profit, range, and probability of loss', () => {
    const published = {
      cowCalf: [103.0, 68.4, 140.3, 0.0],
      stocker: [-7.8, -43.0, 27.5, 0.636],
      feedlot: [-37.4, -72.8, -1.8, 0.914],
      packer: [-48.9, -79.0, -19.5, 0.982],
      retail: [137.9, 106.3, 165.0, 0.0],
    } as const;
    for (const [key, [median, p10, p90, loss]] of Object.entries(published)) {
      const phase = result.phases[key as keyof typeof published];
      expectMillions(phase.economicProfit, median);
      expectMillions(phase.p10EconomicProfit, p10);
      expectMillions(phase.p90EconomicProfit, p90);
      expect(phase.probabilityOfLoss).toBeCloseTo(loss, 6);
    }
  });

  it('reproduces segment revenues', () => {
    expectMillions(result.phases.cowCalf.revenue, 230.5);
    expectMillions(result.phases.stocker.revenue, 250.5);
    expectMillions(result.phases.feedlot.revenue, 300.3);
    expectMillions(result.phases.packer.revenue, 318.5);
    expectMillions(result.phases.retail.revenue, 525.9);
  });

  it('reproduces the break-even prices', () => {
    expect(result.breakEvenRetailPricePerLb).toBeCloseTo(6.76, 2);
    expect(result.breakEvenFedPricePerCwt).toBeCloseTo(251.84, 2);
  });
});

describe('paper Table 6: one-at-a-time sensitivity (S1)', () => {
  const result = runSimulation(paperBaseline());
  const published: Record<string, [number, number, number]> = {
    retailPrice: [102.1, 210.8, 54.36],
    yield: [111.0, 202.0, 45.51],
    feedCost: [162.3, 150.7, 5.8],
    wholesalePrice: [156.5, 156.5, 0],
    fedPrice: [156.5, 156.5, 0],
    feederPrice: [156.5, 156.5, 0],
    calfPrice: [156.5, 156.5, 0],
  };

  it('reproduces the deterministic base and every driver', () => {
    expectMillions(result.sensitivityBase, 156.5);
    for (const driver of result.sensitivity) {
      const [low, high, swing] = published[driver.key];
      expectMillions(driver.lowEconomicProfit, low);
      expectMillions(driver.highEconomicProfit, high);
      expect(Math.round((driver.swing / MILLION) * 100) / 100).toBeCloseTo(
        swing,
        6,
      );
    }
  });
});

describe('paper Supplementary Table S2 and Table 6: rolling entry (S1b)', () => {
  const scenario = paperBaseline();
  scenario.cadence = 'even';
  const result = runSimulation(scenario);

  it('reproduces head counts, ending inventory, and segment profits', () => {
    expect(result.completedHead).toBeCloseTo(23_200, 6);
    expect(result.endingInventoryHead).toBeCloseTo(74_920, 6);
    const published = {
      cowCalf: [72_200, 26_680, 94.7],
      stocker: [51_560, 20_240, -9.8],
      feedlot: [27_160, 24_040, -23.6],
      packer: [26_240, 920, -13.2],
      retail: [23_200, 3_040, 39.6],
    } as const;
    for (const [key, [exited, inventory, profit]] of Object.entries(published)) {
      const phase = result.phases[key as keyof typeof published];
      expect(phase.exitedHead).toBeCloseTo(exited, 6);
      expect(phase.endingInventoryHead).toBeCloseTo(inventory, 6);
      expectMillions(phase.economicProfit, profit);
    }
    expectMillions(result.chainEconomicProfit, 87.7);
    expectMillions(result.chainP10, 69.7);
    expectMillions(result.chainP90, 108.0);
    expect(result.breakEvenRetailPricePerLb).toBeCloseTo(2.83, 2);
  });

  it('reproduces the rolling-entry sensitivity swings', () => {
    const published: Record<string, number> = {
      retailPrice: 15.85,
      yield: 13.64,
      feedCost: 2.35,
      wholesalePrice: 0,
      fedPrice: 5.98,
      feederPrice: 4.5,
      calfPrice: 3.4,
    };
    expectMillions(result.sensitivityBase, 93.8);
    for (const driver of result.sensitivity)
      expect(Math.round((driver.swing / MILLION) * 100) / 100).toBeCloseTo(
        published[driver.key],
        6,
      );
  });
});

describe('paper Table 4: historical retrospective (S2)', () => {
  const published: Record<number, [number, number, number]> = {
    2015: [15.7, 0.196, 6.0],
    2016: [9.2, 0.292, 5.8],
    2017: [6.7, 0.356, 5.79],
    2018: [4.8, 0.4, 5.83],
    2019: [11.2, 0.258, 5.84],
    2020: [26.3, 0.07, 6.06],
    2021: [30.3, 0.08, 6.7],
    2022: [18.4, 0.23, 7.26],
    2023: [50.7, 0.008, 7.06],
    2024: [75.7, 0, 6.87],
    2025: [146.8, 0, 6.76],
  };

  for (const year of AVAILABLE_HISTORICAL_YEARS) {
    it(`reproduces ${year} chain profit, loss probability, and retail break-even`, () => {
      const result = runSimulation(paperBaseline(year));
      const [profit, loss, breakEven] = published[year];
      expectMillions(result.chainEconomicProfit, profit);
      expect(result.chainProbabilityOfLoss).toBeCloseTo(loss, 6);
      expect(result.breakEvenRetailPricePerLb).toBeCloseTo(breakEven, 2);
    });
  }
});
