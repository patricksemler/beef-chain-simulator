import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import type { ProviderOptions } from '@ai-sdk/provider-utils';
import type { LanguageModel } from 'ai';
import { ASSISTANT_MODELS } from './models';
import type { AssistantProvider } from './types';

export function createAssistantModel(
  provider: AssistantProvider,
  apiKey: string,
  model: string,
): LanguageModel {
  if (ASSISTANT_MODELS[provider].model !== model) {
    throw new Error('Unsupported provider/model combination.');
  }
  if (provider === 'openai') {
    return createOpenAI({ apiKey }).responses(model);
  }
  if (provider === 'google') {
    return createGoogleGenerativeAI({ apiKey })(model);
  }
  return createAnthropic({ apiKey })(model);
}

/**
 * Everything the answer needs is already in the prompt, so reasoning budgets
 * stay small to keep replies quick.
 */
export function providerOptions(
  provider: AssistantProvider,
): ProviderOptions | undefined {
  if (provider === 'openai') {
    return { openai: { store: false, reasoningEffort: 'low' } };
  }
  if (provider === 'google') {
    return { google: { thinkingConfig: { thinkingBudget: 512 } } };
  }
  return undefined;
}
