import { describe, expect, it } from 'vitest';
import historicalData from '../lib/data/historical-scenarios.json';
import { ASSISTANT_MODELS } from '../lib/assistant/models';
import { DOMAIN_REFUSAL } from '../lib/assistant/prompt';
import {
  HISTORICAL_YEARS,
  METRIC_REGISTRY,
  SOURCE_REGISTRY,
  UI_ITEM_REGISTRY,
} from '../lib/assistant/metrics';
import {
  applyScenarioChanges,
  compareScenarioVariants,
} from '../lib/assistant/scenarios';
import { validateRequestSchema } from '../lib/assistant/schemas';
import {
  getMetricDefinitions,
  getMetricHistory,
  getMetricSources,
  getMetricValues,
  locateDashboardItems,
  hasStaleDisplayedResult,
  selectDashboardSnapshot,
} from '../lib/assistant/tools';
import type { DashboardSnapshot } from '../lib/assistant/types';
import { cloneDefaultScenario } from '../lib/model/defaults';
import { runSimulation } from '../lib/model/simulate';

function readPath(value: unknown, path: string) {
  return path.split('.').reduce<unknown>((current, key) => {
    if (current === null || typeof current !== 'object') return undefined;
    return (current as Record<string, unknown>)[key];
  }, value);
}

function snapshot(): DashboardSnapshot {
  const scenario = cloneDefaultScenario();
  scenario.totalHead = 2_000;
  scenario.trials = 2;
  const result = runSimulation(scenario);
  return {
    id: 'snapshot-test',
    capturedAt: '2026-09-18T12:00:00.000Z',
    draftScenario: structuredClone(scenario),
    displayedResult: result,
    isStale: false,
    isRunning: false,
    activeResultsPage: 'profit',
    openScenarioSections: ['prices'],
  };
}

