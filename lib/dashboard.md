# `lib/dashboard.ts` — shared dashboard IDs and labels

**Role:** The vocabulary shared by the simulator UI and the assistant. It holds the results tab and scenario section IDs and titles, the entry-cadence, month, and time-period labels, and the stale-result check.

## Why it exists

The assistant has to describe the screen using the exact words the screen uses. Before this module, the UI and [`lib/assistant/context.ts`](assistant/context.md) each kept their own copy of these labels, and the Worker's request schema kept a third copy of the tab and section IDs. Now there is one copy. The UI renders from it, the assistant quotes from it, and the schema builds its enums from it.

## Where it fits

- **Imports:** model types only. It has no browser or React code, because the Cloudflare Worker imports it through `context.ts`, `prompt.ts`, and `schemas.ts`.
- **Imported by:**
  - `components/simulator/results.tsx` (tab buttons)
  - `components/simulator/scenario-panel.tsx` (section titles, cadence and time-period options, month labels)
  - `components/simulator/simulator-page.tsx` and [`lib/model/use-simulation.ts`](model/use-simulation.md) (stale check)
  - [`lib/assistant/context.ts`](assistant/context.md), [`prompt.ts`](assistant/prompt.md), [`schemas.ts`](assistant/schemas.md), and [`types.ts`](assistant/types.md) (re-exports `ResultsPage` and `ScenarioSection`)
  - `tests/assistant.test.ts`

## Public API

| Export | Purpose |
|---|---|
| `RESULTS_PAGES`, `ResultsPage` | `['profit', 'flow', 'details']` and the union derived from it. |
| `RESULT_PAGE_LABELS` | `profit → "Profit"`, `flow → "Cattle flow"`, `details → "Stage details"`. |
| `SCENARIO_SECTIONS`, `ScenarioSection` | `['prices', 'biology', 'yield', 'risk', 'run', 'sources']`, which are also the accordion `value`s. |
| `SCENARIO_SECTION_LABELS` | `prices → "Prices"`, `biology → "Herd & costs"`, `yield → "Yields & trends"`, `risk → "Price swings"`, `run → "Simulation settings"`, `sources → "Data sources"`. |
| `CADENCE_LABELS` | One label per `EntryCadence`. The order of its keys is the order of the "When calves enter" dropdown. |
| `MONTH_LABELS` | `Jan` … `Dec`, for the custom monthly weights. |
| `horizonLabel(months)` | `"1 year"` / `"N years"`. |
| `hasStaleDisplayedResult(draft, result)` | `result !== null` and the JSON of the draft differs from `result.scenario`. `useSimulation`'s `isStale` adds `!isRunning`. The assistant snapshot uses it directly and sends `isRunning` separately. |

## Testing

```bash
npm test -- tests/assistant.test.ts -t "dashboard state"
```

The dashboard-state tests check that the stale flag and the tab and section labels appear in the assistant's text. The schema tests parse snapshots against the enums built from these arrays.

## When changing this file

- **Rename a tab or section:** update the layout paragraph in [`prompt.ts`](assistant/prompt.md) too.
- **Add a tab or section ID:** the Worker schema accepts it automatically. Deploy the Worker before the client, or older Workers will reject snapshots that use it.
- The comparison is by JSON string, so a change in key order counts as stale. `structuredClone` preserves key order.
