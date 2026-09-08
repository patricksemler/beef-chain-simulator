import { runSimulation } from '@/lib/model/simulate';
import type { ScenarioInput } from '@/lib/model/types';

self.onmessage = (event: MessageEvent<{ requestId: number; scenario: ScenarioInput }>) => {
  const { requestId, scenario } = event.data;
  try {
    const result = runSimulation(scenario, (progress) => {
      self.postMessage({ requestId, type: 'progress', progress });
    });
    self.postMessage({ requestId, type: 'result', result });
  } catch (error) {
    self.postMessage({
      requestId,
      type: 'error',
      error: error instanceof Error ? error.message : 'Simulation failed.',
    });
  }
};
