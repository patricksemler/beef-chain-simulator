'use client';

import { Analysis } from '@/components/simulator/results/analysis';
import { Flow } from '@/components/simulator/results/flow';
import { Headline } from '@/components/simulator/results/headline';
import { Sectors } from '@/components/simulator/results/sectors';
import { Skeleton } from '@/components/ui/skeleton';
import type { SimulationSummary } from '@/lib/model/types';

export function ResultsDashboard({ result }: { result: SimulationSummary | null }) {
  if (result === null) return <ResultsSkeleton />;

  return (
    <div className="results">
      <Headline result={result} />
      <Sectors result={result} />
      <Flow result={result} />
      <Analysis result={result} />
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
