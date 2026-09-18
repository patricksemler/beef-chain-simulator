import historicalData from '@/lib/data/historical-scenarios.json';
import {
  historicalDataVintage,
  isHistoricalYear,
} from '@/lib/model/historical';
import type { ScenarioInput, SimulationSummary } from '@/lib/model/types';
import {
  HISTORICAL_YEARS,
  METRIC_BY_ID,
  SOURCE_REGISTRY,
  UI_ITEM_REGISTRY,
} from './metrics';
import type {
  DashboardSnapshot,
  DashboardSnapshotSection,
  SourceCitation,
} from './types';

function readPath(value: unknown, path: string | undefined): unknown {
  if (!path) return undefined;
  return path.split('.').reduce<unknown>((current, key) => {
    if (current === null || typeof current !== 'object') return undefined;
    return (current as Record<string, unknown>)[key];
  }, value);
}

function citationsFor(sourceIds: string[], methodology?: string) {
  return sourceIds
    .map((id) => SOURCE_REGISTRY[id])
    .filter((source): source is SourceCitation => source !== undefined)
    .map((source) =>
      methodology && !source.methodology ? { ...source, methodology } : source,
    );
}

function compactScenario(scenario: ScenarioInput) {
  return {
    referenceYear: scenario.referenceYear,
    totalHead: scenario.totalHead,
    horizonMonths: scenario.horizonMonths,
    cadence: scenario.cadence,
    seed: scenario.seed,
    trials: scenario.trials,
    biologicalVariation: scenario.biologicalVariation,
    startWeight: scenario.startWeight,
    prices: {
      calfPricePerCwt: scenario.calfPricePerCwt,
      feederPricePerCwt: scenario.feederPricePerCwt,
      fedPricePerCwt: scenario.fedPricePerCwt,
      wholesalePricePerLb: scenario.wholesalePricePerLb,
      retailPricePerLb: scenario.retailPricePerLb,
      feedCostPerTon: scenario.feedCostPerTon,
      byproductCreditPerHead: scenario.byproductCreditPerHead,
    },
    yields: {
      dressingPercentage: scenario.dressingPercentage,
      saleableYield: scenario.saleableYield,
      feedDryMatterLbPerDay: scenario.feedDryMatterLbPerDay,
    },
    trends: {
      annualCattlePriceTrend: scenario.annualCattlePriceTrend,
      annualWholesalePriceTrend: scenario.annualWholesalePriceTrend,
      annualRetailPriceTrend: scenario.annualRetailPriceTrend,
      annualFeedCostTrend: scenario.annualFeedCostTrend,
    },
    phases: scenario.phases,
    marketRisk: scenario.marketRisk,
  };
}

export function hasStaleDisplayedResult(
  draftScenario: ScenarioInput,
  displayedResult: SimulationSummary | null,
) {
  return (
    displayedResult !== null &&
    JSON.stringify(draftScenario) !== JSON.stringify(displayedResult.scenario)
  );
}

function headline(result: SimulationSummary) {
  return {
    chainEconomicProfit: result.chainEconomicProfit,
    chainOperatingContribution: result.chainOperatingContribution,
    chainP10: result.chainP10,
    chainP90: result.chainP90,
    chainProbabilityOfLoss: result.chainProbabilityOfLoss,
    completedHead: result.completedHead,
    retailPounds: result.retailPounds,
  };
}

export function selectDashboardSnapshot(
  snapshot: DashboardSnapshot,
  sections: DashboardSnapshotSection[],
) {
  const result = snapshot.displayedResult;
  const selected: Record<string, unknown> = {
    snapshotId: snapshot.id,
    capturedAt: snapshot.capturedAt,
  };
  for (const section of sections) {
    if (section === 'status') {
      selected.status = {
        isStale: snapshot.isStale,
        isRunning: snapshot.isRunning,
        activeResultsPage: snapshot.activeResultsPage,
        openScenarioSections: snapshot.openScenarioSections,
        displayedReferenceYear: result?.scenario.referenceYear ?? null,
        draftReferenceYear: snapshot.draftScenario.referenceYear,
      };
    }
    if (section === 'inputs') {
      selected.draftInputs = compactScenario(snapshot.draftScenario);
      selected.displayedInputs = result
        ? compactScenario(result.scenario)
        : null;
    }
    if (section === 'headline')
      selected.headline = result ? headline(result) : null;
    if (section === 'phases') selected.phases = result?.phases ?? null;
    if (section === 'flow') {
      selected.flow = result
        ? {
            totalStartedHead: result.totalStartedHead,
            completedHead: result.completedHead,
            mortalityHead: result.mortalityHead,
            endingInventoryHead: result.endingInventoryHead,
            retailPounds: result.retailPounds,
          }
        : null;
    }
    if (section === 'details') {
      selected.details = result
        ? {
            breakEvenRetailPricePerLb: result.breakEvenRetailPricePerLb,
            breakEvenFedPricePerCwt: result.breakEvenFedPricePerCwt,
            reconciliationDifference: result.reconciliationDifference,
            runtimeMs: result.runtimeMs,
          }
        : null;
    }
    if (section === 'monthly') selected.monthly = result?.monthly ?? null;
    if (section === 'sensitivity') {
      selected.sensitivity = result
        ? { base: result.sensitivityBase, drivers: result.sensitivity }
        : null;
    }
  }
  return selected;
}

