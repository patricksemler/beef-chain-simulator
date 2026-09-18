'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithToolCalls,
  type UIMessage,
} from 'ai';
import { Bot, KeyRound, Navigation, Plus, Send, Square } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
// oxlint-disable-next-line import/default -- Vite's ?worker loader provides the constructor.
import AssistantSimulationWorker from '../../workers/assistant-simulation.worker.ts?worker';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { ASSISTANT_MODELS, ASSISTANT_PROVIDERS } from '@/lib/assistant/models';
import { SOURCE_REGISTRY } from '@/lib/assistant/metrics';
import {
  applyScenarioChanges,
  scenarioChangeDiff,
} from '@/lib/assistant/scenarios';
import {
  emptyAssistantSession,
  estimatedConversationTokens,
  loadAssistantSession,
  saveAssistantSession,
} from '@/lib/assistant/storage';
import type {
  AssistantProvider,
  ConversationSummary,
  DashboardSnapshot,
  NavigateAction,
  ScenarioChange,
  UiLocation,
} from '@/lib/assistant/types';
import type { ScenarioInput } from '@/lib/model/types';

const API_URL = (
  import.meta.env.VITE_ASSISTANT_API_URL ?? 'http://localhost:8787'
).replace(/\/$/, '');

interface Props {
  getSnapshot: () => DashboardSnapshot;
  onNavigate: (target: UiLocation) => void;
  onApplyAndRun: (scenario: ScenarioInput) => void;
}

interface ToolCallInfo {
  toolCallId: string;
  toolName: string;
  input: unknown;
}

interface PendingApply {
  base: 'draft' | 'displayed';
  changes: ScenarioChange[];
  diff: Array<{ path: string; before: unknown; after: unknown }>;
  snapshot: DashboardSnapshot;
}

