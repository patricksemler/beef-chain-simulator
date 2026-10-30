# `lib/assistant/metrics.ts` — metric glossary and source registry

**Role:** A declarative catalogue of on-screen numbers (`METRIC_REGISTRY`) and citable sources (`SOURCE_REGISTRY`). [`prompt.ts`](prompt.md) renders them into the system prompt's glossary and source list.

## Why it exists

It gives the assistant one authoritative definition, unit, UI location, and source for every metric, so answers use the dashboard's own labels and cite real USDA sources. Keeping this as data rather than prose lets tests confirm that every metric resolves against the USDA JSON.

## Public API

| Export | Contents |
|---|---|
| `PHASES` | `{key, id (snake_case), label}` for the 5 stages, derived from [`lib/model/phases.ts`](../model/phases.md). [`context.ts`](context.md) reuses it for stage ordering and labels. |
| `METRIC_REGISTRY` | 35 entries. 20 base metrics: 10 inputs or USDA-derived (5 prices, feed, byproduct, dressing, saleable yield, head) and 10 chain outputs (profit, operating profit, range, chance of loss, finished, beef produced, deaths, still in chain, 2 break-evens). Plus 15 per-stage metrics (profit, margin, direct cost × 5 stages). Every `simulation_output` has its `sourceIds` overwritten to `model` plus all four ERS sources. |
| `METRIC_BY_ID` | `Map<id, metric>`. Exported but unused. |
| `SOURCE_REGISTRY` | Every entry in `historicalData.sources` (`livestock`, `priceSpreads`, `cowCalf`, `feedGrains`, `grading`, `lmr`) with `url = landingPage`, plus a `model` pseudo-source. The keys are the `[source:ID]` tokens the model may emit. |
| `HISTORICAL_YEARS` | A copy of `AVAILABLE_HISTORICAL_YEARS`. |

## Where it fits

- **Imports:** the JSON (sources and `methodology.phaseCosts`), `historical.ts`, and the model types.
- **Imported by:**
  - `prompt.ts` (glossary, sources, years)
  - `context.ts` (`PHASES`)
  - `components/assistant/assistant-widget.tsx` (`SOURCE_REGISTRY` resolves `[source:ID]` tokens into links, and `safeLink()` allows only these URLs)
  - tests

## Testing

```bash
npm test -- tests/assistant.test.ts -t "metric registry"
```

Existing coverage:
- IDs are unique.
- Every `historicalPath` resolves to a number in every year from 2015 to 2025.
- Every metric has a definition and a unit.
- Every `sourceId` exists in `SOURCE_REGISTRY`.

## When changing this file

- **New on-screen metric:** add an entry with an accurate `uiLocation`. The location text in the prompt is derived from it. If the metric is shown, also make sure `describeResults` in [`context.ts`](context.md) prints its value.
- **New USDA source:** it appears automatically once it's in the JSON's `sources`, and the widget will then allow its URL.
- Grade-mix metrics (Prime/Choice/Select) are described in `context.ts` but have no registry entries yet. Consider adding them.
