# `lib/model/use-simulation.ts` — React hook driving the engine

**Role:** `useSimulation()` owns all simulation state on `/simulator`:
- the draft scenario the user is editing
- the last completed result
- the running, error, and stale flags

It runs the engine off the main thread through the Web Worker. It also registers a WebMCP tool for in-browser AI agents.

## Why it exists

The engine is CPU-heavy (up to 500 trials × 2,500 agents, plus 15 deterministic sensitivity runs). Running it in a Worker keeps the UI responsive. This hook hides the message passing and request bookkeeping, and handles out-of-order responses.

## Where it fits

```
SimulatorPage ─ useSimulation() ─postMessage({requestId, scenario})─► workers/simulation.worker.ts
     │                ▲                                                    │
     │                └──── {requestId, type:'result'|'error'|'progress'} ◄┘
     └─► ScenarioPanel (scenario, setScenario, runScenario, restoreDefaults, isStale)
         ResultsDashboard (result, isRunning, error)
         getSnapshot() for the assistant
```

- **Imports:**
  - the worker via Vite's `?worker` loader
  - `defaults.ts`, `historical.ts`, `types.ts`
  - `hasStaleDisplayedResult` from [`lib/dashboard.ts`](../dashboard.md)
  - the WebMCP types from `types/webmcp.d.ts`
- **Imported by:** `components/simulator/simulator-page.tsx` only.

## Returned API

| Field | Behavior |
|---|---|
| `scenario`, `setScenario` | The draft. Edits never trigger a run. |
| `result` | The last **completed** summary for the latest request. |
| `isRunning` | Starts `true`, because a default run is started on mount. |
| `error` | The last error message (the validation text from the engine). |
| `isStale` | `!isRunning && hasStaleDisplayedResult(scenario, result)` (from [`lib/dashboard.ts`](../dashboard.md)). It drives the Run button's `data-stale` attribute. |
| `runScenario(next)` | Bumps `requestRef`, sets the draft, posts to the worker, and returns a Promise of the summary. It rejects immediately if the worker isn't created yet. |
| `restoreDefaults()` | Runs `cloneDefaultScenario()` (the Reset button). |

## Key behavior

- **Latest request wins.** Every response resolves or rejects its own promise. Only the response whose `requestId` equals the current `requestRef` updates `result`, `isRunning`, and `error`.
- **Progress messages are ignored.** There's no handler for `type: 'progress'`.
- **Unmount** terminates the worker and rejects all pending promises with "Simulation cancelled."
- **WebMCP tool `run_beef_supply_chain_scenario`** is registered only if `document.modelContext?.registerTool` exists.
  - Inputs: `totalHead` (required, 1–30M) and `horizonYears` (required, 1–10). Optional: `referenceYear`, `cadence` (not custom), the 5 prices plus `feedCostPerTon`, and `seed`.
  - It applies the year **first**, then the overrides, then runs. That updates the visible dashboard.
  - It returns chain profit, operating profit, the head counts, and P10/P90.
  - The tool is aborted on unmount. It reads the current draft through `scenarioRef`, so the registration isn't torn down on every edit.

## Testing

There are no automated tests: the hook needs a DOM and a Worker, and Vitest runs in the `node` environment.

How to verify manually:
1. Run `npm run dev` (or the `beef-chain-dev` launch config) and open `/simulator`.
2. Check that results appear after load and that edits turn on the Run button's stale styling.
3. Click Run twice quickly and confirm the final result matches the final inputs.
4. Choose "Custom weights", set every month to 0, click Run, and confirm the validation error shows.
5. Click Reset.

What to test if you add coverage:
- Use jsdom plus a fake `Worker` to check that stale responses are ignored, that `isStale` toggles correctly, and that promises reject on unmount.
- Extract the WebMCP `execute` input handling into a pure function and unit-test its range checks and the order "year first, then overrides".

## Gotchas

- `isStale` compares JSON strings, so a change in key order counts as stale. `structuredClone` preserves key order, so this hasn't been a problem in practice.
