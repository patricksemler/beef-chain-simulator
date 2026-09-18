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
