import { applyHistoricalYear, isHistoricalYear } from '@/lib/model/historical';
import { runSimulation, validateScenario } from '@/lib/model/simulate';
import type { ScenarioInput, SimulationSummary } from '@/lib/model/types';
import { METRIC_BY_ID } from './metrics';
import type {
  DashboardSnapshot,
  ScenarioChange,
  ScenarioVariantRequest,
} from './types';

const EDITABLE_PATHS = new Set([
  'referenceYear',
  'totalHead',
  'horizonMonths',
  'cadence',
  'customCadence',
  'seed',
  'trials',
  'biologicalVariation',
  'startWeight',
  'calfPricePerCwt',
  'feederPricePerCwt',
  'fedPricePerCwt',
  'wholesalePricePerLb',
  'retailPricePerLb',
  'feedCostPerTon',
  'byproductCreditPerHead',
  'dressingPercentage',
  'saleableYield',
  'feedDryMatterLbPerDay',
  'annualCattlePriceTrend',
  'annualWholesalePriceTrend',
  'annualRetailPriceTrend',
  'annualFeedCostTrend',
  ...['cowCalf', 'stocker', 'feedlot', 'packer', 'retail'].flatMap((phase) =>
    [
      'durationDays',
      'averageDailyGain',
      'mortalityRate',
      'directCostPerHead',
      'dailyCostPerHead',
      'economicCostPerHead',
    ].map((field) => `phases.${phase}.${field}`),
  ),
  ...[
    'calfVolatility',
    'feederVolatility',
    'fedVolatility',
    'wholesaleVolatility',
    'retailVolatility',
    'feedVolatility',
    'commonMarketCorrelation',
  ].map((field) => `marketRisk.${field}`),
]);

function readPath(value: unknown, path: string | undefined): unknown {
  if (!path) return undefined;
  return path.split('.').reduce<unknown>((current, key) => {
    if (current === null || typeof current !== 'object') return undefined;
    return (current as Record<string, unknown>)[key];
  }, value);
}

function writePath(target: object, path: string, value: unknown) {
  const keys = path.split('.');
  let current = target as Record<string, unknown>;
  for (const key of keys.slice(0, -1)) {
    const next = current[key];
    if (next === null || typeof next !== 'object') {
      throw new Error(`Cannot update ${path}.`);
    }
    current = next as Record<string, unknown>;
  }
  current[keys[keys.length - 1]] = value;
}

export function applyScenarioChanges(
  scenario: ScenarioInput,
  changes: ScenarioChange[],
) {
  let next = structuredClone(scenario);
  for (const change of changes) {
    if (!EDITABLE_PATHS.has(change.path)) {
      throw new Error(
        `Setting ${change.path} cannot be changed by the assistant.`,
      );
    }
    if (change.path === 'referenceYear') {
      const year = Number(change.value);
      if (!isHistoricalYear(year))
        throw new Error('Unsupported reference year.');
      next = applyHistoricalYear(next, year);
      continue;
    }
    if (change.path === 'cadence') {
      if (
        typeof change.value !== 'string' ||
        !['even', 'upfront', 'spring', 'fall', 'custom'].includes(change.value)
      ) {
        throw new Error('Cadence must be a supported entry schedule.');
      }
    } else if (change.path === 'customCadence') {
      if (
        !Array.isArray(change.value) ||
        change.value.length !== 12 ||
        change.value.some((value) => !Number.isFinite(value) || value < 0)
      ) {
        throw new Error('Custom cadence must contain 12 non-negative numbers.');
      }
    } else if (
      typeof change.value !== 'number' ||
      !Number.isFinite(change.value)
    ) {
      throw new Error(`${change.path} must be a finite number.`);
    }
    writePath(next, change.path, change.value);
  }
  const errors = validateScenario(next);
  if (errors.length) throw new Error(errors.join(' '));
  return next;
}

export function scenarioChangeDiff(
  scenario: ScenarioInput,
  changes: ScenarioChange[],
) {
  const next = applyScenarioChanges(scenario, changes);
  return changes.map((change) => ({
    path: change.path,
    before: readPath(scenario, change.path),
    after: readPath(next, change.path),
  }));
}

function metricValue(result: SimulationSummary, metricId: string) {
  const metric = METRIC_BY_ID.get(metricId);
  if (!metric?.resultPath) return null;
  const value = readPath(result, metric.resultPath);
  return typeof value === 'number' ? value : null;
}

export function compareScenarioVariants(
  snapshot: DashboardSnapshot,
  base: 'draft' | 'displayed',
  variants: ScenarioVariantRequest[],
  outputMetricIds: string[],
) {
  if (variants.length > 3)
    throw new Error('At most three variants are allowed.');
  const baseScenario =
    base === 'displayed'
      ? snapshot.displayedResult?.scenario
      : snapshot.draftScenario;
  if (!baseScenario) throw new Error('No displayed result is available.');
  const baseResult = runSimulation(structuredClone(baseScenario));
  const baseValues = Object.fromEntries(
    outputMetricIds.map((metricId) => [
      metricId,
      metricValue(baseResult, metricId),
    ]),
  );
  return {
    base: {
      referenceYear: baseScenario.referenceYear,
      values: baseValues,
    },
    variants: variants.map((variant) => {
      let scenario = structuredClone(baseScenario);
      if (variant.referenceYear !== null) {
        if (!isHistoricalYear(variant.referenceYear)) {
          throw new Error(
            `Unsupported reference year ${variant.referenceYear}.`,
          );
        }
        scenario = applyHistoricalYear(scenario, variant.referenceYear);
      }
      scenario = applyScenarioChanges(scenario, variant.changes);
      const result = runSimulation(scenario);
      const values = Object.fromEntries(
        outputMetricIds.map((metricId) => {
          const value = metricValue(result, metricId);
          const baseline = baseValues[metricId];
          return [
            metricId,
            {
              value,
              absoluteDelta:
                value !== null && typeof baseline === 'number'
                  ? value - baseline
                  : null,
              percentageDelta:
                value !== null && typeof baseline === 'number' && baseline !== 0
                  ? (value - baseline) / Math.abs(baseline)
                  : null,
            },
          ];
        }),
      );
      return {
        label: variant.label,
        referenceYear: scenario.referenceYear,
        values,
      };
    }),
  };
}
