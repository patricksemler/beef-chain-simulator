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
