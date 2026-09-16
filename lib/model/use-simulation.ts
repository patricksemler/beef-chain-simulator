'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
// oxlint-disable-next-line import/default -- Vite's ?worker loader provides the constructor.
import SimulationWorker from '../../workers/simulation.worker.ts?worker';
import { cloneDefaultScenario } from './defaults';
import {
  applyHistoricalYear,
  AVAILABLE_HISTORICAL_YEARS,
  isHistoricalYear,
} from './historical';
import type { EntryCadence, ScenarioInput, SimulationSummary } from './types';

interface PendingRun {
  resolve: (result: SimulationSummary) => void;
  reject: (error: Error) => void;
}

export function useSimulation() {
  const [scenario, setScenario] = useState<ScenarioInput>(() => cloneDefaultScenario());
  const [result, setResult] = useState<SimulationSummary | null>(null);
  const [isRunning, setIsRunning] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const requestRef = useRef(0);
  const pendingRef = useRef(new Map<number, PendingRun>());
  const scenarioRef = useRef(scenario);

  // Keeps the latest scenario reachable from the agent tool without making it
  // a dependency of the registration effect.
  useEffect(() => {
    scenarioRef.current = scenario;
  }, [scenario]);

  const runScenario = useCallback((nextScenario: ScenarioInput) => {
    const worker = workerRef.current;
    if (!worker) return Promise.reject(new Error('Simulation engine is still starting.'));
    const requestId = ++requestRef.current;
    setScenario(nextScenario);
    setIsRunning(true);
    setError(null);
    return new Promise<SimulationSummary>((resolve, reject) => {
      pendingRef.current.set(requestId, { resolve, reject });
      worker.postMessage({ requestId, scenario: nextScenario });
    });
  }, []);

  useEffect(() => {
    const worker = new SimulationWorker();
    const pendingRuns = pendingRef.current;
    workerRef.current = worker;
    worker.onmessage = (event) => {
      const pending = pendingRef.current.get(event.data.requestId);
      const isLatest = event.data.requestId === requestRef.current;
      if (event.data.type === 'result') {
        pending?.resolve(event.data.result);
        pendingRef.current.delete(event.data.requestId);
        if (isLatest) {
          setResult(event.data.result);
          setIsRunning(false);
        }
      }
      if (event.data.type === 'error') {
        const runError = new Error(event.data.error);
        pending?.reject(runError);
        pendingRef.current.delete(event.data.requestId);
        if (isLatest) {
          setError(runError.message);
          setIsRunning(false);
        }
      }
    };
    void runScenario(cloneDefaultScenario());
    return () => {
      worker.terminate();
      for (const pending of pendingRuns.values()) pending.reject(new Error('Simulation cancelled.'));
      pendingRuns.clear();
    };
  }, [runScenario]);


  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const registration = context.registerTool({
      name: 'run_beef_supply_chain_scenario',
      title: 'Run beef supply chain scenario',
      description: 'Run a U.S. beef supply chain economics scenario and update the visible dashboard.',
      inputSchema: {
        type: 'object',
        properties: {
          totalHead: { type: 'integer', minimum: 1, maximum: 30000000 },
          horizonYears: { type: 'integer', minimum: 1, maximum: 10 },
          cadence: { type: 'string', enum: ['even', 'upfront', 'spring', 'fall'] },
          calfPricePerCwt: { type: 'number', minimum: 0 },
          feederPricePerCwt: { type: 'number', minimum: 0 },
          fedPricePerCwt: { type: 'number', minimum: 0 },
          retailPricePerLb: { type: 'number', minimum: 0 },
          feedCostPerTon: { type: 'number', minimum: 0 },
          referenceYear: { type: 'integer', enum: AVAILABLE_HISTORICAL_YEARS },
          seed: { type: 'integer' },
        },
        required: ['totalHead', 'horizonYears'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      async execute(rawInput: unknown) {
        const input = rawInput as Record<string, unknown>;
        let next = structuredClone(scenarioRef.current);
        if (!Number.isInteger(input.totalHead) || Number(input.totalHead) < 1 || Number(input.totalHead) > 30_000_000) throw new Error('totalHead must be an integer from 1 to 30,000,000.');
        if (!Number.isInteger(input.horizonYears) || Number(input.horizonYears) < 1 || Number(input.horizonYears) > 10) throw new Error('horizonYears must be an integer from 1 to 10.');
        next.totalHead = Number(input.totalHead);
        next.horizonMonths = Number(input.horizonYears) * 12;
        if (input.referenceYear !== undefined) {
          const year = Number(input.referenceYear);
          if (!isHistoricalYear(year)) {
            throw new Error(`referenceYear must be one of: ${AVAILABLE_HISTORICAL_YEARS.join(', ')}.`);
          }
          next = applyHistoricalYear(next, year);
        }
        if (input.cadence) next.cadence = input.cadence as EntryCadence;
        for (const key of ['calfPricePerCwt', 'feederPricePerCwt', 'fedPricePerCwt', 'retailPricePerLb', 'feedCostPerTon', 'seed'] as const) {
          if (input[key] !== undefined) (next[key] as number) = Number(input[key]);
        }
        const summary = await runScenario(next);
        return {
          chainEconomicProfit: summary.chainEconomicProfit,
          chainOperatingContribution: summary.chainOperatingContribution,
          completedHead: summary.completedHead,
          mortalityHead: summary.mortalityHead,
          endingInventoryHead: summary.endingInventoryHead,
          p10: summary.chainP10,
          p90: summary.chainP90,
        };
      },
    }, { signal: lifecycle.signal });
    void Promise.resolve(registration).catch(() => undefined);
    return () => lifecycle.abort();
  }, [runScenario]);

  /** True when the inputs have moved on from whatever produced `result`. */
  const isStale = useMemo(() => {
    if (result === null || isRunning) return false;
    return JSON.stringify(scenario) !== JSON.stringify(result.scenario);
  }, [scenario, result, isRunning]);



  const restoreDefaults = useCallback(() => {
    void runScenario(cloneDefaultScenario());
  }, [runScenario]);

  return {
    scenario,
    setScenario,
    result,
    error,
    isRunning,
    isStale,
    runScenario,
    restoreDefaults,
  };
}
