# `workers/simulation.worker.ts` — Web Worker wrapper for the engine

**Role:** A thin message adapter around `runSimulation()`, so simulations run on a background thread in the browser.

## Why it exists

A full run can take a noticeable amount of CPU time. On the main thread it would freeze the page. The site is a static export with no app server, so the browser is the only place the model can run.

## Where it fits

- It's loaded by [`lib/model/use-simulation.ts`](../lib/model/use-simulation.md) via `import SimulationWorker from '…/simulation.worker.ts?worker'`, which Vite bundles as a separate chunk.
- **Imports:** `runSimulation` from [`lib/model/simulate.ts`](../lib/model/simulate.md).

## Message protocol

| Direction | Shape |
|---|---|
| page → worker | `{ requestId: number, scenario: ScenarioInput }` |
| worker → page | `{ requestId, type: 'progress', progress: { completed, total } }` (every 10 trials and on the last one) |
| worker → page | `{ requestId, type: 'result', result: SimulationSummary }` |
| worker → page | `{ requestId, type: 'error', error: string }`. The message is the joined validation errors, or `'Simulation failed.'` for a non-`Error` throw. |

Every response echoes `requestId`, so the hook can drop stale responses. The worker itself never cancels work. It processes messages in arrival order.

## Testing

There's no automated test. The logic is all in `runSimulation`, which `tests/simulation.test.ts` covers.

How to verify manually: load `/simulator` (via `npm run dev`). Results should appear, and an invalid input (such as "Custom weights" with every month set to 0) should show the validation message.

If you add a test:
1. Stub a global `self` with `postMessage` collecting calls.
2. Import the module and invoke `self.onmessage({ data })`.
3. Assert that you get progress, then result for a valid scenario, and a single error for an invalid one.

## When changing this file

- Keep the protocol in sync with the `onmessage` handler in `use-simulation.ts`. The hook currently ignores `progress`.
- Results are structured-cloned across threads, so `SimulationSummary` must stay plain data: no functions or class instances.
