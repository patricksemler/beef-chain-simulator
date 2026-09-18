# Beef Dashboard Assistant

The dashboard remains a static Vercel deployment. A separate Cloudflare Worker owns provider calls, rate limits, and conversation compaction.

## How it answers

The assistant does not call tools. Every request carries:

- a static system prompt (`lib/assistant/prompt.ts`) describing the dashboard layout, how the model computes each number, a glossary of on-screen metrics with where they appear, the USDA reference profiles for every available year, and the source list; and
- a text description of everything currently on screen (`lib/assistant/context.ts`): status (open tab, expanded sections, whether results are stale and which inputs changed), every scenario input, and every displayed result across the four results tabs plus the model's sensitivity drivers.

The model is instructed to treat that block as the only source of truth for current numbers, to ask a short clarifying question when a request is ambiguous or refers to something not on screen, and to tell users which control to use rather than claiming to change the dashboard itself.

The widget lives in the bottom-right corner (`components/assistant/assistant-widget.tsx`): a launcher button opens a chat panel, full-screen on phones. Answers render as markdown; `[source:ID]` tokens resolve to verified USDA links.

## Local setup

1. Copy `.dev.vars.example` to `.dev.vars` and replace the salt.
2. Create the local D1 tables with `npm run assistant:db:local`.
3. Start the API with `npm run assistant:dev` (add `-- --port 8788` if 8787 is taken).
4. Start the dashboard with `VITE_ASSISTANT_API_URL=http://localhost:8787 npm run dev` (or put that line in `.env.development.local`).

The provider key is entered in the widget. It is stored only in `sessionStorage`, sent as a Bearer credential to the Worker, and forwarded to the selected provider. It must not be placed in a build variable, Worker secret, log, D1 table, or analytics event.

## Cloudflare setup

Create separate databases and replace the placeholder IDs before deployment:

```sh
npx wrangler d1 create beef-dashboard-assistant-preview
npx wrangler d1 create beef-dashboard-assistant
npx wrangler secret put IP_HASH_SALT --env preview --config wrangler.assistant.jsonc
npx wrangler secret put IP_HASH_SALT --config wrangler.assistant.jsonc
```

Set the exact Vercel preview URL in `ALLOWED_ORIGINS`; do not use a wildcard Vercel domain. Then apply migrations before deploying each Worker:

```sh
npm run assistant:db:preview
npm run assistant:deploy:preview
npm run assistant:db:production
npm run assistant:deploy
```

Build the static client with `VITE_ASSISTANT_API_URL` pointing at the matching Worker, then deploy `dist/client` to Vercel. Production must point to the production Worker and preserve `https://beef-chain-simulator.vercel.app` as the dashboard URL.

## GitHub secrets

The deployment workflows expect:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `ASSISTANT_PREVIEW_D1_ID`
- `ASSISTANT_PRODUCTION_D1_ID`
- `ASSISTANT_IP_HASH_SALT`
- `ASSISTANT_PREVIEW_API_URL`
- `ASSISTANT_PRODUCTION_API_URL`
- `ASSISTANT_PREVIEW_ORIGIN`
- `VERCEL_TOKEN`

## Privacy and limits

- D1 stores only salted IP hashes, window timestamps, and request counts.
- Chat requests are limited to eight per minute and 80 per hour per salted IP hash. Compaction and key validation do not consume the allowance.
- Reasoning budgets are kept small (`lib/assistant/provider.ts`) because the prompt already contains everything needed to answer; this keeps replies quick.
- Chat context compacts after 12 user messages or about 8,000 estimated tokens, retaining a plain-text summary and the latest six complete turns. A 41st message starts a new local chat while retaining the connected key.
- Provider errors are mapped to short messages (bad key, rate limit or quota, high demand) without exposing request details.
