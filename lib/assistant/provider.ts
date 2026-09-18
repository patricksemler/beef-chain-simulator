import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
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

export function providerOptions(provider: AssistantProvider) {
  return provider === 'openai' ? { openai: { store: false } } : undefined;
}
