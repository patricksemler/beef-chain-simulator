import historicalData from '@/lib/data/historical-scenarios.json';

/**
 * The price series the public pages chart. The first five are the handoffs in
 * the chain, in the order cattle move through it; feed is the main input cost
 * and sits apart from the chain.
 */
export type SeriesKey =
  | 'calfPricePerCwt'
  | 'feederPricePerCwt'
  | 'fedPricePerCwt'
  | 'wholesalePricePerLb'
  | 'retailPricePerLb'
  | 'feedCostPerTon';

export type Series = {
  /** Who is selling at this point in the chain. */
  stage: string;
  /** What changes hands. */
  product: string;
  unit: string;
  decimals: number;
  /** Matches the sector colours used in the simulator's results. */
  color: string;
};

export const SERIES: Record<SeriesKey, Series> = {
  calfPricePerCwt: {
    stage: 'Cow-calf',
    product: 'Weaned calf',
    unit: '$/cwt',
    decimals: 2,
    color: '#688a9a',
  },
  feederPricePerCwt: {
    stage: 'Stocker',
    product: 'Feeder cattle',
    unit: '$/cwt',
    decimals: 2,
    color: '#78927b',
  },
  fedPricePerCwt: {
    stage: 'Feedlot',
    product: 'Fed cattle',
    unit: '$/cwt',
    decimals: 2,
    color: '#b68670',
  },
  wholesalePricePerLb: {
    stage: 'Packer',
    product: 'Wholesale beef',
    unit: '$/lb',
    decimals: 3,
    color: '#ad9656',
  },
  retailPricePerLb: {
    stage: 'Retail',
    product: 'Retail beef',
    unit: '$/lb',
    decimals: 2,
    color: '#8f7157',
  },
  feedCostPerTon: {
    stage: 'Input',
    product: 'Feed ration',
    unit: '$/ton',
    decimals: 0,
    color: '#5d5955',
  },
};

export const CHAIN_SERIES: readonly SeriesKey[] = [
  'calfPricePerCwt',
  'feederPricePerCwt',
  'fedPricePerCwt',
  'wholesalePricePerLb',
  'retailPricePerLb',
];

export const ALL_SERIES: readonly SeriesKey[] = [
  ...CHAIN_SERIES,
  'feedCostPerTon',
];

export type SeriesRow = { year: number } & Record<SeriesKey, number>;

export const YEARS: readonly number[] = historicalData.availableYears;
export const FIRST_YEAR = YEARS[0];
export const LAST_YEAR = YEARS[YEARS.length - 1];

export const ROWS: readonly SeriesRow[] = YEARS.map((year) => {
  const profile =
    historicalData.years[String(year) as keyof typeof historicalData.years];
  return {
    year,
    calfPricePerCwt: profile.calfPricePerCwt,
    feederPricePerCwt: profile.feederPricePerCwt,
    fedPricePerCwt: profile.fedPricePerCwt,
    wholesalePricePerLb: profile.wholesalePricePerLb,
    retailPricePerLb: profile.retailPricePerLb,
    feedCostPerTon: profile.feedCostPerTon,
  };
});

export const DATA_SOURCES = Object.values(historicalData.sources);

export function formatValue(key: SeriesKey, value: number) {
  return `$${value.toFixed(SERIES[key].decimals)}`;
}

export function percentChange(from: number, to: number) {
  return ((to - from) / from) * 100;
}

/** "+46.4%" / "−12.0%", with a real minus sign. */
export function formatChange(change: number) {
  const sign = change < 0 ? '−' : '+';
  return `${sign}${Math.abs(change).toFixed(1)}%`;
}

/**
 * Builds an SVG path for a small line drawn through `values`, scaled to fit a
 * `width` × `height` box with a little headroom so the line never touches the
 * edges. Coordinates are rounded to keep the markup short.
 */
export function sparklinePath(
  values: readonly number[],
  width: number,
  height: number,
) {
  if (values.length < 2) return '';
  let min = Infinity;
  let max = -Infinity;
  for (const value of values) {
    if (value < min) min = value;
    if (value > max) max = value;
  }
  const range = max - min || 1;
  const pad = 2;
  const stepX = (width - pad * 2) / (values.length - 1);
  return values
    .map((value, index) => {
      const x = pad + index * stepX;
      const y = pad + (1 - (value - min) / range) * (height - pad * 2);
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
}

/** Sparkline box; the cell's SVG viewBox must match. */
export const SPARK_WIDTH = 120;
export const SPARK_HEIGHT = 32;

type SeriesSummary = {
  latest: number;
  decadeChange: number;
  sparkline: string;
};

function summarize(key: SeriesKey): SeriesSummary {
  const values = ROWS.map((row) => row[key]);
  const latest = values[values.length - 1];
  return {
    latest,
    decadeChange: percentChange(values[0], latest),
    sparkline: sparklinePath(values, SPARK_WIDTH, SPARK_HEIGHT),
  };
}

/** Per-series summaries used by the ledger; computed once at module load. */
export const SERIES_SUMMARY: Record<SeriesKey, SeriesSummary> = {
  calfPricePerCwt: summarize('calfPricePerCwt'),
  feederPricePerCwt: summarize('feederPricePerCwt'),
  fedPricePerCwt: summarize('fedPricePerCwt'),
  wholesalePricePerLb: summarize('wholesalePricePerLb'),
  retailPricePerLb: summarize('retailPricePerLb'),
  feedCostPerTon: summarize('feedCostPerTon'),
};
