import { tool } from '@ai-sdk/provider-utils';
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  generateText,
  Output,
  stepCountIs,
  streamText,
  toUIMessageStream,
  validateUIMessages,
} from 'ai';
import { z } from 'zod';
import {
  createAssistantModel,
  providerOptions,
} from '../lib/assistant/provider';
import { ASSISTANT_SYSTEM_PROMPT } from '../lib/assistant/prompt';
import {
  claimTurn,
  consumeUserMessage,
  recordTurnSteps,
  releaseTurn,
  sha256,
  type AssistantD1,
} from '../lib/assistant/rate-limit';
import {
  assistantRequestSchema,
  compactRequestSchema,
  scenarioChangeSchema,
  turnCancelSchema,
  validateRequestSchema,
} from '../lib/assistant/schemas';
import {
  getMetricDefinitions,
  getMetricHistory,
  getMetricSources,
  getMetricValues,
  locateDashboardItems,
  selectDashboardSnapshot,
} from '../lib/assistant/tools';
import type { DashboardSnapshot } from '../lib/assistant/types';

interface Env {
  ASSISTANT_DB: AssistantD1;
  IP_HASH_SALT: string;
  ALLOWED_ORIGINS: string;
}

const MAX_BODY_BYTES = 256_000;
const MAX_MESSAGE_CHARS = 8_000;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function allowedOrigin(origin: string, env: Env) {
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;
  return env.ALLOWED_ORIGINS.split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .includes(origin);
}

function corsHeaders(origin: string) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers':
      'Authorization, Content-Type, X-Session-ID, X-Turn-ID, X-New-User-Message',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(
  origin: string,
  body: unknown,
  status = 200,
  headers?: HeadersInit,
) {
  const responseHeaders = new Headers(corsHeaders(origin));
  new Headers(headers).forEach((value, name) =>
    responseHeaders.set(name, value),
  );
  return Response.json(body, {
    status,
    headers: responseHeaders,
  });
}

function redactedError(error: unknown) {
  const status =
    typeof error === 'object' && error !== null && 'statusCode' in error
      ? Number(error.statusCode)
      : 0;
  if (status === 401 || status === 403)
    return 'The provider rejected this API key.';
  if (status === 429)
    return 'The provider rate limit was reached. Try again shortly.';
  return 'The provider request failed. Check the selected provider and key.';
}

function bearerKey(request: Request) {
  const authorization = request.headers.get('Authorization') ?? '';
  const match = authorization.match(/^Bearer (.+)$/);
  return match?.[1] ?? null;
}

async function readJson(request: Request) {
  const size = Number(request.headers.get('Content-Length') ?? 0);
  if (size > MAX_BODY_BYTES) throw new Error('REQUEST_TOO_LARGE');
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) {
    throw new Error('REQUEST_TOO_LARGE');
  }
  return JSON.parse(text) as unknown;
}

function hasOversizedUserMessage(messages: Array<Record<string, unknown>>) {
  return messages.some((message) => {
    if (message.role !== 'user' || !Array.isArray(message.parts)) return false;
    const textLength = message.parts.reduce((length, part) => {
      if (
        typeof part === 'object' &&
        part !== null &&
        (part as Record<string, unknown>).type === 'text' &&
        typeof (part as Record<string, unknown>).text === 'string'
      ) {
        return length + String((part as Record<string, unknown>).text).length;
      }
      return length;
    }, 0);
    return textLength > MAX_MESSAGE_CHARS;
  });
}

