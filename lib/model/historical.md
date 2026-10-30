# `lib/model/historical.ts` — USDA year profiles → scenario

**Role:** The bridge between the generated USDA data file ([`lib/data/historical-scenarios.json`](../data/historical-scenarios.md)) and a `ScenarioInput`. It exposes which years exist and applies one year's data-backed values to a scenario.

## Why it exists

The design splits ownership. **USDA owns market and cost data. The user owns herd size, biology, timing, and risk.** This module puts that rule in one function, so the year selector, the defaults, and the WebMCP tool all load a year the same way.

## Where it fits

- **Imports:** the JSON data file, `phases.ts` (`PHASE_ORDER`), and `types.ts`.
- **Imported by:**
  - `defaults.ts` (builds `DEFAULT_SCENARIO`)
  - `simulate.ts` (year validation and the vintage label)
  - `use-simulation.ts` (WebMCP `referenceYear`)
  - `lib/assistant/metrics.ts`
  - `components/simulator/scenario-panel.tsx` (Reference year select)
  - `components/simulator/results/grade-breakdown.tsx`
  - tests

## Public API

| Export | Purpose |
|---|---|
| `HistoricalYear` | Literal union of the years present in the JSON, derived from its keys at compile time. |
| `AVAILABLE_HISTORICAL_YEARS`, `LATEST_HISTORICAL_YEAR` | Read directly from the JSON (currently 2015–2025, latest 2025). |
| `HISTORICAL_DATA_GENERATED_AT`, `HISTORICAL_METHODOLOGY` | Exported but currently unused. |
| `isHistoricalYear(year)` | Type guard. |
| `historicalDataVintage(year)` | `"Based on {year} USDA annual averages"`, stored on each result. |
| `getHistoricalProfile(year)` | The raw JSON profile for a year. |
| `isEditedFromProfile(scenario)` | True when any field `applyHistoricalYear` would load differs from the scenario's reference-year profile. Drives the "Edited from … profile" labels. |
| `applyHistoricalYear(scenario, year)` | Returns a **new** scenario (`structuredClone`). It sets `referenceYear` and overwrites the USDA-owned fields: the 5 prices, feed $/ton, byproduct $/head, dressing %, `gradeMix`, `gradePriceIndex`, and each phase's `directCostPerHead` / `dailyCostPerHead` / `economicCostPerHead` (merged so `label`, days, gain, and mortality survive). |

## Invariants

- The input scenario is never mutated.
- Every user-owned field stays the same: head count, horizon, cadence, custom weights, seed, trials, variation, start weight, saleable yield, feed intake, trends, risk, and phase biology.
- A manual edit to a USDA-owned field is lost when the year changes. This is by design.

## Testing

```bash
npm test -- tests/simulation.test.ts -t "historical"
```

Existing coverage:
- Every year from 2015 to 2025 is present.
- User-owned inputs survive `applyHistoricalYear`.
- Every year has a valid grade mix and price indexes.
- Different years produce different stage economics.

What to test when changing it:
- If you add a new USDA-owned field, assert that it's overwritten **and** that a neighboring user field isn't.
- Assert the input object is unchanged, for example by deep-equaling it against a clone taken before the call.

## When changing this file

A new data-backed field needs the same name in the refresh script's output (`scripts/data/refresh-historical-data.mjs`). After regenerating the JSON, `HistoricalYear` and the profile types update automatically.
