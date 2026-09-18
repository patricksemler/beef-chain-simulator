import historicalData from '@/lib/data/historical-scenarios.json';
import { AVAILABLE_HISTORICAL_YEARS } from '@/lib/model/historical';
import type { PhaseKey } from '@/lib/model/types';
import type { MetricDescriptor, SourceCitation, UiLocation } from './types';

const resultLocation = (
  label: string,
  resultPage: UiLocation['resultPage'],
  elementId: string,
): UiLocation => ({ label, resultPage, elementId });

const inputLocation = (
  label: string,
  scenarioSection: UiLocation['scenarioSection'],
  elementId: string,
): UiLocation => ({ label, scenarioSection, elementId });

const baseMetrics: Array<Omit<MetricDescriptor, 'supportedYears'>> = [
  {
    id: 'calf_price_per_cwt',
    label: 'Weaned calf price',
    unit: '$/cwt',
    definition:
      'Annual average price used when calves leave the cow-calf stage.',
    kind: 'usda_observation',
    historicalPath: 'calfPricePerCwt',
    scenarioPath: 'calfPricePerCwt',
    sourceIds: ['livestock'],
    uiLocation: inputLocation('Weaned calf price', 'prices', 'calf-price'),
  },
  {
    id: 'feeder_price_per_cwt',
    label: 'Feeder cattle price',
    unit: '$/cwt',
    definition:
      'Annual average price used when cattle leave the stocker stage.',
    kind: 'usda_observation',
    historicalPath: 'feederPricePerCwt',
    scenarioPath: 'feederPricePerCwt',
    sourceIds: ['livestock'],
    uiLocation: inputLocation('Feeder cattle price', 'prices', 'feeder-price'),
  },
  {
    id: 'fed_price_per_cwt',
    label: 'Fed cattle price',
    unit: '$/cwt',
    definition:
      'Annual average live-cattle price used when cattle leave the feedlot.',
    kind: 'usda_observation',
    historicalPath: 'fedPricePerCwt',
    scenarioPath: 'fedPricePerCwt',
    sourceIds: ['livestock'],
    uiLocation: inputLocation('Fed cattle price', 'prices', 'fed-price'),
  },
  {
    id: 'wholesale_price_per_lb',
    label: 'Wholesale beef price',
    unit: '$/lb',
    definition:
      'Choice beef wholesale value used for the packer-to-retail transfer.',
    kind: 'usda_observation',
    historicalPath: 'wholesalePricePerLb',
    scenarioPath: 'wholesalePricePerLb',
    sourceIds: ['priceSpreads'],
    uiLocation: inputLocation(
      'Wholesale beef price',
      'prices',
      'wholesale-price',
    ),
  },
  {
    id: 'retail_price_per_lb',
    label: 'Retail beef price',
    unit: '$/lb',
    definition:
      'Annual average retail Choice beef value used for final retail sales.',
    kind: 'usda_observation',
    historicalPath: 'retailPricePerLb',
    scenarioPath: 'retailPricePerLb',
    sourceIds: ['priceSpreads'],
    uiLocation: inputLocation('Retail beef price', 'prices', 'retail-price'),
  },
  {
    id: 'feed_cost_per_ton',
    label: 'Feed cost',
    unit: '$/ton',
    definition:
      'Ration-cost assumption indexed from the USDA annual corn price.',
    kind: 'derived_historical_assumption',
    historicalPath: 'feedCostPerTon',
    scenarioPath: 'feedCostPerTon',
    sourceIds: ['feedGrains'],
    methodology: historicalData.methodology.feedCost,
    uiLocation: inputLocation('Feed cost', 'prices', 'feed-cost'),
  },
  {
    id: 'byproduct_credit_per_head',
    label: 'Byproduct credit',
    unit: '$/head',
    definition:
      'Packer revenue credit for hides, offal, and other beef byproducts.',
    kind: 'derived_historical_assumption',
    historicalPath: 'byproductCreditPerHead',
    scenarioPath: 'byproductCreditPerHead',
    sourceIds: ['priceSpreads'],
    methodology: historicalData.methodology.byproductCredit,
    uiLocation: inputLocation('Byproduct credit', 'prices', 'byproduct-credit'),
  },
  {
    id: 'dressing_percentage',
    label: 'Dressing percentage',
    unit: '%',
    definition: 'Carcass weight divided by live weight after slaughter.',
    kind: 'derived_historical_assumption',
    historicalPath: 'dressingPercentage',
    scenarioPath: 'dressingPercentage',
    sourceIds: ['livestock'],
    methodology: historicalData.methodology.dressingPercentage,
    uiLocation: inputLocation('Dressing percentage', 'yield', 'dressing'),
  },
  {
    id: 'saleable_yield',
    label: 'Saleable yield',
    unit: '%',
    definition: 'Share of carcass weight represented as saleable retail beef.',
    kind: 'scenario_input',
    scenarioPath: 'saleableYield',
    sourceIds: ['model'],
    uiLocation: inputLocation('Saleable yield', 'yield', 'saleable-yield'),
  },
  {
    id: 'total_head',
    label: 'Calves entering',
    unit: 'head',
    definition:
      'Total calves allocated across the selected simulation horizon.',
    kind: 'scenario_input',
    scenarioPath: 'totalHead',
    sourceIds: ['model'],
    uiLocation: inputLocation(
      'Calves entering',
      undefined,
      'assistant-total-head',
    ),
  },
  {
    id: 'chain_economic_profit',
    label: 'Total profit',
    unit: '$',
    definition:
      'Model-derived chain economic profit: revenue plus ending inventory value, minus acquisition, direct, and economic costs across all stages.',
    kind: 'simulation_output',
    resultPath: 'chainEconomicProfit',
    sourceIds: ['model'],
    uiLocation: resultLocation('Total profit', 'profit', 'headline-heading'),
  },
  {
    id: 'chain_operating_contribution',
    label: 'Cash profit',
    unit: '$',
    definition:
      'Model-derived chain contribution before economic and overhead costs.',
    kind: 'simulation_output',
    resultPath: 'chainOperatingContribution',
    sourceIds: ['model'],
    uiLocation: resultLocation('Cash profit', 'profit', 'headline-heading'),
  },
  {
    id: 'chain_p10',
    label: 'P10 total profit',
    unit: '$',
    definition: 'Tenth percentile of total profit across Monte Carlo trials.',
    kind: 'simulation_output',
    resultPath: 'chainP10',
    sourceIds: ['model'],
    uiLocation: resultLocation(
      'Total profit range',
      'profit',
      'headline-heading',
    ),
  },
  {
    id: 'chain_p90',
    label: 'P90 total profit',
    unit: '$',
    definition:
      'Ninetieth percentile of total profit across Monte Carlo trials.',
    kind: 'simulation_output',
    resultPath: 'chainP90',
    sourceIds: ['model'],
    uiLocation: resultLocation(
      'Total profit range',
      'profit',
      'headline-heading',
    ),
  },
  {
    id: 'chain_probability_of_loss',
    label: 'Chance of a loss',
    unit: '%',
    definition:
      'Share of Monte Carlo trials with negative chain economic profit.',
    kind: 'simulation_output',
    resultPath: 'chainProbabilityOfLoss',
    sourceIds: ['model'],
    uiLocation: resultLocation(
      'Chance of a loss',
      'profit',
      'headline-heading',
    ),
  },
  {
    id: 'completed_head',
    label: 'Cattle finished',
    unit: 'head',
    definition:
      'Median number of cattle that complete every supply-chain stage.',
    kind: 'simulation_output',
    resultPath: 'completedHead',
    sourceIds: ['model'],
    uiLocation: resultLocation('Cattle finished', 'profit', 'headline-heading'),
  },
  {
    id: 'mortality_head',
    label: 'Mortality',
    unit: 'head',
    definition: 'Median modeled cattle deaths across the supply chain.',
    kind: 'simulation_output',
    resultPath: 'mortalityHead',
    sourceIds: ['model'],
    uiLocation: resultLocation('Mortality', 'flow', 'flow-heading'),
  },
  {
    id: 'ending_inventory_head',
    label: 'Still in chain',
    unit: 'head',
    definition: 'Cattle still in production when the selected horizon ends.',
    kind: 'simulation_output',
    resultPath: 'endingInventoryHead',
    sourceIds: ['model'],
    uiLocation: resultLocation('Still in chain', 'flow', 'flow-heading'),
  },
  {
    id: 'retail_pounds',
    label: 'Beef produced',
    unit: 'lb',
    definition: 'Modeled pounds of saleable beef reaching the retail stage.',
    kind: 'simulation_output',
    resultPath: 'retailPounds',
    sourceIds: ['model'],
    uiLocation: resultLocation('Beef produced', 'profit', 'headline-heading'),
  },
  {
    id: 'break_even_retail_price_per_lb',
    label: 'Break-even beef price',
    unit: '$/lb',
    definition:
      'Retail price that would bring modeled chain economic profit to zero.',
    kind: 'simulation_output',
    resultPath: 'breakEvenRetailPricePerLb',
    sourceIds: ['model'],
    uiLocation: resultLocation('Break-even beef price', 'flow', 'flow-heading'),
  },
  {
    id: 'break_even_fed_price_per_cwt',
    label: 'Break-even cattle price',
    unit: '$/cwt',
    definition:
      'Fed-cattle price that would bring modeled feedlot economic profit to zero.',
    kind: 'simulation_output',
    resultPath: 'breakEvenFedPricePerCwt',
    sourceIds: ['model'],
    uiLocation: resultLocation(
      'Break-even cattle price',
      'flow',
      'flow-heading',
    ),
  },
];

