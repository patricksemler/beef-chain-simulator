'use client';

import { lazy, Suspense, useCallback, useState } from 'react';
import { Home, LineChart } from 'lucide-react';
import { ResultsDashboard } from '@/components/simulator/results';
import { ScenarioPanel } from '@/components/simulator/scenario-panel';
import { hasStaleDisplayedResult } from '@/lib/assistant/context';
import type {
  DashboardSnapshot,
  ResultsPage,
  ScenarioSection,
} from '@/lib/assistant/types';
import { useSimulation } from '@/lib/model/use-simulation';

const AssistantWidget = lazy(() =>
  import('@/components/assistant/assistant-widget').then((module) => ({
    default: module.AssistantWidget,
  })),
);

export default function SimulatorPage() {
  const simulation = useSimulation();
  const [activeResultsPage, setActiveResultsPage] =
    useState<ResultsPage>('profit');
  const [openScenarioSections, setOpenScenarioSections] = useState<
    ScenarioSection[]
  >(['prices']);

  const getSnapshot = useCallback(
    (): DashboardSnapshot => ({
      id: crypto.randomUUID(),
      capturedAt: new Date().toISOString(),
      draftScenario: structuredClone(simulation.scenario),
      displayedResult: simulation.result
        ? structuredClone(simulation.result)
        : null,
      isStale: hasStaleDisplayedResult(simulation.scenario, simulation.result),
      isRunning: simulation.isRunning,
      activeResultsPage,
      openScenarioSections,
    }),
    [
      activeResultsPage,
      openScenarioSections,
      simulation.isRunning,
      simulation.result,
      simulation.scenario,
    ],
  );

  return (
    <>
      <a href="#results" className="skip-link">
        Skip to results
      </a>
      <header className="app-header">
        <div className="app-header-inner">
          <h1 className="app-title">
            Beef Chain Simulator
            <span className="app-subtitle">
              U.S. supply chain planning model
            </span>
          </h1>
          {/* Plain anchors: the static export has no working client router. */}
          <nav className="simulator-nav" aria-label="Site">
            <a href="/">
              <Home size={15} aria-hidden="true" />
              <span className="sr-only min-[640px]:not-sr-only">Home</span>
            </a>
            <a href="/trends">
              <LineChart size={15} aria-hidden="true" />
              <span className="sr-only min-[640px]:not-sr-only">
                Market trends
              </span>
            </a>
          </nav>
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
          openSections={openScenarioSections}
          onOpenSectionsChange={setOpenScenarioSections}
        />
        <div id="results" className="min-w-0">
          <ResultsDashboard
            result={simulation.result}
            activePage={activeResultsPage}
            onActivePageChange={setActiveResultsPage}
          />
        </div>
      </main>

      <Suspense fallback={null}>
        <AssistantWidget
          getSnapshot={getSnapshot}
          referenceYear={
            simulation.result?.scenario.referenceYear ??
            simulation.scenario.referenceYear
          }
        />
      </Suspense>
    </>
  );
}