describe('assistant metric registry', () => {
  it('uses unique IDs and resolves every historical path for 2015–2025', () => {
    const ids = METRIC_REGISTRY.map((metric) => metric.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(HISTORICAL_YEARS).toEqual([
      2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025,
    ]);
    for (const metric of METRIC_REGISTRY) {
      if (!metric.historicalPath) continue;
      expect(metric.supportedYears).toEqual(HISTORICAL_YEARS);
      for (const year of HISTORICAL_YEARS) {
        const profile =
          historicalData.years[
            String(year) as keyof typeof historicalData.years
          ];
        expect(
          readPath(profile, metric.historicalPath),
          `${metric.id} in ${year}`,
        ).not.toBeUndefined();
      }
    }
  });

  it('has definitions, units, verified sources, and UI targets', () => {
    for (const metric of METRIC_REGISTRY) {
      expect(metric.definition.length).toBeGreaterThan(10);
      expect(metric.unit.length).toBeGreaterThan(0);
      expect(metric.uiLocation.elementId.length).toBeGreaterThan(0);
      for (const sourceId of metric.sourceIds) {
        const source = SOURCE_REGISTRY[sourceId];
        expect(source).toBeDefined();
        if (source.url) expect(source.url.startsWith('https://')).toBe(true);
      }
    }
    expect(UI_ITEM_REGISTRY.get('stocker_economic_profit')?.resultPage).toBe(
      'sectors',
    );
  });

  it('returns values, history, definitions, sources, and navigation actions', () => {
    const current = snapshot();
    const values = getMetricValues(current, ['stocker_economic_profit'], null);
    expect(values[0]).toMatchObject({
      metricId: 'stocker_economic_profit',
      unit: '$',
      kind: 'simulation_output',
    });
    const history = getMetricHistory('calf_price_per_cwt', 2016, 2018);
    expect('values' in history ? history.values : []).toHaveLength(3);
    expect(getMetricDefinitions(['saleable_yield'])[0]).toMatchObject({
      unit: '%',
      kind: 'scenario_input',
    });
    expect(getMetricSources(['retail_price_per_lb'])[0]).toMatchObject({
      metricId: 'retail_price_per_lb',
    });
    expect(locateDashboardItems(['details_page'])[0]).toMatchObject({
      action: { type: 'navigate', target: { resultPage: 'details' } },
    });
  });
});

describe('assistant snapshot and scenarios', () => {
  it('keeps edited inputs separate from displayed results when stale', () => {
    const current = snapshot();
    current.draftScenario.retailPricePerLb += 1;
    current.isStale = hasStaleDisplayedResult(
      current.draftScenario,
      current.displayedResult,
    );
    const selected = selectDashboardSnapshot(current, ['status', 'inputs']);
    expect(selected.status).toMatchObject({ isStale: true });
    const inputs = selected as {
      draftInputs: { prices: { retailPricePerLb: number } };
      displayedInputs: { prices: { retailPricePerLb: number } };
    };
    expect(inputs.draftInputs.prices.retailPricePerLb).not.toBe(
      inputs.displayedInputs.prices.retailPricePerLb,
    );
  });

  it('compares historical years while preserving user-owned settings', () => {
    const current = snapshot();
    current.draftScenario.totalHead = 12_345;
    current.draftScenario.seed = 99;
    current.draftScenario.trials = 2;
    current.draftScenario.marketRisk.calfVolatility = 0.17;
    const comparison = compareScenarioVariants(
      current,
      'draft',
      [
        { label: '2016', referenceYear: 2016, changes: [] },
        { label: '2018', referenceYear: 2018, changes: [] },
      ],
      ['chain_economic_profit', 'stocker_economic_profit'],
    );
    expect(comparison.variants).toHaveLength(2);
    expect(comparison.variants[0].referenceYear).toBe(2016);
    expect(
      comparison.variants[0].values.chain_economic_profit.absoluteDelta,
    ).not.toBeNull();
    expect(current.draftScenario.totalHead).toBe(12_345);
    expect(current.draftScenario.seed).toBe(99);
    expect(current.draftScenario.trials).toBe(2);
    expect(current.draftScenario.marketRisk.calfVolatility).toBe(0.17);
  });

  it('rejects extra variants, unknown fields, wrong types, and invalid values', () => {
    const current = snapshot();
    expect(() =>
      compareScenarioVariants(
        current,
        'draft',
        Array.from({ length: 4 }, (_, index) => ({
          label: String(index),
          referenceYear: null,
          changes: [],
        })),
        ['chain_economic_profit'],
      ),
    ).toThrow('At most three variants');
    expect(() =>
      applyScenarioChanges(current.draftScenario, [
        { path: 'notASetting', value: 1 },
      ]),
    ).toThrow('cannot be changed');
    expect(() =>
      applyScenarioChanges(current.draftScenario, [
        { path: 'retailPricePerLb', value: 'high' },
      ]),
    ).toThrow('finite number');
    expect(() =>
      applyScenarioChanges(current.draftScenario, [
        { path: 'totalHead', value: 0 },
      ]),
    ).toThrow('Head count');
  });
});

describe('provider allowlist', () => {
  it('accepts only the curated model for each provider', () => {
    for (const [provider, config] of Object.entries(ASSISTANT_MODELS)) {
      expect(
        validateRequestSchema.safeParse({ provider, model: config.model })
          .success,
      ).toBe(true);
      expect(
        validateRequestSchema.safeParse({ provider, model: 'arbitrary-model' })
          .success,
      ).toBe(false);
    }
    expect(
      validateRequestSchema.safeParse({
        provider: 'unknown',
        model: 'gpt-5-mini',
      }).success,
    ).toBe(false);
  });

  it('keeps the required domain refusal verbatim', () => {
    expect(DOMAIN_REFUSAL).toBe(
      'I’m limited to questions about this dashboard, U.S. beef and cattle supply chains, USDA data used here, and closely related agricultural economics.',
    );
  });
});