const phases: Array<{ key: PhaseKey; id: string; label: string }> = [
  { key: 'cowCalf', id: 'cow_calf', label: 'Cow-calf' },
  { key: 'stocker', id: 'stocker', label: 'Stocker' },
  { key: 'feedlot', id: 'feedlot', label: 'Feedlot' },
  { key: 'packer', id: 'packer', label: 'Packer' },
  { key: 'retail', id: 'retail', label: 'Retail' },
];

const phaseMetrics = phases.flatMap<Omit<MetricDescriptor, 'supportedYears'>>(
  ({ key, id, label }) => [
    {
      id: `${id}_economic_profit`,
      label: `${label} total profit`,
      unit: '$',
      definition: `${label} revenue plus ending inventory value, minus acquisition, direct, and economic costs.`,
      kind: 'simulation_output',
      resultPath: `phases.${key}.economicProfit`,
      sourceIds: ['model'],
      uiLocation: resultLocation(
        `${label} profit`,
        'sectors',
        'sectors-heading',
      ),
    },
    {
      id: `${id}_operating_contribution`,
      label: `${label} cash profit`,
      unit: '$',
      definition: `${label} contribution before economic and overhead costs.`,
      kind: 'simulation_output',
      resultPath: `phases.${key}.operatingContribution`,
      sourceIds: ['model'],
      uiLocation: resultLocation(
        `${label} cash profit`,
        'details',
        'analysis-heading',
      ),
    },
    {
      id: `${id}_margin`,
      label: `${label} margin`,
      unit: '%',
      definition: `${label} economic profit divided by revenue plus terminal inventory value.`,
      kind: 'simulation_output',
      resultPath: `phases.${key}.margin`,
      sourceIds: ['model'],
      uiLocation: resultLocation(
        `${label} margin`,
        'sectors',
        'sectors-heading',
      ),
    },
    {
      id: `${id}_duration_days`,
      label: `${label} days`,
      unit: 'days',
      definition: `Expected time cattle spend in the ${label.toLowerCase()} stage.`,
      kind: 'scenario_input',
      scenarioPath: `phases.${key}.durationDays`,
      sourceIds: ['model'],
      uiLocation: inputLocation(`${label} days`, 'biology', `${key}-days`),
    },
    {
      id: `${id}_direct_cost_per_head`,
      label: `${label} direct cost`,
      unit: '$/head',
      definition: `Direct per-head cost applied in the ${label.toLowerCase()} stage.`,
      kind: 'derived_historical_assumption',
      historicalPath: `phases.${key}.directCostPerHead`,
      scenarioPath: `phases.${key}.directCostPerHead`,
      sourceIds: ['cowCalf'],
      methodology: historicalData.methodology.phaseCosts,
      uiLocation: inputLocation(
        `${label} direct cost`,
        'biology',
        `${key}-direct-cost`,
      ),
    },
  ],
);

