import { z } from 'zod';
import { ASSISTANT_MODELS } from './models';

export const providerSchema = z.enum(['openai', 'google', 'anthropic']);

export const dashboardSnapshotSchema = z
  .object({
    id: z.string().min(1).max(100),
    capturedAt: z.iso.datetime(),
    draftScenario: z.record(z.string(), z.unknown()),
    displayedResult: z.record(z.string(), z.unknown()).nullable(),
    isStale: z.boolean(),
    isRunning: z.boolean(),
    activeResultsPage: z.enum(['profit', 'flow', 'details']),
    openScenarioSections: z.array(
      z.enum(['prices', 'biology', 'yield', 'risk', 'run', 'sources']),
    ),
  })
  .strict();

function requireAllowedModel(
  value: { provider: z.infer<typeof providerSchema>; model: string },
  context: z.RefinementCtx,
) {
  if (ASSISTANT_MODELS[value.provider].model !== value.model) {
    context.addIssue({
      code: 'custom',
      path: ['model'],
      message: 'Unsupported provider/model combination.',
    });
  }
}

export const assistantRequestSchema = z
  .object({
    provider: providerSchema,
    model: z.string().min(1).max(100),
    messages: z.array(z.record(z.string(), z.unknown())).min(1).max(30),
    snapshot: dashboardSnapshotSchema,
    summary: z.string().max(8_000).nullable(),
  })
  .strict()
  .superRefine(requireAllowedModel);

export const validateRequestSchema = z
  .object({
    provider: providerSchema,
    model: z.string().min(1).max(100),
  })
  .strict()
  .superRefine(requireAllowedModel);

export const compactRequestSchema = z
  .object({
    provider: providerSchema,
    model: z.string().min(1).max(100),
    messages: z.array(z.record(z.string(), z.unknown())).min(1).max(40),
    previousSummary: z.string().max(8_000).nullable(),
  })
  .strict()
  .superRefine(requireAllowedModel);
