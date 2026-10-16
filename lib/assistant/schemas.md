# `lib/assistant/schemas.ts` — Worker request validation (Zod)

**Role:** Runtime validation for the three Worker endpoints' JSON bodies. It's the trust boundary between an untrusted browser and paid provider calls.

## Why it exists

The Worker forwards user-supplied content to LLM providers using the user's key. Strict schemas cap request sizes, reject unknown fields, and pin the provider/model pair, so a modified client can't send oversized payloads or pick an arbitrary model.

## Public API

| Schema | Used by | Accepts |
|---|---|---|
| `providerSchema` | all | `'openai' \| 'google' \| 'anthropic'` |
| `dashboardSnapshotSchema` | chat | `.strict()`: `id` (1–100 chars), `capturedAt` (ISO datetime), `draftScenario` and `displayedResult` (**any record**, not field-checked; result may be null), `isStale`, `isRunning`, `activeResultsPage` enum, `openScenarioSections` enum array |
| `assistantRequestSchema` | `/v1/chat` | `{provider, model, messages[1..30], snapshot, summary: string ≤8000 \| null}`, strict, plus the allowed-model check |
| `validateRequestSchema` | `/v1/validate` | `{provider, model}`, strict, plus the allowed-model check |
| `compactRequestSchema` | `/v1/compact` | `{provider, model, messages[1..40], previousSummary ≤8000 \| null}`, strict, plus the allowed-model check |

`requireAllowedModel` (private) is a `superRefine` that adds an issue at `['model']` if the model isn't `ASSISTANT_MODELS[provider].model`.

Related limits enforced in the Worker rather than here: a 512 KB body and 8,000 characters per user message.

## Where it fits

- Used by [`workers/assistant-api.ts`](../../workers/assistant-api.md) and `tests/assistant.test.ts`.
- Mirrors [`types.ts`](types.md). The schema enums duplicate the `ResultsPage` and `ScenarioSection` unions and must be kept in sync by hand.

## Testing

```bash
npm test -- tests/assistant.test.ts -t "request validation"
```

Existing coverage:
- Only the curated model is accepted per provider.
- A full chat request with a snapshot and a summary parses.

Suggested additions:
- 31 messages is rejected.
- An unknown top-level or snapshot key is rejected (strictness).
- A bad `capturedAt` is rejected.
- A summary over 8,000 characters is rejected.
- A null `displayedResult` is accepted.

## Gotchas

- **Chat allows 30 messages.** The widget keeps 12 after compaction and compacts again only after 12 more user messages (≈24 more messages). That can reach 36 and get rejected unless the ~8,000-token trigger fires first. Fix this in the widget or here if it shows up.
- Adding a field to `DashboardSnapshot` without adding it here makes every chat request fail with "Invalid assistant request."
