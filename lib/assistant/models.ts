import type { AssistantProvider } from './types';

export const ASSISTANT_MODELS = {
  openai: {
    label: 'OpenAI',
    model: 'gpt-5-mini',
    keyPlaceholder: 'sk-…',
  },
  google: {
    label: 'Google Gemini',
    model: 'gemini-2.5-flash',
    keyPlaceholder: 'AIza…',
  },
  anthropic: {
    label: 'Anthropic Claude',
    model: 'claude-sonnet-5',
    keyPlaceholder: 'sk-ant-…',
  },
} as const satisfies Record<
  AssistantProvider,
  { label: string; model: string; keyPlaceholder: string }
>;

export const ASSISTANT_PROVIDERS = Object.keys(
  ASSISTANT_MODELS,
) as AssistantProvider[];

export function isAssistantProvider(
  value: unknown,
): value is AssistantProvider {
  return (
    typeof value === 'string' &&
    ASSISTANT_PROVIDERS.includes(value as AssistantProvider)
  );
}

export function isAllowedModel(
  provider: AssistantProvider,
  model: unknown,
): model is string {
  return model === ASSISTANT_MODELS[provider].model;
}
