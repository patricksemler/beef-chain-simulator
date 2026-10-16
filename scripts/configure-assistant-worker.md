# `scripts/configure-assistant-worker.mjs` — CI Wrangler config generator

**Role:** Turns the committed `wrangler.assistant.jsonc` into a deployable `.wrangler/assistant.generated.json` with real D1 database IDs and (for preview) the PR's Vercel origin.

## Why it exists

The committed config can't know the per-environment D1 IDs (kept in CI secrets) or each PR's preview URL. Wrangler reads a single config file, so CI generates one per deploy without editing the tracked file.

## Usage

```bash
ASSISTANT_PREVIEW_D1_ID=… ASSISTANT_PREVIEW_ORIGIN=https://… node scripts/configure-assistant-worker.mjs preview
ASSISTANT_PRODUCTION_D1_ID=… node scripts/configure-assistant-worker.mjs production
```

It prints the output path. The workflows then pass `--config .wrangler/assistant.generated.json` to `wrangler d1 migrations apply` and `wrangler deploy`.

## Steps

1. Validate the argument (`preview` or `production`). Otherwise throw a usage error.
2. Read the database ID from the matching env var. Throw if it's missing.
3. Read the JSONC, strip block comments, line comments, and trailing commas, then call `JSON.parse`.
4. **preview:** set `env.preview.d1_databases[0].database_id`, and append `ASSISTANT_PREVIEW_ORIGIN` to `env.preview.vars.ALLOWED_ORIGINS` if it's set. **production:** set the top-level `d1_databases[0].database_id`.
5. Rebase `main` and every `migrations_dir` so they're relative to `.wrangler/`, because Wrangler resolves paths relative to the config file.
6. Write pretty-printed JSON to `.wrangler/assistant.generated.json`.

## Where it fits

It's called by `.github/workflows/assistant-preview.yml` (on PRs) and `vercel-production.yml` (on pushes to `main`), before the D1 migrations and the Worker deploy. It's not used locally, because `npm run assistant:*` points at the `.jsonc` directly.

## Testing

There are no automated tests. To check it locally:

```bash
ASSISTANT_PREVIEW_D1_ID=test-id ASSISTANT_PREVIEW_ORIGIN=https://example.vercel.app node scripts/configure-assistant-worker.mjs preview
cat .wrangler/assistant.generated.json   # check database_id, ALLOWED_ORIGINS, main: "../workers/assistant-api.ts", migrations_dir: "../migrations"
```

Also check that it fails without the env var and with a bad argument.

## Gotchas

- The comment stripping is regex-based. A `//` inside a string value (for example a URL) is safe only because the line-comment regex requires the line to *start* with `//`. Don't put block-comment markers (`/*`) inside string values.
- Only the first D1 database entry per environment is patched.
