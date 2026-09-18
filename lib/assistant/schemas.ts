import { z } from 'zod';
import { ASSISTANT_MODELS } from './models';

export const providerSchema = z.enum(['openai', 'google', 'anthropic']);

export const scenarioChangeSchema = z
  .object({
    path: z.string().min(1).max(100),
    value: z.union([
      z.number(),
      z.string().max(100),
      z.array(z.number()).max(12),
    ]),
  })
  .strict();

export const dashboardSnapshotSectionSchema = z.enum([
  'status',
  'inputs',
  'headline',
  'phases',
  'flow',
  'details',
  'monthly',
  'sensitivity',
]);

export const dashboardSnapshotSchema = z
  .object({
    id: z.string().min(1).max(100),
    capturedAt: z.iso.datetime(),
    draftScenario: z.record(z.string(), z.unknown()),
    displayedResult: z.record(z.string(), z.unknown()).nullable(),
    isStale: z.boolean(),
    isRunning: z.boolean(),
    activeResultsPage: z.enum(['profit', 'sectors', 'flow', 'details']),
    openScenarioSections: z.array(
      z.enum(['prices', 'biology', 'yield', 'risk', 'run', 'sources']),
    ),
  })
  .strict();

export const assistantRequestSchema = z
  .object({
    provider: providerSchema,
    model: z.string().min(1).max(100),
    messages: z.array(z.record(z.string(), z.unknown())).max(30),
    snapshot: dashboardSnapshotSchema,
    summary: z
      .object({
        text: z.string().max(8_000),
        referencedMetricIds: z.array(z.string().max(100)).max(100),
        snapshotStatus: z.string().max(1_000),
        pendingActions: z.array(z.string().max(500)).max(20),
      })
      .strict()
      .nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    if (ASSISTANT_MODELS[value.provider].model !== value.model) {
      context.addIssue({
        code: 'custom',
        path: ['model'],
        message: 'Unsupported provider/model combination.',
      });
    }
  });

export const validateRequestSchema = z
  .object({
    provider: providerSchema,
    model: z.string().min(1).max(100),
  })
  .strict()
  .superRefine((value, context) => {
    if (ASSISTANT_MODELS[value.provider].model !== value.model) {
      context.addIssue({
        code: 'custom',
        path: ['model'],
        message: 'Unsupported provider/model combination.',
      });
    }
  });

export const compactRequestSchema = z
  .object({
    provider: providerSchema,
    model: z.string().min(1).max(100),
    messages: z.array(z.record(z.string(), z.unknown())).min(1).max(40),
    previousSummary: z.string().max(8_000).nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    if (ASSISTANT_MODELS[value.provider].model !== value.model) {
      context.addIssue({
        code: 'custom',
        path: ['model'],
        message: 'Unsupported provider/model combination.',
      });
    }
  });

export const turnCancelSchema = z.object({ turnId: z.uuid() }).strict();
