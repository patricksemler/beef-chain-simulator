import type { ScenarioInput } from './types';
import {
  applyHistoricalYear,
  historicalDataVintage,
  LATEST_HISTORICAL_YEAR,
} from './historical';

export const DATA_VINTAGE = historicalDataVintage(LATEST_HISTORICAL_YEAR);

export const SOURCE_NOTES = [
  {
    label: 'Cow-calf costs and returns',
    organization: 'USDA Economic Research Service',
    url: 'https://ers.usda.gov/data-products/commodity-costs-and-returns',
  },
  {
    label: 'Livestock prices and feeding economics',
    organization: 'USDA Economic Research Service',
    url: 'https://ers.usda.gov/data-products/livestock-and-meat-domestic-data',
  },
  {
    label: 'Historical feed-grain prices',
    organization: 'USDA Economic Research Service',
    url: 'https://www.ers.usda.gov/data-products/feed-grains-database/feed-grains-yearbook-tables',
  },
  {
    label: 'Farm-to-retail beef values',
    organization: 'USDA Economic Research Service',
    url: 'https://www.ers.usda.gov/data-products/meat-price-spreads',
  },
  {
    label: 'Cattle inventory and calf crop context',
    organization: 'USDA National Agricultural Statistics Service',
    url: 'https://data.nass.usda.gov/Surveys/Guide_to_NASS_Surveys/Cattle_Inventory/',
  },
] as const;

const BASE_SCENARIO: ScenarioInput = {
  referenceYear: LATEST_HISTORICAL_YEAR,
  totalHead: 100_000,
  horizonMonths: 24,
  cadence: 'even',
  customCadence: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  seed: 2025,
  trials: 250,
  biologicalVariation: 0.07,
  startWeight: 85,
  calfPricePerCwt: 345,
  feederPricePerCwt: 301,
  fedPricePerCwt: 224,
  wholesalePricePerLb: 5.455,
  retailPricePerLb: 8.17,
  feedCostPerTon: 230,
  byproductCreditPerHead: 165,
  dressingPercentage: 0.63,
  saleableYield: 0.67,
  feedDryMatterLbPerDay: 28,
  annualCattlePriceTrend: 0,
  annualWholesalePriceTrend: 0,
  annualRetailPriceTrend: 0,
  annualFeedCostTrend: 0,
  phases: {
    cowCalf: {
      label: 'Cow-calf',
      durationDays: 210,
      averageDailyGain: 2.33,
      mortalityRate: 0.015,
      directCostPerHead: 950,
      dailyCostPerHead: 0,
      economicCostPerHead: 325,
    },
    stocker: {
      label: 'Stocker',
      durationDays: 150,
      averageDailyGain: 1.5,
      mortalityRate: 0.008,
      directCostPerHead: 60,
      dailyCostPerHead: 0.95,
      economicCostPerHead: 80,
    },
    feedlot: {
      label: 'Feedlot',
      durationDays: 180,
      averageDailyGain: 3.3,
      mortalityRate: 0.012,
      directCostPerHead: 150,
      dailyCostPerHead: 0.55,
      economicCostPerHead: 70,
    },
    packer: {
      label: 'Packer',
      durationDays: 7,
      averageDailyGain: 0,
      mortalityRate: 0,
      directCostPerHead: 475,
      dailyCostPerHead: 0,
      economicCostPerHead: 220,
    },
    retail: {
      label: 'Retail',
      durationDays: 23,
      averageDailyGain: 0,
      mortalityRate: 0,
      directCostPerHead: 0,
      dailyCostPerHead: 0,
      economicCostPerHead: 0,
    },
  },
  marketRisk: {
    calfVolatility: 0.12,
    feederVolatility: 0.1,
    fedVolatility: 0.08,
    wholesaleVolatility: 0.06,
    retailVolatility: 0.04,
    feedVolatility: 0.12,
    commonMarketCorrelation: 0.65,
  },
};

export const DEFAULT_SCENARIO: ScenarioInput = applyHistoricalYear(
  BASE_SCENARIO,
  LATEST_HISTORICAL_YEAR,
);

export function cloneDefaultScenario(): ScenarioInput {
  return structuredClone(DEFAULT_SCENARIO);
}
