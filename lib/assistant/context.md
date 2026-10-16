# `lib/assistant/context.ts` — dashboard snapshot → prompt text

**Role:** Converts a `DashboardSnapshot` into the "CURRENT DASHBOARD STATE" text block. That block is the assistant's **only** source of truth for current numbers.

## Why it exists

The assistant has no tools and can't read the page. To answer "why is feedlot losing money?" it needs every input and every displayed number as text, labeled exactly as the UI labels them. It also needs to know when the results are stale relative to the edited inputs.

## Public API

| Export | Behavior |
|---|---|
| `RESULT_PAGE_LABELS` | `profit → "Profit"`, `flow → "Cattle flow"`, `details → "Stage details"`. `prompt.ts` uses it too. |
| `SCENARIO_SECTION_LABELS` | `biology → "Herd & costs"`, etc. `prompt.ts` uses it too. |
| `hasStaleDisplayedResult(draft, result)` | The same JSON-string comparison as `isStale` in `use-simulation.ts`. |
| `describeScenario(s)` | A bulleted list of every input, grouped like the Scenario panel, including the grade mix, the indexes, and the custom cadence weights by month. |
| `describeScenarioDifferences(draft, displayed)` | `"  - Label: before → after"` for every entry in `INPUT_LABELS` whose formatted value differs. |
| `describeResults(r)` | Every number on the three tabs, tab by tab. It includes: headline; sectors (sorted by profit); sensitivity rows plus `sensitivityBase`; break-evens with cushion or gap (marked "not shown on screen"); flow shares; per-stage outcomes; the calf-to-retail timeline (`lastEntryMonth`); the per-stage ledger (money in/out, cash/total profit, per animal entering, margin, P10/P90, chance of loss); and the retail grade rows when `retailByGrade` exists. |
| `describeDashboard(snapshot)` | Assembles the block: STATUS (tab, sections, running, stale plus differences), the scenario (with a heading saying whether it's run or an unrun edit), then DISPLAYED RESULTS or "No results are displayed yet". |

Private: `CADENCE_LABELS`, `MONTHS`, the formatting helpers (`money` = compact + full, `pct`, `perCwt`, `perLb` with 3 decimals, `perHead`, `horizonLabel`), and `INPUT_LABELS` (one label and reader per editable input, including 6 per stage).

## Where it fits

- **Imports:** `lib/model/format.ts` (so strings match the UI), the model types, and `PHASES` from `metrics.ts`.
- **Imported by:**
  - `prompt.ts` → `buildInstructions`, which runs in the Worker
  - `components/simulator/simulator-page.tsx` (stale helper)
  - tests

The client sends the raw snapshot, and the **Worker** builds this text, so `context.ts` must stay runtime-agnostic.

## Testing

```bash
npm test -- tests/assistant.test.ts -t "dashboard state"
```

Existing coverage:
- Every headline, sector, flow, and ledger value appears.
- Stale results are flagged with the edited inputs named.
- The "no results yet" path works.

When changing it, add assertions for any new value you print. The tests build a real `runSimulation` result (2,000 head, 2 trials) and check the formatted strings.

## When changing this file

- **New input field:** add it to `describeScenario` **and** to `INPUT_LABELS`. Otherwise stale diffs won't mention it.
- **New on-screen result:** add it to `describeResults` under the tab and card where it appears, using the UI's exact card title.
- **Snapshots from older clients:** guard optional fields, as the code already does for `retailByGrade`, because a page loaded before a deploy can send an older result shape.