function runComparison(
  snapshot: DashboardSnapshot,
  input: {
    base: 'draft' | 'displayed';
    variants: Array<{
      label: string;
      referenceYear: number | null;
      changes: ScenarioChange[];
    }>;
    outputMetricIds: string[];
  },
) {
  return new Promise<unknown>((resolve, reject) => {
    const worker = new AssistantSimulationWorker();
    const requestId = crypto.randomUUID();
    worker.onmessage = (event) => {
      if (event.data.requestId !== requestId) return;
      worker.terminate();
      if (event.data.type === 'result') resolve(event.data.result);
      else reject(new Error(event.data.error ?? 'Comparison failed.'));
    };
    worker.onerror = () => {
      worker.terminate();
      reject(new Error('Comparison worker failed.'));
    };
    worker.postMessage({ requestId, snapshot, ...input });
  });
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
    /\[source:([a-zA-Z0-9_-]+)\]/g,
    (_, id: string) => {
      const source = SOURCE_REGISTRY[id];
      if (!source) return '';
      ids.add(id);
      return source.url?.startsWith('https://')
        ? `[${source.organization}: ${source.label}](${source.url})`
        : `(${source.label})`;
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

function collectActions(value: unknown): NavigateAction[] {
  if (Array.isArray(value)) return value.flatMap(collectActions);
  if (value === null || typeof value !== 'object') return [];
  const record = value as Record<string, unknown>;
  const own =
    record.type === 'navigate' &&
    typeof record.label === 'string' &&
    record.target
      ? [record as unknown as NavigateAction]
      : [];
  return [
    ...own,
    ...Object.values(record).flatMap((item) => collectActions(item)),
  ];
}

function toolOutput(part: UIMessage['parts'][number]) {
  if (!part.type.startsWith('tool-') && part.type !== 'dynamic-tool')
    return undefined;
  const record = part as unknown as Record<string, unknown>;
  return record.state === 'output-available' ? record.output : undefined;
}

export function AssistantDrawer({
  getSnapshot,
  onNavigate,
  onApplyAndRun,
}: Props) {
  const [initialSession] = useState(loadAssistantSession);
  const [provider, setProvider] = useState(initialSession.provider);
  const [apiKey, setApiKey] = useState(initialSession.apiKey);
  const [connected, setConnected] = useState(Boolean(initialSession.apiKey));
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [input, setInput] = useState('');
  const [summary, setSummary] = useState<ConversationSummary | null>(
    initialSession.summary,
  );
  const [userMessageCount, setUserMessageCount] = useState(
    initialSession.userMessageCount,
  );
  const [sessionId, setSessionId] = useState(initialSession.sessionId);
  const [isCompacting, setIsCompacting] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pendingApply, setPendingApply] = useState<PendingApply | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const providerRef = useRef(provider);
  const apiKeyRef = useRef(apiKey);
  const sessionIdRef = useRef(sessionId);
  const summaryRef = useRef(summary);
  const snapshotRef = useRef<DashboardSnapshot | null>(null);
  const turnIdRef = useRef<string | null>(null);
  const newMessageRef = useRef(false);
  const lastCompactedCountRef = useRef(
    Math.floor(initialSession.userMessageCount / 12) * 12,
  );
  const addToolOutputRef = useRef<
    | ((options: { tool: string; toolCallId: string; output: unknown }) => void)
    | null
  >(null);

  useEffect(() => {
    providerRef.current = provider;
    apiKeyRef.current = apiKey;
    sessionIdRef.current = sessionId;
    summaryRef.current = summary;
  }, [provider, apiKey, sessionId, summary]);

  // The transport invokes these callbacks after user actions, never during render.
  /* oxlint-disable react/react-compiler */
  const [transport] = useState(
    () =>
      new DefaultChatTransport<UIMessage>({
        api: `${API_URL}/v1/chat`,
        prepareSendMessagesRequest: ({ messages }) => {
          const turnId = turnIdRef.current ?? crypto.randomUUID();
          turnIdRef.current = turnId;
          const isNew = newMessageRef.current;
          newMessageRef.current = false;
          const selected = providerRef.current;
          return {
            headers: {
              Authorization: `Bearer ${apiKeyRef.current}`,
              'X-Session-ID': sessionIdRef.current,
              'X-Turn-ID': turnId,
              'X-New-User-Message': isNew ? '1' : '0',
            },
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
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    onToolCall: async ({ toolCall }) => {
      const call = toolCall as ToolCallInfo;
      if (!snapshotRef.current || !addToolOutputRef.current) return;
      try {
        if (call.toolName === 'compare_scenarios') {
          const output = await runComparison(
            snapshotRef.current,
            call.input as Parameters<typeof runComparison>[1],
          );
          addToolOutputRef.current({
            tool: call.toolName,
            toolCallId: call.toolCallId,
            output,
          });
        }
        if (call.toolName === 'propose_scenario_change') {
          const request = call.input as {
            base: 'draft' | 'displayed';
            changes: ScenarioChange[];
          };
          const baseScenario =
            request.base === 'displayed'
              ? snapshotRef.current.displayedResult?.scenario
              : snapshotRef.current.draftScenario;
          if (!baseScenario)
            throw new Error('No displayed scenario is available.');
          const diff = scenarioChangeDiff(baseScenario, request.changes);
          addToolOutputRef.current({
            tool: call.toolName,
            toolCallId: call.toolCallId,
            output: {
              valid: true,
              diff,
              action: {
                type: 'apply_scenario',
                label: 'Review and Apply & Run',
                base: request.base,
                changes: request.changes,
                runAfterApply: true,
              },
            },
          });
        }
      } catch (error) {
        addToolOutputRef.current({
          tool: call.toolName,
          toolCallId: call.toolCallId,
          output: {
            error:
              error instanceof Error ? error.message : 'Tool execution failed.',
          },
        });
      }
    },
    onFinish: ({ finishReason }) => {
      if (finishReason !== 'tool-calls') turnIdRef.current = null;
    },
  });
  useEffect(() => {
    addToolOutputRef.current = chat.addToolOutput;
  }, [chat.addToolOutput]);

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
          previousSummary: summary?.text ?? null,
        }),
      });
      if (!response.ok) throw new Error('Conversation compaction failed.');
      const nextSummary = (await response.json()) as ConversationSummary;
      setSummary(nextSummary);
      summaryRef.current = nextSummary;
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
    sessionIdRef.current = next.sessionId;
    setSummary(null);
    summaryRef.current = null;
    setUserMessageCount(0);
    lastCompactedCountRef.current = 0;
    turnIdRef.current = null;
    chat.setMessages([]);
    chat.clearError();
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

  async function submit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = input.trim();
    if (!text || chat.status !== 'ready' || isCompacting || !connected) return;
    if (userMessageCount >= 40) resetChat();
    snapshotRef.current = structuredClone(getSnapshot());
    turnIdRef.current = crypto.randomUUID();
    newMessageRef.current = true;
    setInput('');
    setUserMessageCount((count) => count + 1);
    await chat.sendMessage({
      text,
      metadata: { snapshotId: snapshotRef.current.id },
    });
  }

  async function stop() {
    const turnId = turnIdRef.current;
    await chat.stop();
    if (turnId) {
      await fetch(`${API_URL}/v1/turn/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-ID': sessionIdRef.current,
        },
        body: JSON.stringify({ turnId }),
      }).catch(() => undefined);
    }
    turnIdRef.current = null;
  }

  function requestApply(
    base: 'draft' | 'displayed',
    changes: ScenarioChange[],
  ) {
    const snapshot = snapshotRef.current ?? getSnapshot();
    const baseScenario =
      base === 'displayed'
        ? snapshot.displayedResult?.scenario
        : snapshot.draftScenario;
    if (!baseScenario) {
      setActionError('No displayed scenario is available.');
      return;
    }
    try {
      setPendingApply({
        base,
        changes,
        diff: scenarioChangeDiff(baseScenario, changes),
        snapshot,
      });
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : 'Invalid change.',
      );
    }
  }

  function confirmApply() {
    if (!pendingApply) return;
    const baseScenario =
      pendingApply.base === 'displayed'
        ? pendingApply.snapshot.displayedResult?.scenario
        : pendingApply.snapshot.draftScenario;
    if (!baseScenario) return;
    onApplyAndRun(applyScenarioChanges(baseScenario, pendingApply.changes));
    setPendingApply(null);
    setDrawerOpen(false);
  }

  const isBusy =
    chat.status === 'submitted' || chat.status === 'streaming' || isCompacting;

  return (
    <>
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetTrigger
          render={
            <Button variant="outline" className="assistant-header-button" />
          }
        >
          <Bot className="size-4" aria-hidden="true" />
          Assistant
        </SheetTrigger>
        <SheetContent className="assistant-sheet w-full max-w-none gap-0 sm:max-w-[32rem]">
          <SheetHeader className="border-b border-[var(--line)] pr-14">
            <div className="flex items-center justify-between gap-3">
              <div>
                <SheetTitle>Beef Dashboard Assistant</SheetTitle>
                <SheetDescription>
                  Explanations grounded in this dashboard and its USDA sources.
                </SheetDescription>
              </div>
              {connected ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetChat}
                  disabled={isBusy}
                  title="Start a new chat"
                >
                  <Plus className="size-4" aria-hidden="true" />
                  New Chat
                </Button>
              ) : null}
            </div>
          </SheetHeader>

          {!connected ? (
            <div className="assistant-connect">
              <div className="assistant-connect-icon">
                <KeyRound className="size-5" aria-hidden="true" />
              </div>
              <div>
                <h3 className="font-medium">Connect your model provider</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Your key stays in this browser tab and is sent only to the
                  assistant API over HTTPS. Questions and dashboard context are
                  sent to your selected provider.
                </p>
              </div>
              <div className="space-y-2">
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
              <div className="space-y-2">
                <Label htmlFor="assistant-api-key">API key</Label>
                <Input
                  id="assistant-api-key"
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={ASSISTANT_MODELS[provider].keyPlaceholder}
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void validateConnection();
                  }}
                />
              </div>
              {connectionError ? (
                <p role="alert" className="text-sm text-[var(--negative)]">
                  {connectionError}
                </p>
              ) : null}
              <Button
                onClick={() => void validateConnection()}
                disabled={!apiKey.trim() || isValidating}
              >
                {isValidating ? 'Checking connection…' : 'Connect'}
              </Button>
            </div>
          ) : (
            <>
              <div className="assistant-messages" aria-live="polite">
                {chat.messages.length === 0 ? (
                  <div className="assistant-welcome">
                    <Bot className="size-5" aria-hidden="true" />
                    <p>
                      Ask why a result is high or low, compare years, define a
                      number, find a chart, or review a scenario change.
                    </p>
                  </div>
                ) : null}
                {chat.messages.map((message) => (
                  <AssistantMessageView
                    key={message.id}
                    message={message}
                    onNavigate={(target) => {
                      setDrawerOpen(false);
                      window.setTimeout(() => onNavigate(target), 220);
                    }}
                    onRequestApply={requestApply}
                  />
                ))}
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
                {actionError ? (
                  <p role="alert" className="assistant-error">
                    {actionError}
                  </p>
                ) : null}
              </div>
              <form className="assistant-composer" onSubmit={submit}>
                <Textarea
                  aria-label="Ask the dashboard assistant"
                  placeholder="Ask about this scenario or a dashboard metric…"
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
                  rows={3}
                />
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-muted-foreground">
                    {ASSISTANT_MODELS[provider].label} · session only
                  </span>
                  {isBusy ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void stop()}
                    >
                      <Square
                        className="size-3.5 fill-current"
                        aria-hidden="true"
                      />
                      Stop
                    </Button>
                  ) : (
                    <Button type="submit" disabled={!input.trim()}>
                      <Send className="size-4" aria-hidden="true" />
                      Send
                    </Button>
                  )}
                </div>
              </form>
            </>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={pendingApply !== null}
        onOpenChange={(open) => !open && setPendingApply(null)}
      >
        <AlertDialogContent className="max-w-lg sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Apply these changes and run?</AlertDialogTitle>
            <AlertDialogDescription>
              The assistant has not changed the dashboard. Confirm the reviewed
              diff below to update the current inputs and start a simulation.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="max-h-64 overflow-auto rounded-lg border border-[var(--line)]">
            {pendingApply?.diff.map((item) => (
              <div key={item.path} className="assistant-diff-row">
                <span>{item.path}</span>
                <span className="tabular-nums text-muted-foreground">
                  {String(item.before)} → {String(item.after)}
                </span>
              </div>
            ))}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmApply}>
              Apply &amp; Run
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function AssistantMessageView({
  message,
  onNavigate,
  onRequestApply,
}: {
  message: UIMessage;
  onNavigate: (target: UiLocation) => void;
  onRequestApply: (
    base: 'draft' | 'displayed',
    changes: ScenarioChange[],
  ) => void;
}) {
  const text = messageText(message);
  const { markdown, ids } = resolveSourceTokens(text);
  const outputs = message.parts
    .map(toolOutput)
    .filter((value) => value !== undefined);
  const actions = outputs.flatMap(collectActions);
  const applyActions = outputs.flatMap((value) => {
    const found: Array<{
      base: 'draft' | 'displayed';
      changes: ScenarioChange[];
    }> = [];
    const visit = (item: unknown) => {
      if (Array.isArray(item)) return item.forEach(visit);
      if (item === null || typeof item !== 'object') return;
      const record = item as Record<string, unknown>;
      if (
        record.type === 'apply_scenario' &&
        (record.base === 'draft' || record.base === 'displayed') &&
        Array.isArray(record.changes)
      ) {
        found.push({
          base: record.base,
          changes: record.changes as ScenarioChange[],
        });
      }
      Object.values(record).forEach(visit);
    };
    visit(value);
    return found;
  });

  return (
    <article className="assistant-message" data-role={message.role}>
      <div className="assistant-message-label">
        {message.role === 'user' ? 'You' : 'Assistant'}
      </div>
      {markdown ? (
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
      ) : message.role === 'assistant' ? (
        <p className="assistant-status">Checking dashboard data…</p>
      ) : null}
      {actions.length || applyActions.length ? (
        <div className="assistant-actions">
          {actions.map((action, index) => (
            <Button
              key={`${action.target.elementId}-${index}`}
              variant="outline"
              size="sm"
              onClick={() => onNavigate(action.target)}
            >
              <Navigation className="size-3.5" aria-hidden="true" />
              {action.label}
            </Button>
          ))}
          {applyActions.map((action, index) => (
            <Button
              key={`apply-${index}`}
              variant="outline"
              size="sm"
              onClick={() => onRequestApply(action.base, action.changes)}
            >
              Review and Apply &amp; Run
            </Button>
          ))}
        </div>
      ) : null}
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
