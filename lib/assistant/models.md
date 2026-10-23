# `lib/assistant/models.ts` — allowed provider/model list

**Role:** The single source of truth for which LLM each provider uses. There's exactly one model per provider.

## Why it exists

Users bring their own API keys. Pinning one model per provider keeps cost, latency, and behavior predictable, and stops a client from requesting an arbitrary (expensive) model through the Worker.

## Public API

| Export | Purpose |
|---|---|
| `ASSISTANT_MODELS` | `{ openai: gpt-5-mini, google: gemini-2.5-flash, anthropic: claude-sonnet-5 }`, each with a `label` and a `keyPlaceholder` for the connect form. |
| `ASSISTANT_PROVIDERS` | `Object.keys(ASSISTANT_MODELS)` |
| `isAssistantProvider(v)` | Type guard. [`storage.ts`](storage.md) uses it to sanitize a saved session. |
| `isAllowedModel(p, m)` | True if `m` is the pinned model for `p`. [`schemas.ts`](schemas.md) and [`provider.ts`](provider.md) both use it. |

## Where it fits

It's used by:
- `components/assistant/assistant-widget.tsx`: the provider picker, and the model name sent with requests.
- `schemas.ts`: `requireAllowedModel`.
- `provider.ts`: a guard in `createAssistantModel`.
- `storage.ts`.
- `tests/assistant.test.ts`.

## Testing

```bash
npm test -- tests/assistant.test.ts -t "curated model"
```

The test asserts that each provider accepts its listed model and rejects the others.

To change a model, edit `ASSISTANT_MODELS`. The schemas, the provider factory, and the widget follow automatically. If the new model needs different reasoning options, check `providerOptions()` in `provider.ts`.
