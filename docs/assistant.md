# Beef Dashboard Assistant

The dashboard remains a static Vercel deployment. A separate Cloudflare Worker owns provider calls, request locking, rate limits, conversation compaction, and the server-side dashboard tools.

## Local setup

1. Copy `.dev.vars.example` to `.dev.vars` and replace the salt.
2. Create the local D1 tables with `npm run assistant:db:local`.
3. Start the API with `npm run assistant:dev`.
4. Start the dashboard with `VITE_ASSISTANT_API_URL=http://localhost:8787 npm run dev`.

The provider key is entered in the drawer. It is stored only in `sessionStorage`, sent as a Bearer credential to the Worker, and forwarded to the selected provider. It must not be placed in a build variable, Worker secret, log, D1 table, or analytics event.

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

Set `VITE_ASSISTANT_API_URL` separately in Vercel Preview and Production. Production must point to the production Worker and preserve `https://beef-chain-simulator.vercel.app` as the dashboard URL.

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

- D1 stores only salted session/IP hashes, active turn IDs, window timestamps, and counts.
- One turn may be active per session. The same turn may continue after a browser-executed tool; another turn receives `409`.
- A turn lease expires after two minutes. Stop calls `/v1/turn/cancel` to release it early.
- New user messages are limited to eight per minute and 80 per hour per salted IP hash. Tool continuations and compaction do not consume another allowance.
- Chat context compacts after 12 user messages or about 8,000 estimated tokens, retaining a structured summary and the latest six complete turns. A 41st message starts a new local chat while retaining the connected key.
