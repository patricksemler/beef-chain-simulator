# `workers/assistant-api.ts` — Cloudflare Worker for the chat assistant

**Role:** The only server-side code in the project. It proxies chat requests to OpenAI, Google, or Anthropic using the **user's own key** (BYOK), and enforces CORS, size limits, schemas, and per-IP rate limits.

## Why it exists

The site is static (Vercel), and provider SDK calls shouldn't run from the browser with arbitrary prompts. The Worker:
- keeps the system prompt server-side
- streams responses back
- redacts provider errors
- rate-limits abuse

It never stores keys or messages.

## Endpoints (POST only)

| Path | Flow | Rate-limited | Errors |
|---|---|---|---|
| `/v1/validate` | Bearer key → `validateRequestSchema` → `generateText("Reply with the single word OK.", 64 tokens)` → `{ok:true}` | No | 401 (no key), 400 (bad schema or provider error, redacted) |
| `/v1/compact` | Bearer key → `compactRequestSchema` + oversized check → summary < 300 words (800 tokens), truncated to 8,000 chars → `{text}` | No | 401, 400 |
| `/v1/chat` | Bearer key → salt check (≥16 chars, else 503) → `consumeUserMessage(sha256(salt:ip:CF-Connecting-IP))` (429 + `Retry-After`) → `assistantRequestSchema` + oversized check → `validateUIMessages` → `streamText({instructions: buildInstructions(snapshot, summary), maxOutputTokens: 2000, maxRetries: 1})` → UI message stream | **Yes** (8/min, 80/hr) | 401, 503, 429, 400 |

`fetch()` routing:
1. A missing or disallowed `Origin` gets **403**. Allowed origins are `http://localhost` or `http://127.0.0.1` on any port, plus the exact origins in `ALLOWED_ORIGINS`.
2. `OPTIONS` gets 204 with CORS headers.
3. A non-POST request gets 404.
4. The path is dispatched to a handler. An unknown path gets 404.
5. A thrown `REQUEST_TOO_LARGE` gets 413, and any other throw gets 400.

## Helpers

| Helper | Behavior |
|---|---|
| `allowedOrigin` | Origin allowlist check |
| `corsHeaders` | Allows `Authorization` and `Content-Type`, methods `POST` and `OPTIONS`; max-age 1 day; `Vary: Origin` |
| `json` | JSON response with CORS headers |
| `redactedError` | Unwraps the AI SDK retry `lastError`, reads `statusCode`, and maps 401/403, 429, and 503/529 to fixed messages. Everything else gets a generic message. |
| `bearerKey` | Extracts the key from `Authorization: Bearer …` |
| `readJson` | Rejects a body over 512,000 bytes, checking both `Content-Length` and the actual size |
| `hasOversizedUserMessage` | True if any user message's text parts total more than 8,000 characters |

## Environment (`wrangler.assistant.jsonc`)

- `ASSISTANT_DB`: the D1 binding.
- `IP_HASH_SALT`: a secret, set with `wrangler secret put`. Locally it comes from `.dev.vars`.
- `ALLOWED_ORIGINS`: a comma-separated list.
- Production and preview have separate names, databases, and origins. CI fills in the real database IDs with [`scripts/configure-assistant-worker.mjs`](../scripts/configure-assistant-worker.md).

## How to run

```bash
cp .dev.vars.example .dev.vars          # set a ≥16-char salt
npm run assistant:db:local               # apply migrations to local D1
npm run assistant:dev                    # wrangler dev (preview env, local); add -- --port 8788 if needed
VITE_ASSISTANT_API_URL=http://localhost:8787 npm run dev
npm run assistant:dry-run                # bundle check without deploying
```

## Testing

There are no direct tests of this file. Its dependencies are tested: schemas, prompt, and context in `tests/assistant.test.ts`, and rate limiting in `tests/assistant-rate-limit.test.ts`.

Suggested Worker tests (call `assistantWorker.fetch(new Request(...), env)` with a fake D1 and no network):
- A bad origin gets 403, and a localhost origin passes.
- `OPTIONS` gets 204 with CORS headers.
- `GET` gets 404, and an unknown path gets 404.
- A missing bearer gets 401.
- A body over 512 KB to `/v1/validate` gets 413.
- `/v1/chat` with a short salt gets 503.
- The 9th chat in a minute gets 429 with a `Retry-After` header.
- An invalid schema gets 400 "Invalid assistant request."
- `redactedError({lastError: {statusCode: 401}})` returns the key message. This would require exporting it.

Manual check: `curl -X OPTIONS -H 'Origin: http://localhost:3000' localhost:8787/v1/chat -i`.

## Gotchas

- In `/v1/chat`, the body is read *inside* `handleChat`'s try/catch. An oversized chat body therefore gets the generic 400 "provider request failed" message, not 413.
- Rate limiting runs before validation, so invalid requests still use up the allowance.
- The snapshot is checked only at the top level (see [`schemas.md`](../lib/assistant/schemas.md)). `describeDashboard` trusts its inner fields. A malformed `draftScenario` can throw, and that surfaces as a 400.
