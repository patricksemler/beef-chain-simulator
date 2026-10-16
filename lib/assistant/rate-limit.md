# `lib/assistant/rate-limit.ts` — fixed-window rate limiting on D1

**Role:** Counts chat requests per salted IP hash in Cloudflare D1 (SQLite). It enforces **8 per minute and 80 per hour**.

## Why it exists

The Worker is public, and each chat request triggers a paid provider call on the user's key. Even so, the Worker needs abuse protection. The design stores no raw IPs, keys, or messages: only a salted SHA-256 hash, the window start, and a count.

## Public API

| Export | Behavior |
|---|---|
| `AssistantD1` | A minimal interface: `prepare(sql).bind(...).first<T>()` and `.run()`. Tests can substitute a fake. |
| `sha256(value)` | Hex SHA-256 via Web Crypto (`crypto.subtle`), which exists in Workers and Node ≥ 19. |
| `consumeUserMessage(db, ipHash, now?)` | Increments **both** windows, then returns the minute result if it's blocked, else the hour result if that's blocked, else `{allowed: true, retryAfter: 0}`. `now` is Unix seconds. |

`consumeWindow` (private) computes `windowStart = floor(now / window) × window`, then does `INSERT … ON CONFLICT DO UPDATE SET request_count = request_count + 1`, reads the count back, and returns `{allowed: count ≤ limit, retryAfter: windowStart + window − now}`.

## Where it fits

- Called by `handleChat` in [`workers/assistant-api.ts`](../../workers/assistant-api.md) with `sha256(`${IP_HASH_SALT}:ip:${CF-Connecting-IP}`)`.
- The table is `assistant_rate_windows` ([`migrations/0001_assistant_limits.sql`](../../migrations/0001_assistant_limits.md)).
- `/v1/validate` and `/v1/compact` aren't rate-limited.

## Testing

```bash
npm test -- tests/assistant-rate-limit.test.ts
```

It uses a `FakeD1` that mimics the upsert and select. Existing coverage:
- The 9th call in one minute is blocked.
- The 81st call in an hour is blocked.
- The raw key never appears in the bound values.

Suggested additions:
- A new minute window resets the minute limit but not the hour limit.
- `retryAfter` is correct at a window boundary.
- A missing row (`first()` returns null) is treated as blocked.

## Gotchas

- Every attempt counts, including requests that later fail validation, and minute-blocked attempts still consume the hourly allowance.
- Old rows are never deleted. The `window_start` index exists so a future cleanup job can prune them.
- The read-after-write isn't atomic, but D1 serializes writes per database, so this is acceptable at this scale.
