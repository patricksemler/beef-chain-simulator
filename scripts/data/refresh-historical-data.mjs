import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'csv-parse/sync';
import { unzipSync } from 'fflate';

const START_YEAR = 2015;
const OUTPUT_URL = new URL(
  '../../lib/data/historical-scenarios.json',
  import.meta.url,
);

const SOURCES = {
  livestock: {
    label: 'Livestock prices and slaughter weights',
    organization: 'USDA Economic Research Service',
    landingPage:
      'https://www.ers.usda.gov/data-products/livestock-and-meat-domestic-data',
    downloadPattern: /livestock-domestic-data-machine-readable-files\.zip/i,
  },
  priceSpreads: {
    label: 'Retail beef and byproduct values',
    organization: 'USDA Economic Research Service',
    landingPage: 'https://www.ers.usda.gov/data-products/meat-price-spreads',
    downloadPattern:
      /historical-monthly-price-spread-data-for-beef-pork-broilers\.csv/i,
  },
  cowCalf: {
    label: 'Cow-calf costs and returns',
    organization: 'USDA Economic Research Service',
    landingPage:
      'https://www.ers.usda.gov/data-products/commodity-costs-and-returns',
    downloadPattern: /cow-calf\.csv/i,
  },
  feedGrains: {
    label: 'Feed-grain prices',
    organization: 'USDA Economic Research Service',
    landingPage:
      'https://www.ers.usda.gov/data-products/feed-grains-database/feed-grains-yearbook-tables',
    downloadPattern: /feed-grains-yearbook-tables-all-years\.csv/i,
  },
};

const BASE_2025 = {
  feedCostPerTon: 230,
  byproductCreditPerHead: 165,
  phases: {
    cowCalf: {
      directCostPerHead: 950,
      dailyCostPerHead: 0,
      economicCostPerHead: 325,
    },
    stocker: {
      directCostPerHead: 60,
      dailyCostPerHead: 0.95,
      economicCostPerHead: 80,
    },
    feedlot: {
      directCostPerHead: 150,
      dailyCostPerHead: 0.55,
      economicCostPerHead: 70,
    },
    packer: {
      directCostPerHead: 475,
      dailyCostPerHead: 0,
      economicCostPerHead: 220,
    },
    retail: {
      directCostPerHead: 0,
      dailyCostPerHead: 0,
      economicCostPerHead: 0,
    },
  },
};

const CATTLE_SERIES = {
  calfPricePerCwt: 'Steers: medium and large #1 500-550 pounds',
  feederPricePerCwt: 'Steers: medium and large #1 750-800 pounds',
  fedPricePerCwt: 'Steers 65-80 percent Choice',
};

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { 'user-agent': 'beef-chain-simulator-data-refresh/1.0' },
  });
  if (!response.ok)
    throw new Error(`Request failed (${response.status}) for ${url}`);
  return response.text();
}

async function discoverDownload(source) {
  const html = await fetchText(source.landingPage);
  const hrefs = [...html.matchAll(/href=["']([^"']+)["']/gi)].map((match) =>
    match[1].replaceAll('&amp;', '&'),
  );
  const href = hrefs.find((candidate) =>
    source.downloadPattern.test(candidate),
  );
  if (!href)
    throw new Error(
      `Could not find ${source.label} download on ${source.landingPage}`,
    );
  return new URL(href, source.landingPage).href;
}

async function download(url) {
  const response = await fetch(url, {
    headers: { 'user-agent': 'beef-chain-simulator-data-refresh/1.0' },
  });
  if (!response.ok)
    throw new Error(`Download failed (${response.status}) for ${url}`);
  return new Uint8Array(await response.arrayBuffer());
}

