/**
 * # Validation.Historical.Test
 *
 * ## What this file is for
 * Checks the 2015-2025 USDA reference-year profiles: that each year is
 * complete, that values sit in plausible ranges, that every derived input can
 * be recomputed from the USDA source metrics stored beside it, and that the
 * market trends page and the simulator read the same numbers.
 *
 * ## What it does not check
 * The stored source metrics are not compared with USDA publications here.
 * These tests confirm the pipeline's arithmetic and the data's completeness,
 * not that the downloaded USDA values are themselves correct.
 */
import { describe, expect, it } from 'vitest';
import historicalData from '../lib/data/historical-scenarios.json';
import {
  applyHistoricalYear,
  AVAILABLE_HISTORICAL_YEARS,
  getHistoricalProfile,
  LATEST_HISTORICAL_YEAR,
} from '../lib/model/historical';
import { PHASE_ORDER } from '../lib/model/phases';
import { runSimulation } from '../lib/model/simulate';
import {
  ALL_SERIES,
  DATA_SOURCES,
  indexRows,
  percentChange,
  ROWS,
  SERIES_SUMMARY,
  yearOverYear,
} from '../lib/trends/series';
import { cohortScenario } from './validation-helpers';

const latest = getHistoricalProfile(LATEST_HISTORICAL_YEAR);

/** Plausible bounds for 2015-2025 US annual means (inclusive). */
const RANGES = {
  calfPricePerCwt: [100, 600],
  feederPricePerCwt: [100, 500],
  fedPricePerCwt: [80, 300],
  wholesalePricePerLb: [2, 8],
  retailPricePerLb: [4, 15],
  feedCostPerTon: [100, 500],
  byproductCreditPerHead: [50, 300],
  dressingPercentage: [0.58, 0.65],
} as const;

describe('reference-year completeness', () => {
  it('has one profile for each year from 2015 through 2025 and no others', () => {
    expect(Object.keys(historicalData.years).map(Number)).toEqual([
      ...AVAILABLE_HISTORICAL_YEARS,
    ]);
    expect(AVAILABLE_HISTORICAL_YEARS).toHaveLength(11);
    for (const year of AVAILABLE_HISTORICAL_YEARS)
      expect(getHistoricalProfile(year).year).toBe(year);
  });

  it('gives every year a finite, positive value for every price and cost', () => {
    for (const year of AVAILABLE_HISTORICAL_YEARS) {
      const profile = getHistoricalProfile(year);
      for (const key of Object.keys(RANGES) as Array<keyof typeof RANGES>) {
        expect(Number.isFinite(profile[key]), `${year} ${key}`).toBe(true);
        expect(profile[key], `${year} ${key}`).toBeGreaterThan(0);
      }
      for (const phase of PHASE_ORDER) {
        const costs = profile.phases[phase];
        for (const value of Object.values(costs)) {
          expect(Number.isFinite(value)).toBe(true);
          expect(value).toBeGreaterThanOrEqual(0);
        }
      }
      for (const value of Object.values(profile.sourceMetrics))
        expect(value).toBeGreaterThan(0);
    }
  });

  it('keeps every value inside a plausible range for the period', () => {
    for (const year of AVAILABLE_HISTORICAL_YEARS) {
      const profile = getHistoricalProfile(year);
      for (const [key, [low, high]] of Object.entries(RANGES)) {
        const value = profile[key as keyof typeof RANGES];
        expect(value, `${year} ${key}`).toBeGreaterThanOrEqual(low);
        expect(value, `${year} ${key}`).toBeLessThanOrEqual(high);
      }
      expect(profile.gradePriceIndex.prime).toBeGreaterThan(1);
      expect(profile.gradePriceIndex.prime).toBeLessThan(1.6);
      expect(profile.gradePriceIndex.select).toBeGreaterThan(0.85);
      expect(profile.gradePriceIndex.select).toBeLessThan(1);
    }
  });

  it('keeps the expected price ordering along the chain in every year', () => {
    for (const year of AVAILABLE_HISTORICAL_YEARS) {
      const profile = getHistoricalProfile(year);
      // Lighter cattle sell for more per cwt; retail sells above wholesale.
      expect(profile.calfPricePerCwt).toBeGreaterThan(profile.feederPricePerCwt);
      expect(profile.feederPricePerCwt).toBeGreaterThan(profile.fedPricePerCwt);
      expect(profile.retailPricePerLb).toBeGreaterThan(
        profile.wholesalePricePerLb,
      );
    }
  });

  it('has no year-to-year change in any input larger than 60%', () => {
    for (let index = 1; index < AVAILABLE_HISTORICAL_YEARS.length; index += 1) {
      const previous = getHistoricalProfile(AVAILABLE_HISTORICAL_YEARS[index - 1]);
      const current = getHistoricalProfile(AVAILABLE_HISTORICAL_YEARS[index]);
      for (const key of Object.keys(RANGES) as Array<keyof typeof RANGES>)
        expect(
          Math.abs(current[key] / previous[key] - 1),
          `${current.year} ${key}`,
        ).toBeLessThan(0.6);
    }
  });

  it('has grade shares that sum to one and records which year they come from', () => {
    for (const year of AVAILABLE_HISTORICAL_YEARS) {
      const profile = getHistoricalProfile(year);
      const { prime, choice, select } = profile.gradeMix;
      expect(prime + choice + select).toBeCloseTo(1, 6);
      expect(profile.gradeMixYear).toBeLessThanOrEqual(year);
      expect(profile.gradeMixYear).toBe(year === 2025 ? 2024 : year);
    }
  });
});

