/**
 * # Validation.Trends.Test
 *
 * ## What this file is for
 * Checks the optional annual price trends. Prices compound monthly as
 * P(t) = P0 (1 + r)^(t / 12), where t is the month of the sale.
 *
 * ## How the checks work
 * A deterministic cohort sells all its beef in the same month, so the effect of
 * a trend can be predicted exactly. Each trend is changed on its own, one at a
 * time, against an otherwise identical scenario.
 */
import { describe, expect, it } from 'vitest';
import { PHASE_ORDER } from '../lib/model/phases';
import { runSimulation } from '../lib/model/simulate';
import type { ScenarioInput } from '../lib/model/types';
import {
  chainLengthMonths,
  cohortScenario,
  deterministicCohort,
} from './validation-helpers';

function withTrend(
  scenario: ScenarioInput,
  key:
    | 'annualCattlePriceTrend'
    | 'annualWholesalePriceTrend'
    | 'annualRetailPriceTrend'
    | 'annualFeedCostTrend',
  rate: number,
) {
  const next = structuredClone(scenario);
  next[key] = rate;
  return next;
}

/** Sums the monthly retail series into calendar years of the horizon. */
function retailByYear(monthly: { retail: number }[]) {
  const years: number[] = [];
  monthly.forEach((row, index) => {
    const year = Math.floor(index / 12);
    years[year] = (years[year] ?? 0) + row.retail;
  });
  return years;
}

describe('retail price growth', () => {
  it('compounds 12% annual retail growth exactly to the month beef is sold', () => {
    const flat = deterministicCohort();
    const growing = withTrend(flat, 'annualRetailPriceTrend', 0.12);
    const flatResult = runSimulation(flat);
    const growingResult = runSimulation(growing);
    const saleMonth = chainLengthMonths(flat);
    expect(growingResult.phases.retail.revenue).toBeCloseTo(
      flatResult.phases.retail.revenue * 1.12 ** (saleMonth / 12),
      2,
    );
  });

  it('leaves every upstream stage unchanged and adds the extra revenue to chain profit', () => {
    const flat = deterministicCohort();
    const flatResult = runSimulation(flat);
    const growingResult = runSimulation(
      withTrend(flat, 'annualRetailPriceTrend', 0.12),
    );
    for (const key of ['cowCalf', 'stocker', 'feedlot', 'packer'] as const)
      expect(growingResult.phases[key].economicProfit).toBeCloseTo(
        flatResult.phases[key].economicProfit,
        4,
      );
    const extraRevenue =
      growingResult.phases.retail.revenue - flatResult.phases.retail.revenue;
    expect(extraRevenue).toBeGreaterThan(0);
    expect(
      growingResult.chainEconomicProfit - flatResult.chainEconomicProfit,
    ).toBeCloseTo(extraRevenue, 2);
  });

  it('raises retail revenue each year by about 12% under rolling entry', () => {
    const flat = deterministicCohort();
    flat.cadence = 'even';
    flat.horizonMonths = 120;
    const growing = withTrend(flat, 'annualRetailPriceTrend', 0.12);
    const flatYears = retailByYear(runSimulation(flat).monthly);
    const growingYears = retailByYear(runSimulation(growing).monthly);
    // Years 3-10 sell beef from cattle that entered in full years of the horizon.
    for (let year = 3; year < 10; year += 1) {
      expect(growingYears[year]).toBeGreaterThan(growingYears[year - 1]);
      expect(growingYears[year] / growingYears[year - 1]).toBeCloseTo(1.12, 2);
      expect(flatYears[year] / flatYears[year - 1]).toBeCloseTo(1, 2);
    }
  });

  it('raises chain profit steadily as the retail growth rate increases', () => {
    const base = cohortScenario();
    const profits = [-0.06, -0.03, 0, 0.03, 0.06, 0.09, 0.12].map(
      (rate) =>
        runSimulation(withTrend(base, 'annualRetailPriceTrend', rate))
          .chainEconomicProfit,
    );
    for (let index = 1; index < profits.length; index += 1)
      expect(profits[index]).toBeGreaterThan(profits[index - 1]);
  });

  it('shows higher chain profit under 12% growth than 0% with price risk on', () => {
    const flat = cohortScenario();
    flat.trials = 200;
    const flatResult = runSimulation(flat);
    const growingResult = runSimulation(
      withTrend(flat, 'annualRetailPriceTrend', 0.12),
    );
    expect(growingResult.chainEconomicProfit).toBeGreaterThan(
      flatResult.chainEconomicProfit,
    );
    expect(growingResult.phases.retail.revenue).toBeGreaterThan(
      flatResult.phases.retail.revenue,
    );
    expect(growingResult.chainP10).toBeGreaterThan(flatResult.chainP10);
    expect(growingResult.chainP90).toBeGreaterThan(flatResult.chainP90);
  });
});

