# `migrations/0002_drop_turn_locks.sql` — remove the obsolete lock table

**Role:** A single statement, `DROP TABLE IF EXISTS assistant_turn_locks;`.

## Why it exists

[`0001`](0001_assistant_limits.md) created `assistant_turn_locks` for an earlier design that locked a conversation during a multi-step tool-using turn. The assistant has since become tool-less and stateless per request, so the table was never used again. After this migration, the only stored data is `assistant_rate_windows`: salted IP hashes, window timestamps, and counts. No keys, messages, or raw IPs are stored.

## How to apply and test

It's applied with the same commands as 0001 (`npm run assistant:db:local|preview|production`), and CI runs it before deploys.

To verify locally, run:

```bash
npx wrangler d1 execute ASSISTANT_DB --local --env preview --config wrangler.assistant.jsonc --command "SELECT name FROM sqlite_master WHERE type='table'"
```

The output should list `assistant_rate_windows` and Wrangler's migration-tracking table, with no `assistant_turn_locks`.

## Rules

`IF EXISTS` makes this migration safe on fresh databases. Don't edit it. Put further schema changes in `0003_*.sql`.
