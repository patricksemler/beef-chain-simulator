# `migrations/0001_assistant_limits.sql` — initial D1 schema

**Role:** The first Cloudflare D1 migration for the assistant Worker's database (binding `ASSISTANT_DB`).

## What it creates

| Table | Columns | Status |
|---|---|---|
| `assistant_rate_windows` | `scope_key TEXT` (salted SHA-256 of the IP), `window_seconds INTEGER` (60 or 3600), `window_start INTEGER` (Unix seconds), `request_count INTEGER`. Primary key `(scope_key, window_seconds, window_start)`, plus an index on `window_start`. | **Live.** Used by [`lib/assistant/rate-limit.ts`](../lib/assistant/rate-limit.md). |
| `assistant_turn_locks` | `session_hash`, `turn_id`, `expires_at`, `steps_used`, plus an index on `expires_at` | **Obsolete.** It belonged to an earlier per-conversation turn-locking design. [`0002`](0002_drop_turn_locks.md) drops it. |

## Why it exists

Rate limiting needs durable counters shared across Worker isolates. The primary key makes `INSERT … ON CONFLICT DO UPDATE` an atomic per-window increment.

## How to apply and test

```bash
npm run assistant:db:local        # local (preview env)
npm run assistant:db:preview      # remote preview DB
npm run assistant:db:production   # remote production DB
```

CI applies migrations before each Worker deploy. `tests/assistant-rate-limit.test.ts` uses a fake D1, so it doesn't execute this SQL. To check the real schema, run `npx wrangler d1 execute ASSISTANT_DB --local --env preview --config wrangler.assistant.jsonc --command "PRAGMA table_info(assistant_rate_windows)"`.

## Rules

- **Never edit an applied migration.** Wrangler records applied files by name, so add a new numbered `.sql` file instead. Wrangler reads only `*.sql` from `migrations/`, so these `.md` specs are ignored.
- The column names are hard-coded in `rate-limit.ts` and in the fake D1 in the test. Keep all three in sync.