export function getMetricValues(
  snapshot: DashboardSnapshot,
  metricIds: string[],
  years: number[] | null,
) {
  return metricIds.map((metricId) => {
    const metric = METRIC_BY_ID.get(metricId);
    if (!metric) return { metricId, error: 'Unknown metric ID.' };
    const values = years
      ? years.map((year) => {
          if (!isHistoricalYear(year) || !metric.historicalPath) {
            return { year, value: null, available: false };
          }
          const profile =
            historicalData.years[
              String(year) as keyof typeof historicalData.years
            ];
          return {
            year,
            value: readPath(profile, metric.historicalPath) ?? null,
            available: true,
          };
        })
      : [
          {
            context: 'draft_input',
            value:
              readPath(snapshot.draftScenario, metric.scenarioPath) ?? null,
          },
          {
            context: 'displayed_result',
            value:
              readPath(snapshot.displayedResult, metric.resultPath) ??
              readPath(
                snapshot.displayedResult?.scenario,
                metric.scenarioPath,
              ) ??
              null,
          },
        ];
    return {
      metricId,
      label: metric.label,
      unit: metric.unit,
      kind: metric.kind,
      values,
      dataVintage:
        years?.map((year) =>
          isHistoricalYear(year) ? historicalDataVintage(year) : null,
        ) ??
        snapshot.displayedResult?.dataVintage ??
        null,
      sources: citationsFor(metric.sourceIds, metric.methodology),
    };
  });
}

export function getMetricHistory(
  metricId: string,
  startYear: number | null,
  endYear: number | null,
) {
  const metric = METRIC_BY_ID.get(metricId);
  if (!metric) return { metricId, error: 'Unknown metric ID.' };
  if (!metric.historicalPath) {
    return { metricId, error: 'This metric has no historical USDA series.' };
  }
  const start = startYear ?? HISTORICAL_YEARS[0];
  const end = endYear ?? HISTORICAL_YEARS[HISTORICAL_YEARS.length - 1];
  const years = HISTORICAL_YEARS.filter((year) => year >= start && year <= end);
  return {
    metricId,
    label: metric.label,
    unit: metric.unit,
    values: years.map((year) => ({
      year,
      value: readPath(
        historicalData.years[String(year) as keyof typeof historicalData.years],
        metric.historicalPath,
      ),
      dataVintage: historicalDataVintage(year),
    })),
    sources: citationsFor(metric.sourceIds, metric.methodology),
  };
}

export function getMetricDefinitions(metricIds: string[]) {
  return metricIds.map((metricId) => {
    const metric = METRIC_BY_ID.get(metricId);
    return metric
      ? {
          metricId,
          label: metric.label,
          unit: metric.unit,
          definition: metric.definition,
          kind: metric.kind,
          supportedYears: metric.supportedYears,
          methodology: metric.methodology ?? null,
        }
      : { metricId, error: 'Unknown metric ID.' };
  });
}

export function getMetricSources(metricIds: string[]) {
  return metricIds.map((metricId) => {
    const metric = METRIC_BY_ID.get(metricId);
    return metric
      ? {
          metricId,
          label: metric.label,
          sources: citationsFor(metric.sourceIds, metric.methodology),
        }
      : { metricId, error: 'Unknown metric ID.' };
  });
}

export function locateDashboardItems(itemIds: string[]) {
  return itemIds.map((itemId) => {
    const target = UI_ITEM_REGISTRY.get(itemId);
    return target
      ? {
          itemId,
          target,
          action: {
            type: 'navigate' as const,
            label: `Open ${target.label}`,
            target,
          },
        }
      : { itemId, error: 'Unknown dashboard item ID.' };
  });
}
