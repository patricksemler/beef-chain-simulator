'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { ArrowUp, Bot, MessageCircle, Plus, Square, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ASSISTANT_MODELS, ASSISTANT_PROVIDERS } from '@/lib/assistant/models';
import { SOURCE_REGISTRY } from '@/lib/assistant/metrics';
import {
  emptyAssistantSession,
  estimatedConversationTokens,
  loadAssistantSession,
  saveAssistantSession,
} from '@/lib/assistant/storage';
import type {
  AssistantProvider,
  DashboardSnapshot,
} from '@/lib/assistant/types';

const API_URL = (
  import.meta.env.VITE_ASSISTANT_API_URL ?? 'http://localhost:8787'
).replace(/\/$/, '');

interface Props {
  getSnapshot: () => DashboardSnapshot;
  /** Reference year of the displayed results, used for the example question. */
  referenceYear: number;
}

function messageText(message: UIMessage) {
  return message.parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('');
}

function resolveSourceTokens(text: string) {
  const ids = new Set<string>();
  const markdown = text.replace(
    /\s?\[source:([a-zA-Z0-9_-]+)\]/g,
    (_, id: string) => {
      const source = SOURCE_REGISTRY[id];
      if (!source) return '';
      ids.add(id);
      return source.url?.startsWith('https://')
        ? ` ([${source.organization}: ${source.label}](${source.url}))`
        : '';
    },
  );
  return { markdown, ids: [...ids] };
}

function safeLink(url: string) {
  if (!url.startsWith('https://')) return '';
  return Object.values(SOURCE_REGISTRY).some((source) => source.url === url)
    ? url
    : '';
}

/** The monthly series is never shown on screen, so it stays out of the prompt. */
function snapshotForPrompt(snapshot: DashboardSnapshot): DashboardSnapshot {
  return {
    ...snapshot,
    displayedResult: snapshot.displayedResult
      ? { ...snapshot.displayedResult, monthly: [] }
      : null,
  };
}