function assistantTools(snapshot: DashboardSnapshot) {
  return {
    get_dashboard_snapshot: tool({
      description:
        'Return requested portions of the frozen dashboard snapshot for this user message.',
      inputSchema: z
        .object({
          sections: z
            .array(
              z.enum([
                'status',
                'inputs',
                'headline',
                'phases',
                'flow',
                'details',
                'monthly',
                'sensitivity',
              ]),
            )
            .min(1)
            .max(8),
        })
        .strict(),
      execute: async ({ sections }) =>
        selectDashboardSnapshot(snapshot, sections),
    }),
    get_metric_value: tool({
      description:
        'Return dashboard or historical values for one or more registered metrics.',
      inputSchema: z
        .object({
          metricIds: z.array(z.string()).min(1).max(20),
          years: z.array(z.number().int()).min(1).max(11).nullable(),
        })
        .strict(),
      execute: async ({ metricIds, years }) =>
        getMetricValues(snapshot, metricIds, years),
    }),
    get_metric_history: tool({
      description:
        'Return the supported annual history for one registered metric.',
      inputSchema: z
        .object({
          metricId: z.string(),
          startYear: z.number().int().nullable(),
          endYear: z.number().int().nullable(),
        })
        .strict(),
      execute: async ({ metricId, startYear, endYear }) =>
        getMetricHistory(metricId, startYear, endYear),
    }),
    get_metric_definition: tool({
      description: 'Explain registered dashboard or model terminology.',
      inputSchema: z
        .object({ metricIds: z.array(z.string()).min(1).max(20) })
        .strict(),
      execute: async ({ metricIds }) => getMetricDefinitions(metricIds),
    }),
    get_metric_source: tool({
      description: 'Return verified source metadata for registered metrics.',
      inputSchema: z
        .object({ metricIds: z.array(z.string()).min(1).max(20) })
        .strict(),
      execute: async ({ metricIds }) => getMetricSources(metricIds),
    }),
    compare_scenarios: tool({
      description:
        'Run up to three read-only scenario comparisons in the browser using the dashboard simulation engine.',
      inputSchema: z
        .object({
          base: z.enum(['draft', 'displayed']),
          variants: z
            .array(
              z
                .object({
                  label: z.string().min(1).max(80),
                  referenceYear: z.number().int().nullable(),
                  changes: z.array(scenarioChangeSchema).max(30),
                })
                .strict(),
            )
            .min(1)
            .max(3),
          outputMetricIds: z.array(z.string()).min(1).max(20),
        })
        .strict(),
    }),
    locate_dashboard_item: tool({
      description:
        'Return a verified result tab, scenario section, and user-clickable navigation action.',
      inputSchema: z
        .object({ itemIds: z.array(z.string()).min(1).max(10) })
        .strict(),
      execute: async ({ itemIds }) => locateDashboardItems(itemIds),
    }),
    propose_scenario_change: tool({
      description:
        'Validate a scenario patch in the browser and return a reviewed Apply & Run action. Does not mutate the dashboard.',
      inputSchema: z
        .object({
          base: z.enum(['draft', 'displayed']),
          changes: z.array(scenarioChangeSchema).min(1).max(30),
        })
        .strict(),
    }),
  };
}

async function handleValidate(request: Request, env: Env, origin: string) {
  const key = bearerKey(request);
  if (!key) return json(origin, { error: 'An API key is required.' }, 401);
  const parsed = validateRequestSchema.safeParse(await readJson(request));
  if (!parsed.success)
    return json(origin, { error: 'Unsupported provider or model.' }, 400);
  try {
    const model = createAssistantModel(
      parsed.data.provider,
      key,
      parsed.data.model,
    );
    await generateText({
      model,
      prompt: 'Call the connection_check tool.',
      tools: {
        connection_check: tool({
          description: 'Confirm that tool calling works.',
          inputSchema: z.object({}).strict(),
          execute: async () => ({ ok: true }),
        }),
      },
      toolChoice: 'required',
      stopWhen: stepCountIs(1),
      providerOptions: providerOptions(parsed.data.provider),
    });
    return json(origin, { ok: true });
  } catch (error) {
    return json(origin, { error: redactedError(error) }, 400);
  }
}

async function handleCompact(request: Request, origin: string) {
  const key = bearerKey(request);
  if (!key) return json(origin, { error: 'An API key is required.' }, 401);
  const parsed = compactRequestSchema.safeParse(await readJson(request));
  if (!parsed.success || hasOversizedUserMessage(parsed.data?.messages ?? [])) {
    return json(origin, { error: 'Invalid compaction request.' }, 400);
  }
  try {
    const { provider, model, messages, previousSummary } = parsed.data;
    const result = await generateText({
      model: createAssistantModel(provider, key, model),
      prompt: `Summarize this beef-dashboard conversation for a later model. Preserve metric IDs, referenced values with units and years, whether displayed results were stale, conclusions, and pending dashboard actions.\n\nPrevious summary:\n${previousSummary ?? 'None'}\n\nMessages:\n${JSON.stringify(messages)}`,
      output: Output.object({
        schema: z
          .object({
            text: z.string().max(8_000),
            referencedMetricIds: z.array(z.string()).max(100),
            snapshotStatus: z.string().max(1_000),
            pendingActions: z.array(z.string()).max(20),
          })
          .strict(),
      }),
      providerOptions: providerOptions(provider),
    });
    return json(origin, result.output);
  } catch (error) {
    return json(origin, { error: redactedError(error) }, 400);
  }
}

