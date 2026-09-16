'use client';

import { Database } from 'lucide-react';
import { ResultsDashboard } from '@/components/simulator/results';
import { ScenarioPanel } from '@/components/simulator/scenario-panel';
import { historicalDataVintage } from '@/lib/model/historical';
import { useSimulation } from '@/lib/model/use-simulation';

export default function Home() {
  const simulation = useSimulation();

  return (
    <>
      <a href="#results" className="skip-link">
        Skip to results
      </a>
      <header className="app-header">
        <div className="app-header-inner">
          <h1 className="app-title">
            Beef Chain Simulator
            <span className="app-subtitle">U.S. supply chain planning model</span>
          </h1>
          <p className="app-meta">
            <Database className="size-3.5" aria-hidden="true" />
            {historicalDataVintage(simulation.scenario.referenceYear)}
          </p>
        </div>
      </header>

      <main className="app-body">
        <ScenarioPanel
          scenario={simulation.scenario}
          setScenario={simulation.setScenario}
          isRunning={simulation.isRunning}
          isStale={simulation.isStale}
          error={simulation.error}
          runScenario={simulation.runScenario}
          restoreDefaults={simulation.restoreDefaults}
        />
        <div id="results" className="min-w-0">
          <ResultsDashboard result={simulation.result} />
        </div>
      </main>
    </>
  );
}
