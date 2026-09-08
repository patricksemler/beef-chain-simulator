'use client';

import { Activity, Database } from 'lucide-react';
import { SimulatorControls } from '@/components/simulator/controls';
import { ResultsDashboard } from '@/components/simulator/results';
import { DATA_VINTAGE } from '@/lib/model/defaults';
import { useSimulation } from '@/lib/model/use-simulation';

export default function Home() {
  const simulation = useSimulation();

  return (
    <main className="min-h-screen bg-background text-foreground">
      <a href="#workspace" className="skip-link">
        Skip to simulation workspace
      </a>
      <header className="border-b border-[var(--line)] bg-white">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--accent-strong)] text-white">
              <Activity className="h-4 w-4" aria-hidden="true" />
            </div>
            <div>
              <h1 className="font-heading text-base font-semibold tracking-[-0.02em] text-[var(--ink)]">
                Beef Chain Simulator
              </h1>
              <p className="text-xs text-muted-foreground">
                U.S. supply chain planning model
              </p>
            </div>
          </div>
          <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
            <Database className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{DATA_VINTAGE}</span>
            <span aria-hidden="true">·</span>
            <span>250 trials</span>
          </div>
        </div>
      </header>
      <div
        id="workspace"
        className="mx-auto grid max-w-[1440px] gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[320px_minmax(0,1fr)] lg:px-8"
      >
        <SimulatorControls
          scenario={simulation.scenario}
          setScenario={simulation.setScenario}
          progress={simulation.progress}
          isRunning={simulation.isRunning}
          error={simulation.error}
          notice={simulation.notice}
          runScenario={simulation.runScenario}
          saveBaseline={simulation.saveBaseline}
          restoreDefaults={simulation.restoreDefaults}
        />
        <ResultsDashboard
          result={simulation.result}
          baseline={simulation.baseline}
          trials={simulation.scenario.trials}
        />
      </div>
    </main>
  );
}
