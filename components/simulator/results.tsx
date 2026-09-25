'use client';
import { Flow } from '@/components/simulator/results/flow';
import { Headline } from '@/components/simulator/results/headline';
import { ProfitDrivers } from '@/components/simulator/results/profit-drivers';
import { Sectors } from '@/components/simulator/results/sectors';
import { StageDetails } from '@/components/simulator/results/stage-details';
import { Skeleton } from '@/components/ui/skeleton';
import type { SimulationSummary } from '@/lib/model/types';
import type { ResultsPage } from '@/lib/assistant/types';

export const RESULT_PAGES = [
  { id: 'profit', label: 'Profit' },
  { id: 'flow', label: 'Cattle flow' },
  { id: 'details', label: 'Stage details' },
] as const;

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
          {RESULT_PAGES.map((page) => (
            <button
              key={page.id}
              type="button"
              className="results-tab"
              data-active={activePage === page.id}
              aria-pressed={activePage === page.id}
              onClick={() => onActivePageChange(page.id)}
            >
              {page.label}
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
