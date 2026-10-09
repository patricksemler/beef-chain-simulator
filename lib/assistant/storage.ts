/**
 * # Storage
 *
 * ## What this file is for
 * This file helps run the simulator experience and shows the controls and results people use to test scenarios.
 *
 * ## What it does
 * - Helps the app show the right page, section, or feature.
 * - Accepts or sends data needed by the rest of the app.
 * - Keeps the code organized so it is easier to understand and update.
 *
 * ## Main pieces in this file
 * - `emptyAssistantSession`: the main thing this file provides to the app.
 * - Other small helper functions or values support that main work.
 *
 * ## Important tools and connections
 * - Uses project code and libraries that help the app run smoothly.
 * - Works with the rest of the simulator, dashboard, or UI layers.
 *
 * ## How data moves through it
 * Data usually comes in from a user action or from another part of the app. This file reads that information, applies the needed logic, and then sends it on or displays it on screen.
 *
 * ## Errors and edge cases
 * The code checks for missing, unusual, or invalid values and tries to handle them safely. If something is not valid, it usually falls back to a safe default or prevents the bad input from continuing.
 *
 * ## How it fits into the app
 * This file is one small part of the larger system. It connects to other sections so the app feels like one working tool instead of separate pieces.
 *
 * ## Helpful notes
 * The goal here is to keep the code simple, clear, and easy to maintain without changing how the app behaves.
 */
import type { UIMessage } from 'ai';
import { isAssistantProvider } from './models';
import type {
  AssistantProvider,
  AssistantSessionState,
  ConversationSummary,
} from './types';

const STORAGE_KEY = 'beef-dashboard-assistant-v1';

function newSessionId() {
  return crypto.randomUUID();
}

export function emptyAssistantSession(
  provider: AssistantProvider = 'openai',
): AssistantSessionState {
  return {
    provider,
    apiKey: '',
    sessionId: newSessionId(),
    messages: [],
    summary: null,
    userMessageCount: 0,
  };
}

export function loadAssistantSession(): AssistantSessionState {
  if (typeof window === 'undefined') return emptyAssistantSession();
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyAssistantSession();
    const parsed = JSON.parse(raw) as Partial<AssistantSessionState>;
    if (!isAssistantProvider(parsed.provider)) return emptyAssistantSession();
    return {
      provider: parsed.provider,
      apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : '',
      sessionId:
        typeof parsed.sessionId === 'string' ? parsed.sessionId : newSessionId(),
      messages: Array.isArray(parsed.messages)
        ? (parsed.messages as UIMessage[])
        : [],
      summary: isSummary(parsed.summary) ? parsed.summary : null,
      userMessageCount:
        typeof parsed.userMessageCount === 'number'
          ? parsed.userMessageCount
          : 0,
    };
  } catch {
    return emptyAssistantSession();
  }
}

function isSummary(value: unknown): value is ConversationSummary {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as ConversationSummary).text === 'string' &&
    Array.isArray((value as ConversationSummary).referencedMetricIds)
  );
}

export function saveAssistantSession(state: AssistantSessionState) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function estimatedConversationTokens(messages: UIMessage[]) {
  return Math.ceil(JSON.stringify(messages).length / 4);
}