async function handleChat(request: Request, env: Env, origin: string) {
  const key = bearerKey(request);
  const sessionId = request.headers.get('X-Session-ID');
  const turnId = request.headers.get('X-Turn-ID');
  if (
    !key ||
    !sessionId ||
    !turnId ||
    !UUID_PATTERN.test(sessionId) ||
    !UUID_PATTERN.test(turnId)
  ) {
    return json(
      origin,
      { error: 'Missing assistant credentials or turn identifiers.' },
      401,
    );
  }
  if (!env.IP_HASH_SALT || env.IP_HASH_SALT.length < 16) {
    return json(origin, { error: 'Assistant service is not configured.' }, 503);
  }
  const sessionHash = await sha256(`${env.IP_HASH_SALT}:session:${sessionId}`);
  const turnHash = await sha256(`${env.IP_HASH_SALT}:turn:${turnId}`);
  const turn = await claimTurn(env.ASSISTANT_DB, sessionHash, turnHash);
  if (!turn.claimed) {
    return json(
      origin,
      { error: 'Another assistant turn is already active.' },
      409,
    );
  }
  if (turn.stepsUsed >= 6) {
    await releaseTurn(env.ASSISTANT_DB, sessionHash, turnHash);
    return json(
      origin,
      { error: 'This assistant turn reached its tool-step limit.' },
      400,
    );
  }
  const isNewMessage = request.headers.get('X-New-User-Message') === '1';
  if (isNewMessage) {
    const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
    const ipHash = await sha256(`${env.IP_HASH_SALT}:ip:${ip}`);
    const limit = await consumeUserMessage(env.ASSISTANT_DB, ipHash);
    if (!limit.allowed) {
      await releaseTurn(env.ASSISTANT_DB, sessionHash, turnHash);
      return json(
        origin,
        { error: 'Assistant message limit reached. Try again shortly.' },
        429,
        { 'Retry-After': String(Math.max(1, limit.retryAfter)) },
      );
    }
  }
  try {
    const parsed = assistantRequestSchema.safeParse(await readJson(request));
    if (
      !parsed.success ||
      hasOversizedUserMessage(parsed.data?.messages ?? [])
    ) {
      await releaseTurn(env.ASSISTANT_DB, sessionHash, turnHash);
      return json(origin, { error: 'Invalid assistant request.' }, 400);
    }
    const { provider, model, messages, snapshot, summary } = parsed.data;
    const tools = assistantTools(snapshot as unknown as DashboardSnapshot);
    const validatedMessages = await validateUIMessages({ messages, tools });
    const system = `${ASSISTANT_SYSTEM_PROMPT}\n\nConversation summary:\n${summary ? JSON.stringify(summary) : 'No prior summary.'}`;
    const result = streamText({
      model: createAssistantModel(provider, key, model),
      instructions: system,
      messages: await convertToModelMessages(validatedMessages, { tools }),
      tools,
      stopWhen: stepCountIs(6 - turn.stepsUsed),
      providerOptions: providerOptions(provider),
      onEnd: async ({ finishReason, steps }) => {
        await recordTurnSteps(
          env.ASSISTANT_DB,
          sessionHash,
          turnHash,
          steps.length,
        );
        if (finishReason !== 'tool-calls') {
          await releaseTurn(env.ASSISTANT_DB, sessionHash, turnHash);
        }
      },
      onAbort: async () => releaseTurn(env.ASSISTANT_DB, sessionHash, turnHash),
    });
    return createUIMessageStreamResponse({
      stream: toUIMessageStream({
        stream: result.stream,
        tools,
        originalMessages: validatedMessages,
        onError: () =>
          'The selected model provider could not complete this request.',
      }),
      headers: corsHeaders(origin),
    });
  } catch (error) {
    await releaseTurn(env.ASSISTANT_DB, sessionHash, turnHash);
    return json(origin, { error: redactedError(error) }, 400);
  }
}

async function handleCancel(request: Request, env: Env, origin: string) {
  const sessionId = request.headers.get('X-Session-ID');
  if (!sessionId || !UUID_PATTERN.test(sessionId))
    return json(origin, { error: 'Missing session identifier.' }, 400);
  const parsed = turnCancelSchema.safeParse(await readJson(request));
  if (!parsed.success)
    return json(origin, { error: 'Invalid turn identifier.' }, 400);
  if (!env.IP_HASH_SALT || env.IP_HASH_SALT.length < 16) {
    return json(origin, { error: 'Assistant service is not configured.' }, 503);
  }
  const sessionHash = await sha256(`${env.IP_HASH_SALT}:session:${sessionId}`);
  const turnHash = await sha256(
    `${env.IP_HASH_SALT}:turn:${parsed.data.turnId}`,
  );
  await releaseTurn(env.ASSISTANT_DB, sessionHash, turnHash);
  return json(origin, { ok: true });
}

const assistantWorker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin') ?? '';
    if (!origin || !allowedOrigin(origin, env)) {
      return Response.json({ error: 'Origin not allowed.' }, { status: 403 });
    }
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }
    if (request.method !== 'POST')
      return json(origin, { error: 'Not found.' }, 404);
    try {
      const path = new URL(request.url).pathname;
      if (path === '/v1/validate') return handleValidate(request, env, origin);
      if (path === '/v1/chat') return handleChat(request, env, origin);
      if (path === '/v1/compact') return handleCompact(request, origin);
      if (path === '/v1/turn/cancel') return handleCancel(request, env, origin);
      return json(origin, { error: 'Not found.' }, 404);
    } catch (error) {
      if (error instanceof Error && error.message === 'REQUEST_TOO_LARGE') {
        return json(origin, { error: 'Request is too large.' }, 413);
      }
      return json(origin, { error: 'Invalid request.' }, 400);
    }
  },
};

export default assistantWorker;