export const METRIC_REGISTRY: readonly MetricDescriptor[] = [
  ...baseMetrics,
  ...phaseMetrics,
].map((metric) => ({
  ...metric,
  supportedYears: metric.historicalPath ? [...AVAILABLE_HISTORICAL_YEARS] : [],
  sourceIds:
    metric.kind === 'simulation_output'
      ? ['model', 'livestock', 'priceSpreads', 'cowCalf', 'feedGrains']
      : metric.sourceIds,
}));

export const METRIC_BY_ID = new Map(
  METRIC_REGISTRY.map((metric) => [metric.id, metric]),
);

export const UI_ITEM_REGISTRY = new Map<string, UiLocation>([
  ...METRIC_REGISTRY.map(
    (metric) => [metric.id, metric.uiLocation] as [string, UiLocation],
  ),
  [
    'simulation_settings',
    inputLocation('Simulation settings', 'run', 'reference-year'),
  ],
  ['data_sources', inputLocation('Data sources', 'sources', 'data-sources')],
  ['profit_page', resultLocation('Total profit', 'profit', 'headline-heading')],
  [
    'sectors_page',
    resultLocation('Profit by sector', 'sectors', 'sectors-heading'),
  ],
  ['flow_page', resultLocation('Cattle flow', 'flow', 'flow-heading')],
  ['details_page', resultLocation('Details', 'details', 'analysis-heading')],
]);

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
