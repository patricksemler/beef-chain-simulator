/**
 * # Metrics
 *
 * ## What this file is for
 * This file helps run the simulator experience and shows the controls and results people use to test scenarios.
 *
 * ## What it does
 * - Helps the app show the right page, section, or feature.
 * - Accepts or sends data needed by the rest of the app.
 * - Keeps the code organized so it is easier to understand and update.
 *
 * ## Main pieces in this file
 * - `METRIC_REGISTRY`: the main thing this file provides to the app.
 * - Other small helper functions or values support that main work.
 *
 * ## Important tools and connections
 * - Uses project code and libraries that help the app run smoothly.
 * - Works with the rest of the simulator, dashboard, or UI layers.
 *
 * ## How data moves through it
 * Data usually comes in from a user action or from another part of the app. This file reads that information, applies the needed logic, and then sends it on or displays it on screen.
 *
 * ## Errors and edge cases
 * The code checks for missing, unusual, or invalid values and tries to handle them safely. If something is not valid, it usually falls back to a safe default or prevents the bad input from continuing.
 *
 * ## How it fits into the app
 * This file is one small part of the larger system. It connects to other sections so the app feels like one working tool instead of separate pieces.
 *
 * ## Helpful notes
 * The goal here is to keep the code simple, clear, and easy to maintain without changing how the app behaves.
 */
import historicalData from '@/lib/data/historical-scenarios.json';
import { AVAILABLE_HISTORICAL_YEARS } from '@/lib/model/historical';
import type { PhaseKey } from '@/lib/model/types';
import type { MetricDescriptor, SourceCitation, UiLocation } from './types';

const onPage = (resultPage: UiLocation['resultPage']): UiLocation => ({
  resultPage,
});
const inSection = (
  scenarioSection: UiLocation['scenarioSection'],
): UiLocation => ({ scenarioSection });

