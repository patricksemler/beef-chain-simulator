'use client';


/**
 * # Simulator Page
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
 * - `SimulatorPage`: the main thing this file provides to the app.
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
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Bot, Home, LineChart } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ResultsDashboard } from '@/components/simulator/results';
import { ScenarioPanel } from '@/components/simulator/scenario-panel';
import type { DashboardSnapshot, ResultsPage, ScenarioSection, UiLocation } from '@/lib/assistant/types';
import { hasStaleDisplayedResult } from '@/lib/assistant/tools';
import { useSimulation } from '@/lib/model/use-simulation';

const AssistantDrawer = lazy(() =>
  import('@/components/assistant/assistant-drawer').then((module) => ({
    default: module.AssistantDrawer,
  })),
);

export default function SimulatorPage() {
  const simulation = useSimulation();
  const [activeResultsPage, setActiveResultsPage] = useState<ResultsPage>('profit');
  const [openScenarioSections, setOpenScenarioSections] = useState<ScenarioSection[]>(['prices']);
  const pendingNavigation = useRef<UiLocation | null>(null);

  const getSnapshot = useCallback(
    (): DashboardSnapshot => ({
      id: crypto.randomUUID(),
      capturedAt: new Date().toISOString(),
      draftScenario: structuredClone(simulation.scenario),
      displayedResult: simulation.result ? structuredClone(simulation.result) : null,
      isStale: hasStaleDisplayedResult(simulation.scenario, simulation.result),
      isRunning: simulation.isRunning,
      activeResultsPage,
      openScenarioSections,
    }),
    [activeResultsPage, openScenarioSections, simulation.isRunning, simulation.result, simulation.scenario],
  );

  const navigate = useCallback((target: UiLocation) => {
    pendingNavigation.current = target;
    if (target.resultPage) setActiveResultsPage(target.resultPage);
    if (target.scenarioSection) {
      setOpenScenarioSections((current) => current.includes(target.scenarioSection!) ? current : [...current, target.scenarioSection!]);
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
      <a href="#results" className="skip-link">Skip to results</a>
      <header className="app-header">
        <div className="app-header-inner">
          <h1 className="app-title">Beef Chain Simulator<span className="app-subtitle">U.S. supply chain planning model</span></h1>
          <div className="simulator-nav" aria-label="Main navigation">
            <Link href="/"><Home size={15} aria-hidden="true" /> Home</Link>
            <Link href="/trends"><LineChart size={15} aria-hidden="true" /> Market trends</Link>
            <Suspense fallback={<Button variant="outline" className="assistant-header-button" disabled><Bot className="size-4" aria-hidden="true" /> Assistant</Button>}>
              <AssistantDrawer getSnapshot={getSnapshot} onNavigate={navigate} onApplyAndRun={(scenario) => void simulation.runScenario(scenario)} />
            </Suspense>
          </div>
        </div>
      </header>
      <main className="app-body">
        <ScenarioPanel scenario={simulation.scenario} setScenario={simulation.setScenario} isRunning={simulation.isRunning} isStale={simulation.isStale} error={simulation.error} runScenario={simulation.runScenario} restoreDefaults={simulation.restoreDefaults} openSections={openScenarioSections} onOpenSectionsChange={setOpenScenarioSections} />
        <div id="results" className="min-w-0"><ResultsDashboard result={simulation.result} activePage={activeResultsPage} onActivePageChange={setActiveResultsPage} /></div>
      </main>
    </>
  );
}