function csvRows(bytes) {
  return parse(new TextDecoder().decode(bytes), {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function annualMonthlyMean(
  rows,
  yearKey,
  year,
  predicate,
  valueKey,
  minimumMonths = 12,
) {
  const monthly = rows.filter((row) => {
    const month = Number(
      row.month_id ?? row['Month-number'] ?? row.timeperiod_id,
    );
    return (
      Number(row[yearKey]) === year &&
      month >= 1 &&
      month <= 12 &&
      predicate(row)
    );
  });
  const byMonth = new Map();
  for (const row of monthly) {
    const month = Number(
      row.month_id ?? row['Month-number'] ?? row.timeperiod_id,
    );
    const value = Number(row[valueKey]);
    if (Number.isFinite(value)) byMonth.set(month, value);
  }
  if (byMonth.size < minimumMonths) return null;
  return mean([...byMonth.values()]);
}

function annualCowCost(rows, year, item) {
  const row = rows.find(
    (candidate) =>
      candidate.Region === 'U.S. total' &&
      Number(candidate.Year) === year &&
      candidate.Item.trim() === item,
  );
  const value = Number(row?.Value);
  return Number.isFinite(value) ? value : null;
}

function annualCornPrice(rows, year) {
  const matches = rows.filter(
    (row) =>
      row.commodity === 'Corn' &&
      row.attribute === 'Price received by farmers' &&
      row.frequency === 'Annual' &&
      row.unit === 'Dollars per bushel' &&
      Number(row.year) === year,
  );
  const values = [
    ...new Set(
      matches.map((row) => Number(row.amount)).filter(Number.isFinite),
    ),
  ];
  return values.length === 1 ? values[0] : null;
}

function scaledPhaseCosts(operatingIndex, overheadIndex) {
  return Object.fromEntries(
    Object.entries(BASE_2025.phases).map(([key, phase]) => [
      key,
      {
        directCostPerHead: round(phase.directCostPerHead * operatingIndex),
        dailyCostPerHead: round(phase.dailyCostPerHead * operatingIndex, 3),
        economicCostPerHead: round(phase.economicCostPerHead * overheadIndex),
      },
    ]),
  );
}

function fileFromZip(files, filename) {
  const entry = Object.entries(files).find(([path]) =>
    path.endsWith(`/${filename}`),
  );
  if (!entry)
    throw new Error(`${filename} was not found in the livestock archive.`);
  return entry[1];
}

async function main() {
  const discovered = Object.fromEntries(
    await Promise.all(
      Object.entries(SOURCES).map(async ([key, source]) => [
        key,
        await discoverDownload(source),
      ]),
    ),
  );
  const [livestockZip, priceSpreadsCsv, cowCalfCsv, feedGrainsCsv] =
    await Promise.all([
      download(discovered.livestock),
      download(discovered.priceSpreads),
      download(discovered.cowCalf),
      download(discovered.feedGrains),
    ]);

  const livestockFiles = unzipSync(livestockZip);
  const livestockPrices = csvRows(
    fileFromZip(livestockFiles, 'LivestockPrices.csv'),
  );
  const meatStats = csvRows(fileFromZip(livestockFiles, 'MeatStats.csv'));
  const priceSpreads = csvRows(priceSpreadsCsv);
  const cowCalf = csvRows(cowCalfCsv);
  const feedGrains = csvRows(feedGrainsCsv);

  const latestCandidate = Math.max(
    ...cowCalf
      .filter((row) => row.Region === 'U.S. total')
      .map((row) => Number(row.Year))
      .filter(Number.isFinite),
  );
  const referenceOperating = annualCowCost(
    cowCalf,
    latestCandidate,
    'Total, operating costs',
  );
  const referenceOverhead = annualCowCost(
    cowCalf,
    latestCandidate,
    'Total, allocated overhead',
  );
  const referenceCorn = annualCornPrice(feedGrains, latestCandidate);
  const referenceByproduct = annualMonthlyMean(
    priceSpreads,
    'Year',
    latestCandidate,
    (row) => row.Data_Item === 'Choice beef byproduct value',
    'Value',
  );
  if (
    !referenceOperating ||
    !referenceOverhead ||
    !referenceCorn ||
    !referenceByproduct
  ) {
    throw new Error(
      `The latest cost reference year (${latestCandidate}) is incomplete.`,
    );
  }

  const years = {};
  for (let year = START_YEAR; year <= latestCandidate; year += 1) {
    const prices = Object.fromEntries(
      Object.entries(CATTLE_SERIES).map(([key, attribute]) => [
        key,
        annualMonthlyMean(
          livestockPrices,
          'year_id',
          year,
          (row) =>
            row.commodity_desc === 'Cattle' && row.attribute_desc === attribute,
          'amount',
          key === 'fedPricePerCwt' ? 11 : 12,
        ),
      ]),
    );
    const retail = annualMonthlyMean(
      priceSpreads,
      'Year',
      year,
      (row) => row.Data_Item === 'All fresh beef retail value',
      'Value',
    );
    const wholesale = annualMonthlyMean(
      priceSpreads,
      'Year',
      year,
      (row) => row.Data_Item === 'Choice beef wholesale value',
      'Value',
    );
    const byproduct = annualMonthlyMean(
      priceSpreads,
      'Year',
      year,
      (row) => row.Data_Item === 'Choice beef byproduct value',
      'Value',
    );
    const liveWeight = annualMonthlyMean(
      meatStats,
      'year_id',
      year,
      (row) =>
        row.commodity_desc === 'Cattle' &&
        row.attribute_desc === 'Federally inspected average live weight',
      'amount',
    );
    const dressedWeight = annualMonthlyMean(
      meatStats,
      'year_id',
      year,
      (row) =>
        row.commodity_desc === 'Cattle' &&
        row.attribute_desc === 'Federally inspected average dressed weight',
      'amount',
    );
    const operating = annualCowCost(cowCalf, year, 'Total, operating costs');
    const overhead = annualCowCost(cowCalf, year, 'Total, allocated overhead');
    const corn = annualCornPrice(feedGrains, year);
    const required = {
      ...prices,
      wholesale,
      retail,
      byproduct,
      liveWeight,
      dressedWeight,
      operating,
      overhead,
      corn,
    };
    const missing = Object.entries(required)
      .filter(([, value]) => value === null)
      .map(([key]) => key);
    if (missing.length) {
      console.warn(
        `Skipping ${year}; incomplete source fields: ${missing.join(', ')}`,
      );
      continue;
    }

    const operatingIndex = operating / referenceOperating;
    const overheadIndex = overhead / referenceOverhead;
    years[year] = {
      year,
      calfPricePerCwt: round(prices.calfPricePerCwt),
      feederPricePerCwt: round(prices.feederPricePerCwt),
      fedPricePerCwt: round(prices.fedPricePerCwt),
      wholesalePricePerLb: round(wholesale / 100, 3),
      retailPricePerLb: round(retail / 100, 3),
      feedCostPerTon: round(BASE_2025.feedCostPerTon * (corn / referenceCorn)),
      byproductCreditPerHead: round(
        BASE_2025.byproductCreditPerHead * (byproduct / referenceByproduct),
      ),
      dressingPercentage: round(dressedWeight / liveWeight, 4),
      phases: scaledPhaseCosts(operatingIndex, overheadIndex),
      sourceMetrics: {
        cornPricePerBushel: round(corn),
        cowCalfOperatingCostPerCow: round(operating),
        cowCalfAllocatedOverheadPerCow: round(overhead),
        choiceBeefByproductCentsPerRetailLb: round(byproduct),
        choiceBeefWholesaleCentsPerRetailLb: round(wholesale),
      },
    };
  }

  const availableYears = Object.keys(years)
    .map(Number)
    .sort((a, b) => a - b);
  const expectedYears = Array.from(
    { length: latestCandidate - START_YEAR + 1 },
    (_, index) => START_YEAR + index,
  );
  if (availableYears.join(',') !== expectedYears.join(',')) {
    throw new Error(
      `Expected a complete ${START_YEAR}-${latestCandidate} series; got ${availableYears.join(', ')}.`,
    );
  }

  const output = {
    generatedAt: new Date().toISOString().slice(0, 10),
    availableYears,
    latestYear: availableYears.at(-1),
    methodology: {
      annualPrices:
        'Arithmetic mean of USDA ERS monthly observations. Each series has 12 observations except the 2022 fed-steer series, whose January value is reported as unavailable by ERS.',
      feedCost: `The app's $${BASE_2025.feedCostPerTon}/ton ${latestCandidate} ration assumption indexed by the USDA ERS annual corn price received by farmers.`,
      phaseCosts: `The app's ${latestCandidate} phase costs indexed by USDA ERS U.S. cow-calf operating and allocated-overhead cost series.`,
      byproductCredit: `The app's $${BASE_2025.byproductCreditPerHead}/head ${latestCandidate} credit indexed by the USDA ERS Choice beef byproduct value.`,
      dressingPercentage:
        'Annual average federally inspected dressed weight divided by annual average federally inspected live weight.',
    },
    sources: Object.fromEntries(
      Object.entries(SOURCES).map(([key, source]) => [
        key,
        {
          label: source.label,
          organization: source.organization,
          landingPage: source.landingPage,
          downloadUrl: discovered[key],
        },
      ]),
    ),
    years,
  };

  await mkdir(dirname(fileURLToPath(OUTPUT_URL)), { recursive: true });
  await writeFile(OUTPUT_URL, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(
    `Wrote ${availableYears.length} annual profiles (${availableYears[0]}-${availableYears.at(-1)}) to ${fileURLToPath(OUTPUT_URL)}`,
  );
}

await main();