const baseMetrics: MetricDescriptor[] = [
  {
    id: 'calf_price_per_cwt',
    label: 'Weaned calf price',
    unit: '$/cwt',
    definition:
      'Annual average price used when calves leave the cow-calf stage.',
    kind: 'usda_observation',
    historicalPath: 'calfPricePerCwt',
    sourceIds: ['livestock'],
    uiLocation: inSection('prices'),
  },
  {
    id: 'feeder_price_per_cwt',
    label: 'Feeder cattle price',
    unit: '$/cwt',
    definition:
      'Annual average price used when cattle leave the stocker stage.',
    kind: 'usda_observation',
    historicalPath: 'feederPricePerCwt',
    sourceIds: ['livestock'],
    uiLocation: inSection('prices'),
  },
  {
    id: 'fed_price_per_cwt',
    label: 'Fed cattle price',
    unit: '$/cwt',
    definition:
      'Annual average live-cattle price used when cattle leave the feedlot.',
    kind: 'usda_observation',
    historicalPath: 'fedPricePerCwt',
    sourceIds: ['livestock'],
    uiLocation: inSection('prices'),
  },
  {
    id: 'wholesale_price_per_lb',
    label: 'Wholesale beef price',
    unit: '$/lb',
    definition:
      'Choice beef wholesale value used for the packer-to-retail transfer.',
    kind: 'usda_observation',
    historicalPath: 'wholesalePricePerLb',
    sourceIds: ['priceSpreads'],
    uiLocation: inSection('prices'),
  },
  {
    id: 'retail_price_per_lb',
    label: 'Retail beef price',
    unit: '$/lb',
    definition:
      'Annual average retail Choice beef value used for final retail sales.',
    kind: 'usda_observation',
    historicalPath: 'retailPricePerLb',
    sourceIds: ['priceSpreads'],
    uiLocation: inSection('prices'),
  },
  {
    id: 'feed_cost_per_ton',
    label: 'Feed cost',
    unit: '$/ton',
    definition:
      'Ration-cost assumption indexed from the USDA annual corn price. Only the feedlot stage buys feed: feed intake (lb/day) × days on feed × feed cost per ton ÷ 2,000.',
    kind: 'derived_historical_assumption',
    historicalPath: 'feedCostPerTon',
    sourceIds: ['feedGrains'],
    methodology: historicalData.methodology.feedCost,
    uiLocation: inSection('prices'),
  },
  {
    id: 'byproduct_credit_per_head',
    label: 'Byproduct credit',
    unit: '$/head',
    definition:
      'Packer revenue credit for hides, offal, and other beef byproducts.',
    kind: 'derived_historical_assumption',
    historicalPath: 'byproductCreditPerHead',
    sourceIds: ['priceSpreads'],
    methodology: historicalData.methodology.byproductCredit,
    uiLocation: inSection('prices'),
  },
  {
    id: 'dressing_percentage',
    label: 'Dressing yield',
    unit: '%',
    definition: 'Carcass weight divided by live weight after slaughter.',
    kind: 'derived_historical_assumption',
    historicalPath: 'dressingPercentage',
    sourceIds: ['livestock'],
    methodology: historicalData.methodology.dressingPercentage,
    uiLocation: inSection('yield'),
  },
  {
    id: 'saleable_yield',
    label: 'Saleable yield',
    unit: '%',
    definition: 'Share of carcass weight represented as saleable retail beef.',
    kind: 'scenario_input',
    sourceIds: ['model'],
    uiLocation: inSection('yield'),
  },
  {
    id: 'total_head',
    label: 'Calves entering',
    unit: 'head',
    definition:
      'Total calves allocated across the selected simulation horizon.',
    kind: 'scenario_input',
    sourceIds: ['model'],
    uiLocation: {},
  },
  {
    id: 'chain_economic_profit',
    label: 'Total profit',
    unit: '$',
    definition:
      'Chain economic profit: revenue plus ending inventory value, minus acquisition, direct, and overhead (economic) costs, summed across all five stages. Median across Monte Carlo runs.',
    kind: 'simulation_output',
    sourceIds: ['model'],
    uiLocation: onPage('profit'),
  },
  {
    id: 'chain_operating_contribution',
    label: 'Cash profit',
    unit: '$',
    definition:
      'Chain contribution before overhead (economic) costs: revenue plus ending inventory value, minus acquisition and direct costs.',
    kind: 'simulation_output',
    sourceIds: ['model'],
    uiLocation: onPage('profit'),
  },
  {
    id: 'chain_profit_range',
    label: 'Total profit range (P10–P90)',
    unit: '$',
    definition:
      'Tenth and ninetieth percentiles of total profit across Monte Carlo runs; the bar under the headline number.',
    kind: 'simulation_output',
    sourceIds: ['model'],
    uiLocation: onPage('profit'),
  },
  {
    id: 'chain_probability_of_loss',
    label: 'Chance of a loss',
    unit: '%',
    definition: 'Share of Monte Carlo runs with negative total profit.',
    kind: 'simulation_output',
    sourceIds: ['model'],
    uiLocation: onPage('profit'),
  },
  {
    id: 'completed_head',
    label: 'Cattle finished',
    unit: 'head',
    definition:
      'Median number of cattle that complete every stage and are sold at retail within the time period.',
    kind: 'simulation_output',
    sourceIds: ['model'],
    uiLocation: onPage('profit'),
  },
  {
    id: 'retail_pounds',
    label: 'Beef produced',
    unit: 'lb',
    definition: 'Modeled pounds of saleable beef sold at the retail stage.',
    kind: 'simulation_output',
    sourceIds: ['model'],
    uiLocation: onPage('profit'),
  },
  {
    id: 'mortality_head',
    label: 'Mortality (Died)',
    unit: 'head',
    definition: 'Median modeled cattle deaths across the supply chain.',
    kind: 'simulation_output',
    sourceIds: ['model'],
    uiLocation: onPage('flow'),
  },
  {
    id: 'ending_inventory_head',
    label: 'Still in chain (Still being raised)',
    unit: 'head',
    definition:
      'Cattle still in production when the time period ends. They are valued at their current stage price as ending inventory rather than sold.',
    kind: 'simulation_output',
    sourceIds: ['model'],
    uiLocation: onPage('flow'),
  },
  {
    id: 'break_even_retail_price_per_lb',
    label: 'Break-even beef price',
    unit: '$/lb',
    definition:
      'Retail price that would bring total (chain) profit to zero, holding everything else constant.',
    kind: 'simulation_output',
    sourceIds: ['model'],
    uiLocation: {},
  },
  {
    id: 'break_even_fed_price_per_cwt',
    label: 'Break-even cattle price',
    unit: '$/cwt',
    definition:
      'Fed-cattle price that would bring feedlot economic profit to zero, holding everything else constant.',
    kind: 'simulation_output',
    sourceIds: ['model'],
    uiLocation: {},
  },
];

