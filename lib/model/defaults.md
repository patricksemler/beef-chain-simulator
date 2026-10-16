# `lib/model/defaults.ts` — default scenario and source notes

**Role:** Builds the scenario the simulator starts with (and Reset restores), and lists the data sources shown under "Data sources" in the simulator.

## Why it exists

The defaults combine two things: the non-USDA assumptions (herd size, biology, risk) the app's authors chose, and the latest USDA year profile. This module keeps that composition in one place.

## Where it fits

- **Imports:** `historical.ts` and `types.ts`.
- **Imported by:**
  - `use-simulation.ts` (initial state, the first run, Reset)
  - `components/simulator/scenario-panel.tsx` (`SOURCE_NOTES`)
  - both test files (`cloneDefaultScenario()` is the standard test fixture)

## Public API

| Export | Purpose |
|---|---|
| `DEFAULT_SCENARIO` | `applyHistoricalYear(BASE_SCENARIO, LATEST_HISTORICAL_YEAR)`. |
| `cloneDefaultScenario()` | A `structuredClone` of the above. **Always use this** rather than mutating `DEFAULT_SCENARIO`. |
| `SOURCE_NOTES` | 7 `{label, organization, url}` entries: 4 ERS, 2 AMS (grading, LMR boxed beef), and 1 NASS. |
| `DATA_VINTAGE` | The vintage label for the latest year. Exported but unused. |

`BASE_SCENARIO` (not exported) holds:
- **Scale and timing:** 100,000 head, 24 months, even cadence.
- **Monte Carlo:** seed 2025, 250 trials, 7% variation.
- **Animals:** 85 lb start weight, 67% saleable yield, 28 lb/day feed intake, 0% trends.
- **Phase biology:**

  | Stage | Days | Daily gain | Mortality |
  |---|---|---|---|
  | Cow-calf | 210 | 2.33 | 1.5% |
  | Stocker | 150 | 1.5 | 0.8% |
  | Feedlot | 180 | 3.3 | 1.2% |
  | Packer | 7 | 0 | 0 |
  | Retail | 23 | 0 | 0 |

- **Volatilities:** calf 12%, feeder 10%, fed 8%, wholesale 6%, retail 4%, feed 12%, correlation 0.65.

Its price, cost, and grade literals are **placeholders** that `applyHistoricalYear` overwrites. The effective defaults are the latest JSON year's values.

## Gotchas

- Editing a price literal in `BASE_SCENARIO` has no effect. Change the data (or `BASE_2025` in the refresh script) instead.
- `SOURCE_NOTES` is separate from `historicalData.sources` (used by the footer and the assistant). Keep the two consistent when you add a source.

## Testing

It's covered indirectly: every simulation and assistant test starts from `cloneDefaultScenario()`, and `validateScenario(cloneDefaultScenario())` must return `[]`.

When changing it, run `npm test`. If you change a default, also check that the default run still passes validation (for example, trials must stay ≤ 500). Then check what the assistant prompt claims about defaults.