describe('trends between stages', () => {
  it('moves profit between stages but not chain profit when cattle prices trend', () => {
    const flat = deterministicCohort();
    const flatResult = runSimulation(flat);
    const trended = runSimulation(withTrend(flat, 'annualCattlePriceTrend', 0.12));
    expect(trended.chainEconomicProfit).toBeCloseTo(
      flatResult.chainEconomicProfit,
      2,
    );
    expect(trended.phases.cowCalf.economicProfit).toBeGreaterThan(
      flatResult.phases.cowCalf.economicProfit,
    );
    expect(trended.phases.packer.economicProfit).toBeLessThan(
      flatResult.phases.packer.economicProfit,
    );
  });

  it('moves profit from retail to packer but not chain profit when wholesale trends', () => {
    const flat = deterministicCohort();
    const flatResult = runSimulation(flat);
    const trended = runSimulation(
      withTrend(flat, 'annualWholesalePriceTrend', 0.12),
    );
    const packerGain =
      trended.phases.packer.economicProfit -
      flatResult.phases.packer.economicProfit;
    const retailLoss =
      flatResult.phases.retail.economicProfit -
      trended.phases.retail.economicProfit;
    expect(packerGain).toBeGreaterThan(0);
    expect(packerGain).toBeCloseTo(retailLoss, 2);
    expect(trended.chainEconomicProfit).toBeCloseTo(
      flatResult.chainEconomicProfit,
      2,
    );
  });

  it('lowers feedlot and chain profit by the compounded ration cost when feed trends up', () => {
    const flat = deterministicCohort();
    const flatResult = runSimulation(flat);
    const trended = runSimulation(withTrend(flat, 'annualFeedCostTrend', 0.12));
    // Ration is priced at the month the feedlot stage starts.
    const feedlotStart =
      (flat.phases.cowCalf.durationDays + flat.phases.stocker.durationDays) /
      30.4375;
    const ration =
      (flat.feedDryMatterLbPerDay *
        flat.phases.feedlot.durationDays *
        flat.feedCostPerTon *
        flat.totalHead) /
      2_000;
    const expectedLoss = ration * (1.12 ** (feedlotStart / 12) - 1);
    expect(
      flatResult.chainEconomicProfit - trended.chainEconomicProfit,
    ).toBeCloseTo(expectedLoss, 2);
    for (const key of PHASE_ORDER.filter((key) => key !== 'feedlot'))
      expect(trended.phases[key].economicProfit).toBeCloseTo(
        flatResult.phases[key].economicProfit,
        4,
      );
  });

  it('leaves every result unchanged when all trends are zero', () => {
    const scenario = cohortScenario();
    const zero = runSimulation(scenario);
    const explicit = runSimulation({
      ...structuredClone(scenario),
      annualCattlePriceTrend: 0,
      annualWholesalePriceTrend: 0,
      annualRetailPriceTrend: 0,
      annualFeedCostTrend: 0,
    });
    expect(explicit.chainEconomicProfit).toBe(zero.chainEconomicProfit);
    expect(explicit.chainP10).toBe(zero.chainP10);
  });
});
