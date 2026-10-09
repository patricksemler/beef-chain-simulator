/**
 * # Schemas
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
 * - `providerSchema`: the main thing this file provides to the app.
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
