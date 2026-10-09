/**
 * # Assistant Simulation.Worker
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
 * - `main logic`: the main thing this file provides to the app.
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
/// <reference lib="webworker" />

import { compareScenarioVariants } from '@/lib/assistant/scenarios';
import type {
  DashboardSnapshot,
  ScenarioVariantRequest,
} from '@/lib/assistant/types';

interface CompareRequest {
  requestId: string;
  snapshot: DashboardSnapshot;
  base: 'draft' | 'displayed';
  variants: ScenarioVariantRequest[];
  outputMetricIds: string[];
}

self.onmessage = (event: MessageEvent<CompareRequest>) => {
  const { requestId, snapshot, base, variants, outputMetricIds } = event.data;
  try {
    const result = compareScenarioVariants(
      snapshot,
      base,
      variants,
      outputMetricIds,
    );
    self.postMessage({ type: 'result', requestId, result });
  } catch (error) {
    self.postMessage({
      type: 'error',
      requestId,
      error: error instanceof Error ? error.message : 'Comparison failed.',
    });
  }
};

export {};
