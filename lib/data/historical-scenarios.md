# `lib/data/historical-scenarios.json` — generated USDA reference profiles

**Role:** The app's only reference dataset: one profile of prices, yields, grade mix, and stage costs per year (currently 2015–2025). It's **generated; never hand-edit it.** Regenerate it with `npm run data:refresh` ([`scripts/data/refresh-historical-data.mjs`](../../scripts/data/refresh-historical-data.md)).

## Why it exists

The app ships as a static site and must work offline from USDA. Committing the processed annual profiles makes runs reproducible and lets types be derived from the data at compile time.

## Shape

```jsonc
{
  "generatedAt": "YYYY-MM-DD",
  "availableYears": [2015, …, 2025],   // contiguous, script enforces no gaps
  "latestYear": 2025,                  // becomes the app's default year
  "methodology": { "annualPrices", "feedCost", "phaseCosts", "byproductCredit",
                   "dressingPercentage", "retailPrice", "gradeMix", "gradePriceIndex" },  // prose strings
  "sources": {                         // livestock, priceSpreads, cowCalf, feedGrains, grading, lmr
    "<id>": { "label", "organization", "landingPage", "downloadUrl" }
  },
  "years": {
    "2025": {
      "year", "calfPricePerCwt", "feederPricePerCwt", "fedPricePerCwt",      // $/cwt
      "wholesalePricePerLb", "retailPricePerLb",                            // $/lb, Choice
      "feedCostPerTon", "byproductCreditPerHead", "dressingPercentage",     // fraction
      "gradeMix": { "prime", "choice", "select" },  "gradeMixYear",         // shares sum to 1
      "gradePriceIndex": { "prime", "select" },                             // × Choice
      "phases": { "<phaseKey>": { "directCostPerHead", "dailyCostPerHead", "economicCostPerHead" } },
      "sourceMetrics": { "cornPricePerBushel", "cowCalfOperatingCostPerCow",
                         "cowCalfAllocatedOverheadPerCow", "choiceBeef*CentsPerLb" … }  // raw USDA inputs
    }
  }
}
```

## Consumers

| File | Uses |
|---|---|
| [`lib/model/historical.ts`](../model/historical.md) | `availableYears`, `latestYear`, `years[*]` → scenarios |
| [`lib/trends/series.ts`](../trends/series.md) | yearly prices for the home page and `/trends`, plus `sources` for the footer |
| [`lib/assistant/metrics.ts`](../assistant/metrics.md) | `sources` → `SOURCE_REGISTRY`, and `methodology.phaseCosts` |
| [`lib/assistant/prompt.ts`](../assistant/prompt.md) | `years[*]` (prices, costs, `sourceMetrics`), `methodology`, and `generatedAt` → system prompt tables |
| `tests/assistant.test.ts` | every metric `historicalPath` must resolve in every year |

Field names must match `ScenarioInput` names. `applyHistoricalYear` copies them across by name.

## Testing

- `tests/simulation.test.ts` checks that every year from 2015 to 2025 is present and that grade mixes and indexes are valid.
- `tests/assistant.test.ts` checks that every year appears in the prompt and that every metric path resolves.

After a refresh:
1. Run `npm test` and `npm run typecheck`.
2. Review `git diff --stat` on this file. Expect a new year or small revisions, not wholesale changes.
3. Spot-check one year against the USDA source.
4. If a new year appeared, update the tests that hard-code 2015–2025.

## Gotchas

- Cost fields for every year are indexes off `BASE_2025` in the refresh script, applied to the latest cost year, so "2025" values silently become the latest year's values when USDA publishes a new year.
- `gradeMixYear` can lag `year`, because the AMS weekly grading report ended in December 2024.
