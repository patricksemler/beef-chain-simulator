'use client';

import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ResultsDashboard } from '@/components/simulator/results';
import { ScenarioPanel } from '@/components/simulator/scenario-panel';
import type {
  DashboardSnapshot,
  ResultsPage,
  ScenarioSection,
  UiLocation,
} from '@/lib/assistant/types';
import { hasStaleDisplayedResult } from '@/lib/assistant/tools';
import { useSimulation } from '@/lib/model/use-simulation';

const AssistantDrawer = lazy(() =>
  import('@/components/assistant/assistant-drawer').then((module) => ({
    default: module.AssistantDrawer,
  })),
);

export default function Home() {
  const simulation = useSimulation();
  const [activeResultsPage, setActiveResultsPage] =
    useState<ResultsPage>('profit');
  const [openScenarioSections, setOpenScenarioSections] = useState<
    ScenarioSection[]
  >(['prices']);
  const pendingNavigation = useRef<UiLocation | null>(null);

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

  const navigate = useCallback((target: UiLocation) => {
    pendingNavigation.current = target;
    if (target.resultPage) setActiveResultsPage(target.resultPage);
    if (target.scenarioSection) {
      setOpenScenarioSections((current) =>
        current.includes(target.scenarioSection!)
          ? current
          : [...current, target.scenarioSection!],
      );
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const pending = pendingNavigation.current;
        if (!pending) return;
        const element = document.getElementById(pending.elementId);
        if (!element) return;
        if (!element.hasAttribute('tabindex')) element.tabIndex = -1;
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.focus({ preventScroll: true });
        pendingNavigation.current = null;
      });
    });
  }, []);

  useEffect(() => {
    if (!pendingNavigation.current) return;
    const target = pendingNavigation.current;
    const element = document.getElementById(target.elementId);
    if (!element) return;
    if (!element.hasAttribute('tabindex')) element.tabIndex = -1;
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    element.focus({ preventScroll: true });
    pendingNavigation.current = null;
  }, [activeResultsPage, openScenarioSections]);

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
          <Suspense
            fallback={
              <Button
                variant="outline"
                className="assistant-header-button"
                disabled
              >
                <Bot className="size-4" aria-hidden="true" />
                Assistant
              </Button>
            }
          >
            <AssistantDrawer
              getSnapshot={getSnapshot}
              onNavigate={navigate}
              onApplyAndRun={(scenario) =>
                void simulation.runScenario(scenario)
              }
            />
          </Suspense>
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
    </>
  );
}
