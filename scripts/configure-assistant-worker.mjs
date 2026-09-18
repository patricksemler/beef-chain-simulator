import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const environment = process.argv[2];
if (environment !== 'preview' && environment !== 'production') {
  throw new Error(
    'Usage: node scripts/configure-assistant-worker.mjs preview|production',
  );
}

const databaseId =
  environment === 'preview'
    ? process.env.ASSISTANT_PREVIEW_D1_ID
    : process.env.ASSISTANT_PRODUCTION_D1_ID;
if (!databaseId) throw new Error(`Missing ${environment} D1 database ID.`);

const sourcePath = resolve('wrangler.assistant.jsonc');
const outputPath = resolve('.wrangler/assistant.generated.json');
// The source is JSONC (trailing commas, comments), which JSON.parse rejects.
const jsonc = await readFile(sourcePath, 'utf8');
const config = JSON.parse(
  jsonc
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/,(\s*[}\]])/g, '$1'),
);

if (environment === 'preview') {
  config.env.preview.d1_databases[0].database_id = databaseId;
  const previewOrigin = process.env.ASSISTANT_PREVIEW_ORIGIN;
  if (previewOrigin) {
    config.env.preview.vars.ALLOWED_ORIGINS = [
      config.env.preview.vars.ALLOWED_ORIGINS,
      previewOrigin,
    ].join(',');
  }
} else {
  config.d1_databases[0].database_id = databaseId;
}

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(config, null, 2)}\n`);
console.log(outputPath);
