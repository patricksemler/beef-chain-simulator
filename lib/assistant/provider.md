# `lib/assistant/provider.ts` — AI SDK model factory

**Role:** Builds a Vercel AI SDK `LanguageModel` for the selected provider from the user's key, and supplies per-provider options that keep replies fast.

## Why it exists

It isolates the provider-specific SDK setup, so the Worker's handlers can stay provider-agnostic.

## Public API

| Function | Behavior |
|---|---|
| `createAssistantModel(provider, apiKey, model)` | Throws `'Unsupported provider/model combination.'` unless `model` equals `ASSISTANT_MODELS[provider].model`. Otherwise it returns `createOpenAI({apiKey}).responses(model)` (the OpenAI Responses API), `createGoogleGenerativeAI({apiKey})(model)`, or `createAnthropic({apiKey})(model)`. |
| `providerOptions(provider)` | OpenAI: `{ store: false, reasoningEffort: 'low' }`. Google: `thinkingBudget: 512`. Anthropic: `undefined`. |

## Where it fits

It's used only by [`workers/assistant-api.ts`](../../workers/assistant-api.md), in all three handlers. It runs in the Cloudflare Worker, never in the browser.

## Privacy

`store: false` stops OpenAI from retaining conversations. The key is passed per request and never cached in module state.

## Testing

There are no tests, because calling these functions for real needs live keys.

Suggested offline tests:
- `createAssistantModel('openai', 'k', 'gpt-4o')` throws.
- Each allowed pair returns an object with the expected `provider` / `modelId`. The AI SDK sets these without a network call.
- `providerOptions` returns the exact objects above.

To check end to end, run the Worker locally (`npm run assistant:dev`) and connect with a real key in the widget. That calls `/v1/validate`.
