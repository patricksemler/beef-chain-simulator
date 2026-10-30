# `lib/model/types.ts` — model data contracts

**Role:** Type-only module that defines what the engine reads (`ScenarioInput`) and what it produces (`SimulationSummary`). It has no runtime code.

## Why it exists

It's the single contract shared by the engine, the Web Worker, the React hook, every results component, and the assistant (whose `DashboardSnapshot` embeds both types). Changing a field here ripples through all of them, and TypeScript surfaces every place that needs an update.

## Where it fits

- **Imported by:**
  - `lib/model/*` (simulate, historical, defaults, use-simulation)
  - `workers/simulation.worker.ts`
  - `lib/assistant/*` (types, context, metrics)
  - nearly every `components/simulator/**` file
- **Imports:** nothing.

## Types

| Type | Meaning |
|---|---|
| `PhaseKey` | `'cowCalf' \| 'stocker' \| 'feedlot' \| 'packer' \| 'retail'`, in chain order. |
| `GradeKey`, `GradeMix`, `GradePriceIndex` | Prime/Choice/Select. The mix shares sum to 1. The index holds only `prime` and `select`, because Choice is implicitly 1. |
| `EntryCadence` | `'even' \| 'upfront' \| 'spring' \| 'fall' \| 'custom'`. |
| `PhaseAssumptions` | Per-stage inputs: `label`, `durationDays`, `averageDailyGain`, `mortalityRate` (0–1), and three costs: `directCostPerHead` (one-time), `dailyCostPerHead`, and `economicCostPerHead` (overhead). |
| `MarketRisk` | Six volatilities (σ, as fractions) plus `commonMarketCorrelation`. |
| `ScenarioInput` | All inputs for one run. Prices are $/cwt for cattle and $/lb for beef. Percents are stored as fractions (0.07, not 7). Trends are annual rates. |
| `PhaseResult` | Per-stage output. Head counts (entered, exited, mortality, ending inventory); money (revenue, terminal inventory value, acquisition, direct, economic costs); profits (`operatingContribution` = cash, `economicProfit` = total); ratios; P10/P90/probability of loss; average exit weight. |
| `MonthlyResult` | Per-month profit allocation by stage plus `chain`. It's computed but not displayed. |
| `GradeResult` | Retail economics for one grade. The totals include beef on hand. The per-lb fields cover only beef sold. |
| `SensitivityResult` | `lowEconomicProfit` / `highEconomicProfit` at ±10%, the same runs' per-stage profit (`lowPhaseProfit` / `highPhaseProfit`), plus `swing`. |
| `SimulationSummary` | The full result, including the echoed `scenario` (used for stale detection), `dataVintage`, chain totals, break-evens, `reconciliationDifference` (always 0), and `runtimeMs`. |
| `SimulationProgress` | `{ completed, total }` trials. |

## Ownership of `ScenarioInput` fields

[`historical.ts`](historical.ts) `applyHistoricalYear` overwrites **USDA-owned** fields:
- the five prices, `feedCostPerTon`, `byproductCreditPerHead`, `dressingPercentage`, `gradeMix`, `gradePriceIndex`
- each phase's three cost fields

Everything else is **user-owned** and survives a change of reference year.

## Testing

There's no runtime code to test. `npm run typecheck` is the test. After editing:

```bash
npm run typecheck && npm test
```

## When changing this file

- **Add a `ScenarioInput` field:**
  - Set a default in [`defaults.ts`](defaults.ts) (`BASE_SCENARIO`).
  - Decide whether it's USDA-owned. If it is, update [`historical.ts`](historical.ts) and the refresh script.
  - Add a UI control in `components/simulator/scenario-panel.tsx`.
  - Add a line in `describeScenario` and `INPUT_LABELS` in [`lib/assistant/context.ts`](../assistant/context.ts).
  - Add validation in [`simulate.ts`](simulate.ts) if the field has bounds.
- **Add a `SimulationSummary` field:** populate it in `aggregate()`. If it's shown on screen, describe it in `describeResults()`.
- `lib/assistant/schemas.ts` only checks the snapshot's scenario and result as generic records, so schema changes aren't needed for model fields.