export function AssistantWidget({ getSnapshot, referenceYear }: Props) {
  const [initialSession] = useState(loadAssistantSession);
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState(initialSession.provider);
  const [apiKey, setApiKey] = useState(initialSession.apiKey);
  const [connected, setConnected] = useState(Boolean(initialSession.apiKey));
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [input, setInput] = useState('');
  const [summary, setSummary] = useState(initialSession.summary);
  const [userMessageCount, setUserMessageCount] = useState(
    initialSession.userMessageCount,
  );
  const [sessionId, setSessionId] = useState(initialSession.sessionId);
  const [isCompacting, setIsCompacting] = useState(false);

  const providerRef = useRef(provider);
  const apiKeyRef = useRef(apiKey);
  const summaryRef = useRef(summary);
  const snapshotRef = useRef<DashboardSnapshot | null>(null);
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const keyInputRef = useRef<HTMLInputElement | null>(null);
  const lastCompactedCountRef = useRef(
    Math.floor(initialSession.userMessageCount / 12) * 12,
  );

  useEffect(() => {
    providerRef.current = provider;
    apiKeyRef.current = apiKey;
    summaryRef.current = summary;
  }, [provider, apiKey, summary]);

  // The transport reads these refs after user actions, never during render.
  /* oxlint-disable react/react-compiler */
  const [transport] = useState(
    () =>
      new DefaultChatTransport<UIMessage>({
        api: `${API_URL}/v1/chat`,
        prepareSendMessagesRequest: ({ messages }) => {
          const selected = providerRef.current;
          return {
            headers: { Authorization: `Bearer ${apiKeyRef.current}` },
            body: {
              provider: selected,
              model: ASSISTANT_MODELS[selected].model,
              messages,
              snapshot: snapshotRef.current,
              summary: summaryRef.current,
            },
          };
        },
      }),
  );
  /* oxlint-enable react/react-compiler */

  const chat = useChat<UIMessage>({
    id: initialSession.sessionId,
    messages: initialSession.messages,
    transport,
    throttle: 40,
  });

  useEffect(() => {
    saveAssistantSession({
      provider,
      apiKey,
      sessionId,
      messages: chat.messages,
      summary,
      userMessageCount,
    });
  }, [provider, apiKey, sessionId, chat.messages, summary, userMessageCount]);

  // Keep the newest message in view while answers stream in.
  useEffect(() => {
    const element = messagesRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [chat.messages, chat.status, isCompacting]);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      (connected ? composerRef.current : keyInputRef.current)?.focus();
    });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, connected]);

  const compact = useCallback(async () => {
    if (!connected || isCompacting || chat.messages.length < 12) return;
    setIsCompacting(true);
    try {
      const response = await fetch(`${API_URL}/v1/compact`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider,
          model: ASSISTANT_MODELS[provider].model,
          messages: chat.messages,
          previousSummary: summary,
        }),
      });
      if (!response.ok) throw new Error('Conversation compaction failed.');
      const body = (await response.json()) as { text?: string };
      if (typeof body.text !== 'string') throw new Error('Invalid summary.');
      setSummary(body.text);
      summaryRef.current = body.text;
      chat.setMessages(chat.messages.slice(-12));
      lastCompactedCountRef.current = userMessageCount;
    } catch {
      // Keep the complete local history when compaction is unavailable.
    } finally {
      setIsCompacting(false);
    }
  }, [
    apiKey,
    chat,
    connected,
    isCompacting,
    provider,
    summary,
    userMessageCount,
  ]);

  useEffect(() => {
    if (chat.status !== 'ready') return;
    const dueByTurns = userMessageCount - lastCompactedCountRef.current >= 12;
    const dueBySize =
      userMessageCount > lastCompactedCountRef.current &&
      estimatedConversationTokens(chat.messages) >= 8_000;
    if (dueByTurns || dueBySize) void compact();
  }, [chat.messages, chat.status, compact, userMessageCount]);

  const resetChat = useCallback(() => {
    const next = emptyAssistantSession(provider);
    setSessionId(next.sessionId);
    setSummary(null);
    summaryRef.current = null;
    setUserMessageCount(0);
    lastCompactedCountRef.current = 0;
    chat.setMessages([]);
    chat.clearError();
    composerRef.current?.focus();
  }, [chat, provider]);

  async function validateConnection() {
    setIsValidating(true);
    setConnectionError(null);
    try {
      const response = await fetch(`${API_URL}/v1/validate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey.trim()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider,
          model: ASSISTANT_MODELS[provider].model,
        }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? 'Connection failed.');
      apiKeyRef.current = apiKey.trim();
      setApiKey(apiKey.trim());
      setConnected(true);
    } catch (error) {
      setConnected(false);
      setConnectionError(
        error instanceof Error ? error.message : 'Connection failed.',
      );
    } finally {
      setIsValidating(false);
    }
  }

  function disconnect() {
    setConnected(false);
    setApiKey('');
    apiKeyRef.current = '';
    setConnectionError(null);
  }

  const isBusy =
    chat.status === 'submitted' || chat.status === 'streaming' || isCompacting;

  async function submit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = input.trim();
    if (!text || isBusy || !connected) return;
    if (chat.error) chat.clearError();
    if (userMessageCount >= 40) resetChat();
    snapshotRef.current = snapshotForPrompt(structuredClone(getSnapshot()));
    setInput('');
    setUserMessageCount((count) => count + 1);
    await chat.sendMessage({ text });
  }

  const lastMessage = chat.messages[chat.messages.length - 1];
  const isThinking =
    chat.status === 'submitted' ||
    (chat.status === 'streaming' &&
      (lastMessage?.role !== 'assistant' || !messageText(lastMessage)));
  const placeholder = `Why is stocker profit so low in ${referenceYear}?`;

  return (
    <div className="assistant-widget" data-open={open ? '' : undefined}>
      <dialog
        id="assistant-panel"
        className="assistant-panel"
        aria-label="Beef Dashboard Assistant"
        data-connected={connected ? '' : undefined}
        open={open}
      >
        <header className="assistant-panel-header">
          <div className="assistant-panel-title">
            <span className="assistant-avatar" aria-hidden="true">
              <Bot className="size-4" />
            </span>
            <div>
              <h2>Beef Dashboard Assistant</h2>
              {connected ? (
                <p>
                  {ASSISTANT_MODELS[provider].label} ·{' '}
                  {ASSISTANT_MODELS[provider].model}
                </p>
              ) : null}
            </div>
          </div>
          <div className="assistant-panel-tools">
            {connected ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={resetChat}
                disabled={isBusy || chat.messages.length === 0}
                title="New chat"
                aria-label="Start a new chat"
              >
                <Plus className="size-4" aria-hidden="true" />
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setOpen(false)}
              title="Close"
              aria-label="Close assistant"
            >
              <X className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </header>

        {!connected ? (
          <form
            className="assistant-connect"
            onSubmit={(event) => {
              event.preventDefault();
              if (apiKey.trim() && !isValidating) void validateConnection();
            }}
          >
            <div className="assistant-connect-intro">
              <h3>Connect a model</h3>
              <p>
                Use your own provider key. It stays in this tab and is sent only
                to the assistant API over HTTPS.
              </p>
            </div>
            <div className="assistant-connect-field">
              <Label htmlFor="assistant-provider">Provider</Label>
              <select
                id="assistant-provider"
                className="assistant-select"
                value={provider}
                onChange={(event) => {
                  setProvider(event.target.value as AssistantProvider);
                  setConnectionError(null);
                }}
              >
                {ASSISTANT_PROVIDERS.map((value) => (
                  <option key={value} value={value}>
                    {ASSISTANT_MODELS[value].label} ·{' '}
                    {ASSISTANT_MODELS[value].model}
                  </option>
                ))}
              </select>
            </div>
            <div className="assistant-connect-field">
              <Label htmlFor="assistant-api-key">API key</Label>
              <Input
                ref={keyInputRef}
                id="assistant-api-key"
                type="password"
                autoComplete="off"
                spellCheck={false}
                placeholder={ASSISTANT_MODELS[provider].keyPlaceholder}
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
              />
            </div>
            <div className="assistant-connect-status" aria-live="polite">
              {connectionError ? (
                <p role="alert">{connectionError}</p>
              ) : (
                <p>
                  Keys are kept in session storage and cleared with the tab.
                </p>
              )}
            </div>
            <Button
              type="submit"
              className="assistant-connect-button"
              disabled={!apiKey.trim() || isValidating}
            >
              {isValidating ? 'Checking connection…' : 'Connect'}
            </Button>
          </form>
        ) : (
          <>
            <div
              ref={messagesRef}
              className="assistant-messages"
              aria-live="polite"
            >
              {chat.messages.map((message) => (
                <AssistantMessageView key={message.id} message={message} />
              ))}
              {isThinking ? <ThinkingIndicator /> : null}
              {isCompacting ? (
                <p className="assistant-status">
                  Compacting conversation context…
                </p>
              ) : null}
              {chat.error ? (
                <p role="alert" className="assistant-error">
                  {chat.error.message}
                </p>
              ) : null}
            </div>
            <form className="assistant-composer" onSubmit={submit}>
              <div className="assistant-composer-row">
                <Textarea
                  ref={composerRef}
                  aria-label="Ask the dashboard assistant"
                  placeholder={placeholder}
                  value={input}
                  onChange={(event) =>
                    setInput(event.target.value.slice(0, 8_000))
                  }
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      event.currentTarget.form?.requestSubmit();
                    }
                  }}
                  disabled={isBusy}
                  rows={2}
                />
                {isBusy ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-lg"
                    className="assistant-send"
                    onClick={() => void chat.stop()}
                    title="Stop"
                    aria-label="Stop generating"
                  >
                    <Square
                      className="size-3.5 fill-current"
                      aria-hidden="true"
                    />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    size="icon-lg"
                    className="assistant-send"
                    disabled={!input.trim()}
                    title="Send"
                    aria-label="Send"
                  >
                    <ArrowUp className="size-4" aria-hidden="true" />
                  </Button>
                )}
              </div>
              <div className="assistant-composer-footer">
                <span>Answers use the values currently on screen.</span>
                <button
                  type="button"
                  className="assistant-link"
                  onClick={disconnect}
                  disabled={isBusy}
                >
                  Change key
                </button>
              </div>
            </form>
          </>
        )}
      </dialog>

      <button
        type="button"
        className="assistant-launcher"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="assistant-panel"
        aria-label="Open assistant"
        hidden={open}
      >
        <MessageCircle className="size-5" aria-hidden="true" />
        <span className="assistant-launcher-label">Ask</span>
      </button>
    </div>
  );
}

function ThinkingIndicator() {
  return (
    <div className="assistant-message assistant-thinking" data-role="assistant">
      <span className="assistant-thinking-dots" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      <span className="assistant-thinking-text">Thinking…</span>
    </div>
  );
}

function AssistantMessageView({ message }: { message: UIMessage }) {
  const text = messageText(message);
  if (!text) return null;
  const { markdown, ids } =
    message.role === 'assistant'
      ? resolveSourceTokens(text)
      : { markdown: text, ids: [] };

  return (
    <article className="assistant-message" data-role={message.role}>
      {message.role === 'assistant' ? (
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          urlTransform={safeLink}
          components={{
            a: ({ href, children }) => (
              <a href={href} target="_blank" rel="noreferrer">
                {children}
              </a>
            ),
          }}
        >
          {markdown}
        </ReactMarkdown>
      ) : (
        <p>{text}</p>
      )}
      {ids.length ? (
        <div className="assistant-source-cards">
          {ids.map((id) => {
            const source = SOURCE_REGISTRY[id];
            return (
              <div key={id} className="assistant-source-card">
                <span>{source.organization}</span>
                <strong>{source.label}</strong>
              </div>
            );
          })}
        </div>
      ) : null}
    </article>
  );
}
