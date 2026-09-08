'use client';

import { BarChart3, Database } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { SimulatorControls } from '@/components/simulator/controls';
import { ResultsDashboard } from '@/components/simulator/results';
import { DATA_VINTAGE } from '@/lib/model/defaults';
import { useSimulation } from '@/lib/model/use-simulation';

export default function Home() {
  const simulation = useSimulation();
  return <main className="min-h-screen bg-background text-foreground">
    <header className="border-b border-[var(--line)] bg-white/80 backdrop-blur-xl"><div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-2xl bg-[var(--navy)] text-white shadow-sm"><BarChart3 className="h-5 w-5" aria-hidden="true" /></div><div><h1 className="font-heading text-lg font-bold tracking-[-0.025em] text-[var(--navy)]">Beef Chain Simulator</h1><p className="text-sm text-muted-foreground">U.S. supply chain economics</p></div></div><Badge variant="outline" className="hidden gap-2 border-[var(--line)] bg-white px-3 py-1.5 text-muted-foreground sm:flex"><Database className="h-3.5 w-3.5" aria-hidden="true" />{DATA_VINTAGE}</Badge></div></header>
    <div className="mx-auto grid max-w-[1600px] gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[360px_minmax(0,1fr)] lg:px-8">
      <SimulatorControls scenario={simulation.scenario} setScenario={simulation.setScenario} progress={simulation.progress} isRunning={simulation.isRunning} error={simulation.error} notice={simulation.notice} runScenario={simulation.runScenario} saveBaseline={simulation.saveBaseline} restoreDefaults={simulation.restoreDefaults} />
      <ResultsDashboard result={simulation.result} baseline={simulation.baseline} trials={simulation.scenario.trials} />
    </div>
  </main>;
}
