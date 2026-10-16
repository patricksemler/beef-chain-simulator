# `lib/assistant/prompt.ts` — system prompt and instruction builder

**Role:** Builds the full instruction string for each chat call. That's a static system prompt (computed once at module load), plus an optional conversation summary, plus the live dashboard state.

## Why it exists

The assistant is tool-less by design. Everything it needs comes from this prompt:
- scope rules
- the UI layout
- a prose description of the model mechanics
- the metric glossary
- every USDA year's profile
- the citable sources
- answering rules

## Public API

| Export | Behavior |
|---|---|
| `DOMAIN_REFUSAL` | The exact out-of-scope reply. A test checks it verbatim, including the curly apostrophe. |
| `ASSISTANT_SYSTEM_PROMPT` | Sections: SCOPE, HOW THE DASHBOARD IS LAID OUT, HOW THE MODEL WORKS, GLOSSARY (`glossary()` from `METRIC_REGISTRY`), USDA REFERENCE PROFILES (`historicalTable()`: a prices/yields table and a stage-costs table for every year, plus the methodology and `generatedAt`), SOURCES (`sourceList()` with `[source:ID]` tokens), and HOW TO ANSWER. |
| `buildInstructions(snapshot, summary)` | `[SYSTEM_PROMPT, "SUMMARY OF EARLIER CONVERSATION…"?, describeDashboard(snapshot)].join('\n\n')` |

Private: `profile(year)`, and `locationText(metric)`, which produces `"Profit" results tab` or `Scenario panel › "Prices"`.

## Where it fits

- **Imports:** the JSON, `context.ts`, and `metrics.ts`.
- **Imported by:** [`workers/assistant-api.ts`](../../workers/assistant-api.md) (`handleChat`) and tests.

## Testing

```bash
npm test -- tests/assistant.test.ts -t "system prompt|refusal"
```

Existing coverage:
- The prompt contains every glossary label, every year, and every source token.
- `buildInstructions` includes the summary and the dashboard block.
- The refusal string is verbatim.

## Keep the prose in sync with `simulate.ts`

"HOW THE MODEL WORKS" hand-describes the engine. It covers: the stage sale prices, the grade mix and blended index, entry cadence repeating across the whole horizon, end-of-stage mortality, per-run shocks, the deterministic sensitivity base, trends (compounded from month 0 at the time of sale, with ending inventory untrended), and both break-even formulas, including `× gradeIndex`.

When you change engine mechanics or the UI layout, update this prose. The model explains results only from what's written here.

## Gotchas

- The prompt is large and is resent on every request (there's no caching). Watch its size when you add tables.
- Changing a tab or section label requires updating both `context.ts` (`*_LABELS`) and the layout paragraph here.
