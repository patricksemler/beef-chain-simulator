# `lib/assistant/storage.ts` — chat session persistence (browser)

**Role:** Saves and loads the assistant session in `sessionStorage` under the key `beef-dashboard-assistant-v2`. It also provides a rough token estimate that triggers compaction.

## Why it exists

The user's API key and conversation must survive page reloads within a tab, but must not persist after the tab closes (privacy). `sessionStorage` gives exactly that lifetime. Loading is defensive because the stored JSON may be stale, from an older version, or tampered with.

## Public API

| Function | Behavior |
|---|---|
| `emptyAssistantSession(provider = 'openai')` | A blank state: empty key, new `crypto.randomUUID()` session ID, no messages, `summary: null`, count 0. |
| `loadAssistantSession()` | Returns blank on the server (`typeof window === 'undefined'`), when nothing is saved, on invalid JSON, or on an unknown provider. Otherwise it type-checks each field and falls back field by field. |
| `saveAssistantSession(state)` | `JSON.stringify` into `sessionStorage`. A no-op on the server. |
| `estimatedConversationTokens(messages)` | `ceil(JSON.stringify(messages).length / 4)` |

## Where it fits

It's used only by `components/assistant/assistant-widget.tsx`, which compacts when 12 or more user messages have been sent since the last compaction or when the estimate is ≥ 8,000. The widget also starts a new chat after 40 user messages.

## Testing

There's no test, because the code depends on `window` and `sessionStorage`.

Suggested approach:
- Use `// @vitest-environment jsdom`, or stub `globalThis.window` and `sessionStorage`.
- Round-trip a state.
- Corrupt JSON should return blank.
- `provider: 'bogus'` should return blank.
- A `messages` value that isn't an array should become `[]`.
- A missing `sessionId` should produce a new UUID.
- Check that the estimate grows with message length.

## When changing this file

If the stored shape changes incompatibly, bump the `-v2` suffix in `STORAGE_KEY` so old sessions are ignored rather than misread.
