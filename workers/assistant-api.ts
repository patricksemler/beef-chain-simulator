import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  generateText,
  streamText,
  toUIMessageStream,
  validateUIMessages,
} from 'ai';
import {
  createAssistantModel,
  providerOptions,
} from '../lib/assistant/provider';
import { buildInstructions } from '../lib/assistant/prompt';
import {
  consumeUserMessage,
  sha256,
  type AssistantD1,
} from '../lib/assistant/rate-limit';
import {
  assistantRequestSchema,
  compactRequestSchema,
  validateRequestSchema,
} from '../lib/assistant/schemas';
import type { DashboardSnapshot } from '../lib/assistant/types';

interface Env {
  ASSISTANT_DB: AssistantD1;
  IP_HASH_SALT: string;
  ALLOWED_ORIGINS: string;
}

const MAX_BODY_BYTES = 512_000;
const MAX_MESSAGE_CHARS = 8_000;
const MAX_ANSWER_TOKENS = 2_000;

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
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
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
  return Response.json(body, { status, headers: responseHeaders });
}

/** Maps provider failures to safe messages without leaking request details. */
function redactedError(error: unknown) {
  const detail =
    typeof error === 'object' && error !== null && 'lastError' in error
      ? (error as { lastError: unknown }).lastError
      : error;
  const status =
    typeof detail === 'object' && detail !== null && 'statusCode' in detail
      ? Number((detail as { statusCode: unknown }).statusCode)
      : 0;
  if (status === 401 || status === 403)
    return 'The provider rejected this API key.';
  if (status === 429)
    return 'The provider rate limit or quota for this key was reached. Wait a minute and try again.';
  if (status === 503 || status === 529)
    return 'The model is experiencing high demand right now. Try again shortly.';
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

async function handleValidate(request: Request, origin: string) {
  const key = bearerKey(request);
  if (!key) return json(origin, { error: 'An API key is required.' }, 401);
  const parsed = validateRequestSchema.safeParse(await readJson(request));
  if (!parsed.success)
    return json(origin, { error: 'Unsupported provider or model.' }, 400);
  try {
    await generateText({
      model: createAssistantModel(parsed.data.provider, key, parsed.data.model),
      prompt: 'Reply with the single word OK.',
      maxOutputTokens: 64,
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
      prompt: `Summarize this conversation between a user and the Beef Chain Simulator dashboard assistant so a later model can continue it. Keep it under 300 words. Preserve the questions asked, the specific dashboard values discussed (with units and reference years), conclusions reached, and anything the user said they planned to change.\n\nPrevious summary:\n${previousSummary ?? 'None'}\n\nMessages:\n${JSON.stringify(messages)}`,
      maxOutputTokens: 800,
      providerOptions: providerOptions(provider),
    });
    return json(origin, { text: result.text.slice(0, 8_000) });
  } catch (error) {
    return json(origin, { error: redactedError(error) }, 400);
  }
}

async function handleChat(request: Request, env: Env, origin: string) {
  const key = bearerKey(request);
  if (!key) return json(origin, { error: 'An API key is required.' }, 401);
  if (!env.IP_HASH_SALT || env.IP_HASH_SALT.length < 16) {
    return json(origin, { error: 'Assistant service is not configured.' }, 503);
  }
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const ipHash = await sha256(`${env.IP_HASH_SALT}:ip:${ip}`);
  const limit = await consumeUserMessage(env.ASSISTANT_DB, ipHash);
  if (!limit.allowed) {
    return json(
      origin,
      { error: 'Assistant message limit reached. Try again shortly.' },
      429,
      { 'Retry-After': String(Math.max(1, limit.retryAfter)) },
    );
  }
  try {
    const parsed = assistantRequestSchema.safeParse(await readJson(request));
    if (
      !parsed.success ||
      hasOversizedUserMessage(parsed.data?.messages ?? [])
    ) {
      return json(origin, { error: 'Invalid assistant request.' }, 400);
    }
    const { provider, model, messages, snapshot, summary } = parsed.data;
    const validatedMessages = await validateUIMessages({ messages });
    const result = streamText({
      model: createAssistantModel(provider, key, model),
      instructions: buildInstructions(
        snapshot as unknown as DashboardSnapshot,
        summary,
      ),
      messages: await convertToModelMessages(validatedMessages),
      maxOutputTokens: MAX_ANSWER_TOKENS,
      maxRetries: 1,
      providerOptions: providerOptions(provider),
    });
    return createUIMessageStreamResponse({
      stream: toUIMessageStream({
        stream: result.stream,
        originalMessages: validatedMessages,
        onError: (error) => redactedError(error),
      }),
      headers: corsHeaders(origin),
    });
  } catch (error) {
    return json(origin, { error: redactedError(error) }, 400);
  }
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
      if (path === '/v1/validate') return handleValidate(request, origin);
      if (path === '/v1/chat') return handleChat(request, env, origin);
      if (path === '/v1/compact') return handleCompact(request, origin);
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
