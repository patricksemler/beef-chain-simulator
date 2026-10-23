# `lib/assistant/types.ts` — assistant data contracts

**Role:** Type-only module for the chat assistant. It's shared by the browser widget, the simulator page, and the Cloudflare Worker.

## Why it exists

The client and the Worker must agree on what a "dashboard snapshot" and a session look like. The tab and section ID unions are also reused by UI components (`results.tsx`, `scenario-panel.tsx`), so the IDs the assistant reports match the real UI.

## Types

| Type | Meaning |
|---|---|
| `AssistantProvider` | `'openai' \| 'google' \| 'anthropic'` |
| `ResultsPage` | Results tab IDs: `'profit' \| 'flow' \| 'details'`. Re-exported from [`lib/dashboard.ts`](../dashboard.md), where it's derived from `RESULTS_PAGES`. |
| `ScenarioSection` | Accordion IDs: `'prices' \| 'biology' \| 'yield' \| 'risk' \| 'run' \| 'sources'`. These are also the accordion `value`s in `scenario-panel.tsx`. Re-exported from [`lib/dashboard.ts`](../dashboard.md), where it's derived from `SCENARIO_SECTIONS`. |
| `DashboardSnapshot` | What's on screen when a question is sent: `id`, `capturedAt` (ISO), `draftScenario`, `displayedResult \| null`, `isStale`, `isRunning`, `activeResultsPage`, and `openScenarioSections`. |
| `MetricKind` | `usda_observation`, `derived_historical_assumption`, `scenario_input`, or `simulation_output` |
| `UiLocation` | `{ resultPage? , scenarioSection? }` |
| `MetricDescriptor` | One glossary entry: `id`, `label`, `unit`, `definition`, `kind`, optional `historicalPath` (a dotted path into a JSON year), `sourceIds`, optional `methodology`, and `uiLocation`. |
| `SourceCitation` | `id`, `label`, `organization`, optional `url`, and optional `methodology` |
| `AssistantMessage` | Alias of the AI SDK `UIMessage` |
| `AssistantSessionState` | What's persisted in `sessionStorage`: provider, apiKey, sessionId, messages, summary, and userMessageCount |

## Where it fits

- Built by `components/simulator/simulator-page.tsx` (`getSnapshot()`).
- Sent by `components/assistant/assistant-widget.tsx`.
- Validated by [`schemas.ts`](schemas.md) (its runtime mirror).
- Rendered to text by [`context.ts`](context.md).

## Testing

It's checked by `npm run typecheck` only.

When changing it:
- Update [`schemas.ts`](schemas.md) to match. The snapshot schema is `.strict()`, so a new snapshot field is **rejected by the Worker** until the schema includes it.
- Add or adjust a case in `tests/assistant.test.ts`.
