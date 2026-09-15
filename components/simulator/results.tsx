'use client';

import { useState } from 'react';
import { Analysis } from '@/components/simulator/results/analysis';
import { Flow } from '@/components/simulator/results/flow';
import { Headline } from '@/components/simulator/results/headline';
import { Sectors } from '@/components/simulator/results/sectors';
import { Skeleton } from '@/components/ui/skeleton';
import type { SimulationSummary } from '@/lib/model/types';

const RESULT_PAGES = [
  { id: 'profit', label: 'Total profit' },
  { id: 'sectors', label: 'Profit by sector' },
  { id: 'flow', label: 'Cattle flow' },
  { id: 'details', label: 'Details' },
] as const;

export function ResultsDashboard({ result }: { result: SimulationSummary | null }) {
  if (result === null) return <ResultsSkeleton />;

  return <ResultsPages result={result} />;
}

function ResultsPages({ result }: { result: SimulationSummary }) {
  const [activePage, setActivePage] = useState<(typeof RESULT_PAGES)[number]['id']>('profit');

  const currentView = {
    profit: <Headline result={result} />,
    sectors: <Sectors result={result} />,
    flow: <Flow result={result} />,
    details: <Analysis result={result} />,
  }[activePage];

  return (
    <div className="results">
      <div className="results-header" aria-label="Results sections">
        {RESULT_PAGES.map((page) => (
          <button
            key={page.id}
            type="button"
            className="results-tab"
            data-active={activePage === page.id}
            aria-pressed={activePage === page.id}
            onClick={() => setActivePage(page.id)}
          >
            {page.label}
          </button>
        ))}
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
