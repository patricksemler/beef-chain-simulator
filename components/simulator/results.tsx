'use client';

/**
 * # Results
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
 * - `ResultsDashboard`: the main thing this file provides to the app.
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
import { Flow } from '@/components/simulator/results/flow';
import { Headline } from '@/components/simulator/results/headline';
import { ProfitDrivers } from '@/components/simulator/results/profit-drivers';
import { Sectors } from '@/components/simulator/results/sectors';
import { StageDetails } from '@/components/simulator/results/stage-details';
import { Skeleton } from '@/components/ui/skeleton';
import type { SimulationSummary } from '@/lib/model/types';
import {
  RESULT_PAGE_LABELS,
  RESULTS_PAGES,
  type ResultsPage,
} from '@/lib/dashboard';


export function ResultsDashboard({
  result,
  activePage,
  onActivePageChange,
}: {
  result: SimulationSummary | null;
  activePage: ResultsPage;
  onActivePageChange: (page: ResultsPage) => void;
}) {
  if (result === null) return <ResultsSkeleton />;

  return (
    <ResultsPages
      result={result}
      activePage={activePage}
      onActivePageChange={onActivePageChange}
    />
  );
}

function ResultsPages({
  result,
  activePage,
  onActivePageChange,
}: {
  result: SimulationSummary;
  activePage: ResultsPage;
  onActivePageChange: (page: ResultsPage) => void;
}) {
  const currentView = {
    profit: (
      <>
        <Headline result={result} />
        <div className="results-pair">
          <Sectors result={result} />
          <ProfitDrivers result={result} />
        </div>
      </>
    ),
    flow: <Flow result={result} />,
    details: <StageDetails result={result} />,
  }[activePage];

  return (
    <div className="results">
      <div className="results-bar">
        <div className="results-header" aria-label="Results sections">
          {RESULTS_PAGES.map((page) => (
            <button
              key={page}
              type="button"
              className="results-tab"
              data-active={activePage === page}
              aria-pressed={activePage === page}
              onClick={() => onActivePageChange(page)}
            >
              {RESULT_PAGE_LABELS[page]}
            </button>
          ))}
          <span className="results-year">
            {result.scenario.referenceYear} USDA profile
          </span>
        </div>
      </div>
      {currentView}
    </div>
  );
}

function ResultsSkeleton() {
  return (
    <div className="results" aria-busy="true" aria-label="Loading results">
      <div className="panel p-5">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="mt-4 h-12 w-64" />
        <Skeleton className="mt-4 h-2 w-full" />
      </div>
      <div className="panel p-5">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="mt-4 h-40 w-full" />
      </div>
      <div className="panel p-5">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="mt-4 h-28 w-full" />
      </div>
    </div>
  );
}