describe('source information', () => {
  it('names a USDA source with a landing page and download for every input', () => {
    expect(DATA_SOURCES.length).toBeGreaterThanOrEqual(5);
    for (const source of Object.values(historicalData.sources)) {
      expect(source.organization).toMatch(/^USDA /);
      expect(source.label.length).toBeGreaterThan(0);
      expect(source.landingPage).toMatch(/^https:\/\/[^/]*usda\.gov\//);
      if ('downloadUrl' in source)
        expect(String(source.downloadUrl)).toMatch(/^https:\/\//);
    }
  });

  it('documents the method behind every derived input and the build date', () => {
    for (const key of [
      'annualPrices',
      'feedCost',
      'phaseCosts',
      'byproductCredit',
      'dressingPercentage',
      'retailPrice',
      'gradeMix',
      'gradePriceIndex',
    ])
      expect(
        historicalData.methodology[key as keyof typeof historicalData.methodology]
          .length,
      ).toBeGreaterThan(20);
    expect(Number.isNaN(Date.parse(historicalData.generatedAt))).toBe(false);
  });
});

describe('independent recalculation of derived inputs', () => {
  // Each profile stores the USDA source values it was built from. Rebuilding the
  // model inputs from them checks the pipeline's arithmetic year by year.
  const base = latest.sourceMetrics;
  // Source metrics are stored to the cent, so an index built from two of them
  // carries up to half a cent of rounding in each, plus rounding of the output.
  const tolerance = (value: number, numerator: number, denominator: number) =>
    0.005 + Math.abs(value) * (0.005 / numerator + 0.005 / denominator);

  it('converts USDA retail and wholesale cents per pound to dollars', () => {
    for (const year of AVAILABLE_HISTORICAL_YEARS) {
      const profile = getHistoricalProfile(year);
      const metrics = profile.sourceMetrics;
      expect(profile.retailPricePerLb).toBeCloseTo(
        metrics.choiceBeefRetailCentsPerLb / 100,
        3,
      );
      expect(profile.wholesalePricePerLb).toBeCloseTo(
        metrics.choiceBeefWholesaleCentsPerRetailLb / 100,
        3,
      );
    }
  });

  it('indexes ration cost by corn price and byproduct credit by byproduct value', () => {
    for (const year of AVAILABLE_HISTORICAL_YEARS) {
      const profile = getHistoricalProfile(year);
      const metrics = profile.sourceMetrics;
      const feed =
        latest.feedCostPerTon *
        (metrics.cornPricePerBushel / base.cornPricePerBushel);
      expect(Math.abs(profile.feedCostPerTon - feed)).toBeLessThanOrEqual(
        tolerance(feed, metrics.cornPricePerBushel, base.cornPricePerBushel),
      );
      const byproduct =
        latest.byproductCreditPerHead *
        (metrics.choiceBeefByproductCentsPerRetailLb /
          base.choiceBeefByproductCentsPerRetailLb);
      expect(
        Math.abs(profile.byproductCreditPerHead - byproduct),
      ).toBeLessThanOrEqual(
        tolerance(
          byproduct,
          metrics.choiceBeefByproductCentsPerRetailLb,
          base.choiceBeefByproductCentsPerRetailLb,
        ),
      );
    }
  });

  it('indexes every stage cost by the ERS cow-calf cost series', () => {
    for (const year of AVAILABLE_HISTORICAL_YEARS) {
      const profile = getHistoricalProfile(year);
      const metrics = profile.sourceMetrics;
      const operating =
        metrics.cowCalfOperatingCostPerCow / base.cowCalfOperatingCostPerCow;
      const overhead =
        metrics.cowCalfAllocatedOverheadPerCow /
        base.cowCalfAllocatedOverheadPerCow;
      const within = (actual: number, expected: number, overheadSeries: boolean) =>
        Math.abs(actual - expected) <=
        tolerance(
          expected,
          overheadSeries
            ? metrics.cowCalfAllocatedOverheadPerCow
            : metrics.cowCalfOperatingCostPerCow,
          overheadSeries
            ? base.cowCalfAllocatedOverheadPerCow
            : base.cowCalfOperatingCostPerCow,
        );
      for (const phase of PHASE_ORDER) {
        const costs = profile.phases[phase];
        const reference = latest.phases[phase];
        expect(
          within(costs.directCostPerHead, reference.directCostPerHead * operating, false),
          `${year} ${phase} direct`,
        ).toBe(true);
        expect(
          within(costs.dailyCostPerHead, reference.dailyCostPerHead * operating, false),
          `${year} ${phase} daily`,
        ).toBe(true);
        expect(
          within(
            costs.economicCostPerHead,
            reference.economicCostPerHead * overhead,
            true,
          ),
          `${year} ${phase} overhead`,
        ).toBe(true);
      }
    }
  });
});

describe('market trends page', () => {
  it('shows the same prices the simulator loads for each year', () => {
    expect(ROWS.map((row) => row.year)).toEqual([...AVAILABLE_HISTORICAL_YEARS]);
    for (const row of ROWS) {
      const loaded = applyHistoricalYear(cohortScenario(), row.year as 2025);
      for (const key of ALL_SERIES) expect(row[key]).toBe(loaded[key]);
    }
  });

  it('rebases every series to 100 in 2015 and preserves relative movements', () => {
    const indexed = indexRows(ROWS);
    for (const key of ALL_SERIES) {
      expect(indexed[0][key]).toBeCloseTo(100, 10);
      for (let index = 0; index < ROWS.length; index += 1)
        expect(indexed[index][key]).toBeCloseTo(
          (ROWS[index][key] / ROWS[0][key]) * 100,
          10,
        );
    }
  });

  it('reports year-over-year and decade changes that agree with the raw series', () => {
    for (const key of ALL_SERIES) {
      expect(yearOverYear(key, 0)).toBeNull();
      let compounded = 1;
      for (let index = 1; index < ROWS.length; index += 1)
        compounded *= 1 + (yearOverYear(key, index) as number) / 100;
      expect((compounded - 1) * 100).toBeCloseTo(
        SERIES_SUMMARY[key].decadeChange,
        8,
      );
      expect(SERIES_SUMMARY[key].decadeChange).toBeCloseTo(
        percentChange(ROWS[0][key], ROWS[ROWS.length - 1][key]),
        10,
      );
      expect(SERIES_SUMMARY[key].latest).toBe(ROWS[ROWS.length - 1][key]);
    }
  });
});

describe('simulating every reference year', () => {
  it('runs each year with reconciled head, finite results, and segment totals that sum', () => {
    const chainProfits: number[] = [];
    for (const year of AVAILABLE_HISTORICAL_YEARS) {
      const result = runSimulation(cohortScenario(year));
      const segments = PHASE_ORDER.reduce(
        (sum, key) => sum + result.phases[key].economicProfit,
        0,
      );
      expect(result.dataVintage).toBe(`Based on ${year} USDA annual averages`);
      expect(result.scenario.referenceYear).toBe(year);
      expect(result.reconciliationDifference).toBeCloseTo(0, 6);
      expect(segments).toBeCloseTo(result.chainEconomicProfit, 4);
      expect(Number.isFinite(result.breakEvenRetailPricePerLb)).toBe(true);
      expect(result.breakEvenRetailPricePerLb).toBeGreaterThan(0);
      chainProfits.push(result.chainEconomicProfit);
    }
    expect(new Set(chainProfits).size).toBe(chainProfits.length);
  });

  it('changes only data-backed inputs when a year is loaded', () => {
    const scenario = cohortScenario();
    scenario.totalHead = 54_321;
    scenario.seed = 99;
    scenario.biologicalVariation = 0.11;
    scenario.phases.feedlot.durationDays = 200;
    scenario.phases.stocker.mortalityRate = 0.02;
    scenario.annualRetailPriceTrend = 0.05;
    for (const year of AVAILABLE_HISTORICAL_YEARS) {
      const loaded = applyHistoricalYear(scenario, year);
      expect(loaded.totalHead).toBe(54_321);
      expect(loaded.seed).toBe(99);
      expect(loaded.biologicalVariation).toBe(0.11);
      expect(loaded.phases.feedlot.durationDays).toBe(200);
      expect(loaded.phases.stocker.mortalityRate).toBe(0.02);
      expect(loaded.annualRetailPriceTrend).toBe(0.05);
      expect(loaded.marketRisk).toEqual(scenario.marketRisk);
    }
    // The original object is never modified.
    expect(scenario.referenceYear).toBe(LATEST_HISTORICAL_YEAR);
    expect(scenario.totalHead).toBe(54_321);
  });
});