export const PHASES: Array<{ key: PhaseKey; id: string; label: string }> = [
  { key: 'cowCalf', id: 'cow_calf', label: 'Cow-calf' },
  { key: 'stocker', id: 'stocker', label: 'Stocker' },
  { key: 'feedlot', id: 'feedlot', label: 'Feedlot' },
  { key: 'packer', id: 'packer', label: 'Packer' },
  { key: 'retail', id: 'retail', label: 'Retail' },
];

const phaseMetrics = PHASES.flatMap<MetricDescriptor>(({ key, id, label }) => [
  {
    id: `${id}_economic_profit`,
    label: `${label} profit`,
    unit: '$',
    definition: `${label} revenue plus ending inventory value, minus acquisition, direct, and overhead costs.`,
    kind: 'simulation_output',
    sourceIds: ['model'],
    uiLocation: onPage('profit'),
  },
  {
    id: `${id}_margin`,
    label: `${label} margin`,
    unit: '%',
    definition: `${label} profit divided by ${label.toLowerCase()} revenue plus ending inventory value.`,
    kind: 'simulation_output',
    sourceIds: ['model'],
    uiLocation: onPage('details'),
  },
  {
    id: `${id}_direct_cost_per_head`,
    label: `${label} direct cost`,
    unit: '$/head',
    definition: `One-time per-head cost charged in the ${label.toLowerCase()} stage.`,
    kind: 'derived_historical_assumption',
    historicalPath: `phases.${key}.directCostPerHead`,
    sourceIds: ['cowCalf'],
    methodology: historicalData.methodology.phaseCosts,
    uiLocation: inSection('biology'),
  },
]);

export const METRIC_REGISTRY: readonly MetricDescriptor[] = [
  ...baseMetrics,
  ...phaseMetrics,
].map((metric) => ({
  ...metric,
  sourceIds:
    metric.kind === 'simulation_output'
      ? ['model', 'livestock', 'priceSpreads', 'cowCalf', 'feedGrains']
      : metric.sourceIds,
}));

export const METRIC_BY_ID = new Map(
  METRIC_REGISTRY.map((metric) => [metric.id, metric]),
);

const sourceData = historicalData.sources as Record<
  string,
  {
    label: string;
    organization: string;
    landingPage: string;
  }
>;

export const SOURCE_REGISTRY: Record<string, SourceCitation> = {
  ...Object.fromEntries(
    Object.entries(sourceData).map(([id, source]) => [
      id,
      {
        id,
        label: source.label,
        organization: source.organization,
        url: source.landingPage,
      },
    ]),
  ),
  model: {
    id: 'model',
    label: 'Beef Chain Simulator model',
    organization: 'U.S. Beef Supply Chain Dashboard',
    methodology:
      'Scenario result produced by the dashboard model; it is not a USDA-reported statistic or forecast.',
  },
};

export const HISTORICAL_YEARS = [...AVAILABLE_HISTORICAL_YEARS];
