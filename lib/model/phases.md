# `lib/model/phases.ts` — stage order, labels, and colors

**Role:** The single list of the five beef-chain stages in chain order (`PHASE_ORDER`), plus the display label and chart color for each one (`PHASE_META`).

## Why it exists

The stage order used to be written out in five places (the engine, `historical.ts`, the scenario panel, the results views, and the assistant's metric list), and the stage colors in two (the results views and the trends series). Keeping them here means a reorder, rename, or recolor happens once.

## Where it fits

- **Imports:** `types.ts` (`PhaseKey`) only. It has no browser or React code, so the engine can import it under Vitest and in the Web Worker.
- **Imported by:**
  - `simulate.ts` and `historical.ts` (`PHASE_ORDER`)
  - `components/simulator/scenario-panel.tsx` (one fieldset per stage)
  - `components/simulator/results/{flow,sectors,stage-details,stage-economics}.tsx` (order and colors)
  - [`lib/trends/series.ts`](../trends/series.md) (the five chain series take their colors from `PHASE_META`)
  - [`lib/assistant/metrics.ts`](../assistant/metrics.md) (`PHASES` is derived from it)

## Public API

| Export | Purpose |
|---|---|
| `PHASE_ORDER` | `cowCalf → stocker → feedlot → packer → retail`. |
| `PHASE_META` | `{ label, color }` per stage: Cow-calf `#688a9a`, Stocker `#78927b`, Feedlot `#b68670`, Packer `#ad9656`, Retail `#8f7157`. |

## Testing

There's no dedicated test. Every simulation and assistant test runs through `PHASE_ORDER`, and `npm run typecheck` checks that `PHASE_META` covers every `PhaseKey`.

## When changing this file

- The labels here are display labels. Each scenario also carries its own `phases[key].label` (set in [`defaults.ts`](defaults.md)), which the engine copies into results.
- The assistant's metric ids are the snake_case of each key (`cowCalf` → `cow_calf`). Renaming a key changes those ids.
