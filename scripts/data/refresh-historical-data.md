# `scripts/data/refresh-historical-data.mjs` — USDA data pipeline

**Role:** A standalone Node script (`npm run data:refresh`) that downloads USDA ERS/AMS data and writes [`lib/data/historical-scenarios.json`](../../lib/data/historical-scenarios.md). It never runs in the app or in CI.

## Why it exists

The app needs annual price and cost profiles for each year. USDA publishes those as several heterogeneous files with versioned URLs. This script turns them into one reproducible JSON and refuses to publish an incomplete series.

## Pipeline (`main()`)

1. **Discover the download links.** `discoverDownload(source)` scrapes each `SOURCES[*].landingPage` and matches `downloadPattern`, because USDA changes the `?v=` query strings. Sources: `livestock` (ZIP), `priceSpreads`, `cowCalf`, `feedGrains`, `grading` (`NW_LS903.TXT`).
2. **Download and parse.**
   - `unzipSync` (fflate) opens the ZIP, which yields `LivestockPrices.csv` and `Meat-Statistics.csv` (or the legacy `MeatStats.csv`).
   - `csvRows` parses each file (csv-parse, BOM removed, values trimmed).
3. **Pick the reference year** (`latestCandidate`): the latest year with a "U.S. total" row in the cow-calf file. Its operating cost, overhead, corn price, and byproduct value are the index denominators. If any is missing, the script throws.
4. **Build each year from 2015 to `latestCandidate`:**
   - **Cattle prices** (`CATTLE_SERIES`): the mean of the 12 monthly values (`annualMonthlyMean`). Fed steers allow 11 months, because ERS is missing January 2022.
   - **Wholesale and retail:** the Choice beef wholesale and retail values from price spreads, ¢/lb ÷ 100.
   - **Dressing %:** FI dressed weight ÷ FI live weight.
   - **Feed:** `BASE_2025.feedCostPerTon × corn / refCorn`.
   - **Byproduct:** `BASE_2025.byproductCreditPerHead × byproduct / refByproduct`.
   - **Phase costs** (`scaledPhaseCosts`): direct and daily costs × the cow-calf **operating** index, and overhead × the cow-calf **overhead** index. Every stage uses the cow-calf series.
   - **Grade mix** (`annualGradeMix`): the mean of the weekly national shares (≥40 weeks), with "Other" folded into Select. It walks back to the latest complete year and records `gradeMixYear`.
   - **Grade price indexes** (`annualLmrIndexes`, AMS LMR API, no key needed):
     - Select = Select cutout ÷ Choice cutout (report 2461).
     - Prime = Prime cut ÷ the matching Choice cut by IMPS code, weighted by Choice pounds (reports 2460/2461).
   - If a year is missing any required field, it's skipped with a `console.warn`.
5. **Enforce contiguity.** The script throws unless every year from 2015 to latest is present.
6. **Write the JSON:** `generatedAt`, `availableYears`, `latestYear`, `methodology` (prose), `sources` (including the discovered URLs and `lmr`), and `years`.

## Key constants

| Constant | Meaning |
|---|---|
| `START_YEAR` | 2015 |
| `SOURCES` | Landing pages and link regexes for each dataset |
| `LMR_API`, `LMR_SOURCE` | AMS LMR endpoint and its citation |
| `BASE_2025` | Anchor values: feed $230/ton, byproduct $165/head, every phase's three costs. These must match the defaults in `lib/model/defaults.ts`. |
| `CATTLE_SERIES` | ERS series names for the calf (500–550 lb steers), feeder (750–800 lb steers), and fed (65–80% Choice steers) prices |

## How to run and test

```bash
npm run data:refresh        # needs network; Node >= 22.13
npm test && npm run typecheck
git diff --stat lib/data/historical-scenarios.json
```

There are no unit tests. The module runs `await main()` at import time and every helper is private, so importing it triggers network calls.

To add tests, first move the pure helpers into an importable module:
- `annualMonthlyMean`, `annualCowCost`, `annualCornPrice`, `scaledPhaseCosts`
- `annualGradeMix`, `annualSelectIndex`, `annualCutPrices`, `annualPrimeIndex`
- `numeric`, `round`

Then cover them with small fixture CSV rows:
- `annualMonthlyMean` returns `null` when months are missing and respects `minimumMonths`.
- `annualCornPrice` returns `null` when there's more than one distinct value.
- `annualGradeMix` sums to 1, folds Other into Select, and needs ≥40 weeks.
- `annualPrimeIndex` ignores unmatched cuts.

## Gotchas

- `BASE_2025` is always anchored to `latestCandidate`. When USDA publishes 2026 cost data, the 2025 numbers silently become "2026" values.
- Regex link discovery is the most fragile step. If USDA redesigns a page, `discoverDownload` throws with the landing page URL.
- The LMR API is queried once per year, sequentially inside the loop, which makes the script slow but polite.
- Stocker, feedlot, and packer costs follow the cow-calf cost trend because no comparable USDA series exists for those stages.
