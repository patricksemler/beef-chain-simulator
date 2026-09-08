'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, BarChart3, Database, Play, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { cloneDefaultScenario, DATA_VINTAGE } from '@/lib/model/defaults';
import type { PhaseKey, ScenarioInput, SimulationSummary } from '@/lib/model/types';

const PHASE_ORDER: PhaseKey[] = ['cowCalf', 'stocker', 'feedlot', 'downstream'];
const PHASE_STYLES: Record<PhaseKey, { accent: string; surface: string; number: string }> = {
  cowCalf: { accent: '#82a4b5', surface: '#e6f0f4', number: '01' },
  stocker: { accent: '#8eaa91', surface: '#e7f0e6', number: '02' },
  feedlot: { accent: '#c59b85', surface: '#f5e9e2', number: '03' },
  downstream: { accent: '#c1a95c', surface: '#f7f0d8', number: '04' },
};

const compactCurrency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 });
const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const whole = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

function toSlider(head: number) {
  return (Math.log10(Math.max(1, head)) / Math.log10(30_000_000)) * 100;
}

function fromSlider(value: number) {
  return Math.max(1, Math.min(30_000_000, Math.round(10 ** ((value / 100) * Math.log10(30_000_000)))));
}

export default function Home() {
  const [scenario, setScenario] = useState<ScenarioInput>(() => cloneDefaultScenario());
  const [result, setResult] = useState<SimulationSummary | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const requestRef = useRef(0);

  const runScenario = useCallback((nextScenario: ScenarioInput) => {
    if (!workerRef.current) return;
    const requestId = ++requestRef.current;
    setProgress(2);
    setError(null);
    workerRef.current.postMessage({ requestId, scenario: nextScenario });
  }, []);

  useEffect(() => {
    const worker = new Worker(new URL('../workers/simulation.worker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;
    worker.onmessage = (event) => {
      if (event.data.requestId !== requestRef.current) return;
      if (event.data.type === 'progress') setProgress((event.data.progress.completed / event.data.progress.total) * 100);
      if (event.data.type === 'result') { setResult(event.data.result); setProgress(100); }
      if (event.data.type === 'error') { setError(event.data.error); setProgress(0); }
    };
    runScenario(scenario);
    return () => worker.terminate();
    // Initial scenario is intentionally run once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runScenario]);

  const isRunning = progress > 0 && progress < 100;
  const completedRate = result ? result.completedHead / result.totalStartedHead : 0;
  const totalCosts = useMemo(() => result ? PHASE_ORDER.reduce((sum, key) => sum + result.phases[key].directCosts + result.phases[key].economicCosts, 0) : 0, [result]);
  const updateNumber = (key: keyof ScenarioInput, value: number) => setScenario((current) => ({ ...current, [key]: value }));

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-[var(--line)] bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[var(--navy)] text-white shadow-sm"><BarChart3 className="h-5 w-5" aria-hidden="true" /></div>
            <div><h1 className="font-heading text-lg font-bold tracking-[-0.025em] text-[var(--navy)]">Beef Chain Simulator</h1><p className="text-sm text-muted-foreground">U.S. supply chain economics</p></div>
          </div>
          <Badge variant="outline" className="hidden gap-2 border-[var(--line)] bg-white px-3 py-1.5 text-muted-foreground sm:flex"><Database className="h-3.5 w-3.5" aria-hidden="true" />{DATA_VINTAGE}</Badge>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1600px] gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[340px_minmax(0,1fr)] lg:px-8">
        <aside className="lg:sticky lg:top-5 lg:self-start">
          <Card className="overflow-hidden border-[var(--line)] bg-white shadow-[0_12px_40px_rgba(38,52,69,0.07)]">
            <CardHeader className="border-b border-[var(--line)] pb-4">
              <div className="flex items-center justify-between gap-3"><div><p className="eyebrow">Scenario</p><CardTitle className="mt-1 font-heading text-xl text-[var(--navy)]">Core assumptions</CardTitle></div><SlidersHorizontal className="h-5 w-5 text-muted-foreground" aria-hidden="true" /></div>
            </CardHeader>
            <CardContent className="space-y-5 pt-5">
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-3"><Label htmlFor="head-count">Calves entering</Label><span className="text-xs text-muted-foreground">1–30 million</span></div>
                <Input id="head-count" type="number" min={1} max={30_000_000} step={1} value={scenario.totalHead} onChange={(event) => updateNumber('totalHead', Math.max(1, Math.min(30_000_000, Number(event.target.value))))} className="h-11 border-[var(--line)] bg-[var(--soft-bg)] text-base font-semibold tabular-nums" />
                <Slider aria-label="Calves entering, logarithmic scale" value={[toSlider(scenario.totalHead)]} onValueChange={([value]) => updateNumber('totalHead', fromSlider(value))} min={0} max={100} step={0.1} className="py-1" />
                <div className="flex justify-between text-[11px] text-muted-foreground" aria-hidden="true"><span>1</span><span>10K</span><span>1M</span><span>30M</span></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label htmlFor="horizon">Horizon</Label><Select value={String(scenario.horizonMonths)} onValueChange={(value) => updateNumber('horizonMonths', Number(value))}><SelectTrigger id="horizon" className="h-11 w-full border-[var(--line)] bg-[var(--soft-bg)]"><SelectValue /></SelectTrigger><SelectContent>{Array.from({ length: 10 }, (_, index) => index + 1).map((years) => <SelectItem key={years} value={String(years * 12)}>{years} {years === 1 ? 'year' : 'years'}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label htmlFor="cadence">Entry cadence</Label><Select value={scenario.cadence} onValueChange={(value) => setScenario((current) => ({ ...current, cadence: value as ScenarioInput['cadence'] }))}><SelectTrigger id="cadence" className="h-11 w-full border-[var(--line)] bg-[var(--soft-bg)]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="even">Even monthly</SelectItem><SelectItem value="upfront">All upfront</SelectItem><SelectItem value="spring">Spring weighted</SelectItem><SelectItem value="fall">Fall weighted</SelectItem><SelectItem value="custom">Custom</SelectItem></SelectContent></Select></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <MoneyInput label="Fed cattle" value={scenario.fedPricePerCwt} suffix="/cwt" onChange={(value) => updateNumber('fedPricePerCwt', value)} />
                <MoneyInput label="Retail beef" value={scenario.retailPricePerLb} suffix="/lb" step="0.01" onChange={(value) => updateNumber('retailPricePerLb', value)} />
                <MoneyInput label="Feeder cattle" value={scenario.feederPricePerCwt} suffix="/cwt" onChange={(value) => updateNumber('feederPricePerCwt', value)} />
                <MoneyInput label="Feed" value={scenario.feedCostPerTon} suffix="/ton" onChange={(value) => updateNumber('feedCostPerTon', value)} />
              </div>
              <Button className="h-12 w-full bg-[var(--navy)] text-base font-semibold text-white hover:bg-[var(--navy-hover)]" onClick={() => runScenario(scenario)} disabled={isRunning}>{isRunning ? <><RotateCcw className="animate-spin" /> Running {Math.round(progress)}%</> : <><Play className="fill-current" /> Run simulation</>}</Button>
              {isRunning && <Progress value={progress} aria-label="Simulation progress" className="h-1.5" />}
              {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
              <div className="flex w-full items-center justify-between rounded-xl px-1 py-2 text-sm font-semibold text-[var(--navy)]"><span className="flex items-center gap-2"><SlidersHorizontal className="h-4 w-4" /> Advanced settings</span><span className="text-xs font-normal text-muted-foreground">Next</span></div>
            </CardContent>
          </Card>
        </aside>

        <section className="min-w-0 space-y-5" aria-label="Simulation results">
          <div className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
            <Card className="overflow-hidden border-[var(--line)] bg-[var(--navy)] text-white shadow-[0_16px_50px_rgba(38,52,69,0.14)]">
              <CardContent className="grid min-h-[210px] gap-8 p-6 sm:grid-cols-[1fr_auto] sm:p-8">
                <div className="flex flex-col justify-between"><div><p className="text-sm font-semibold text-white/65">Median chain economic profit</p><p className="mt-2 font-heading text-[clamp(2.6rem,6vw,5.3rem)] font-bold leading-none tracking-[-0.06em]">{result ? compactCurrency.format(result.chainEconomicProfit) : '—'}</p></div><p className="mt-6 max-w-xl text-sm leading-6 text-white/70">Full economic result after direct costs, labor, capital, and overhead. Unfinished cattle are marked to market at the horizon.</p></div>
                <div className="grid grid-cols-2 gap-3 self-end sm:grid-cols-1"><HeroMetric label="Operating contribution" value={result ? compactCurrency.format(result.chainOperatingContribution) : '—'} /><HeroMetric label="Probability of loss" value={result ? `${Math.round(result.chainProbabilityOfLoss * 100)}%` : '—'} /></div>
              </CardContent>
            </Card>
            <Card className="border-[var(--line)] bg-white shadow-sm"><CardHeader className="pb-2"><p className="eyebrow">Throughput</p><CardTitle className="font-heading text-xl text-[var(--navy)]">Where the cattle land</CardTitle></CardHeader><CardContent className="space-y-4"><div className="flex items-end justify-between gap-3"><div><span className="text-3xl font-bold tabular-nums text-[var(--navy)]">{result ? whole.format(result.completedHead) : '—'}</span><span className="ml-2 text-sm text-muted-foreground">completed</span></div><span className="text-sm font-semibold text-[var(--positive)]">{result ? `${(completedRate * 100).toFixed(1)}%` : '—'}</span></div><div className="h-3 overflow-hidden rounded-full bg-[var(--soft-bg)]"><div className="h-full rounded-full bg-[var(--positive)] transition-[width] duration-500" style={{ width: `${completedRate * 100}%` }} /></div><div className="grid grid-cols-2 gap-3 border-t border-[var(--line)] pt-4"><MiniMetric label="Mortality" value={result ? whole.format(result.mortalityHead) : '—'} /><MiniMetric label="Ending inventory" value={result ? whole.format(result.endingInventoryHead) : '—'} /></div></CardContent></Card>
          </div>
          <div><div className="mb-3 flex flex-wrap items-end justify-between gap-3"><div><p className="eyebrow">Sector economics</p><h2 className="mt-1 font-heading text-2xl font-bold tracking-tight text-[var(--navy)]">Value across the chain</h2></div><p className="text-sm text-muted-foreground">P10–P90 range from {scenario.trials} trials</p></div><div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">{PHASE_ORDER.map((key) => <SectorCard key={key} phaseKey={key} result={result} />)}</div></div>
          <Card className="border-[var(--line)] bg-white shadow-sm"><CardHeader className="flex-row items-center justify-between space-y-0"><div><p className="eyebrow">Physical flow</p><CardTitle className="mt-1 font-heading text-xl text-[var(--navy)]">From calf to retail case</CardTitle></div><Badge variant="secondary" className="bg-[var(--soft-bg)] text-muted-foreground">Monthly model</Badge></CardHeader><CardContent><div className="grid gap-2 md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] md:items-center">{PHASE_ORDER.map((key, index) => <div className="contents" key={key}><FlowNode phaseKey={key} result={result} />{index < PHASE_ORDER.length - 1 && <ArrowRight className="mx-auto hidden h-5 w-5 text-muted-foreground/50 md:block" aria-hidden="true" />}</div>)}</div></CardContent></Card>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><SummaryTile label="Total direct + economic costs" value={result ? compactCurrency.format(totalCosts) : '—'} /><SummaryTile label="Retail beef produced" value={result ? `${compactNumber(result.retailPounds)} lb` : '—'} /><SummaryTile label="Break-even retail price" value={result ? `${result.breakEvenRetailPricePerLb.toFixed(2)}/lb` : '—'} /><SummaryTile label="Flow reconciliation" value={result && Math.abs(result.reconciliationDifference) < 0.01 ? 'Balanced' : 'Review'} positive={!!result && Math.abs(result.reconciliationDifference) < 0.01} /></div>
          <p className="px-1 pb-4 text-xs leading-5 text-muted-foreground">Planning model using editable national reference assumptions. Results are scenarios, not USDA forecasts or financial advice.</p>
        </section>
      </div>
    </main>
  );
}

function MoneyInput({ label, value, suffix, step = '1', onChange }: { label: string; value: number; suffix: string; step?: string; onChange: (value: number) => void }) {
  const id = label.toLowerCase().replaceAll(' ', '-');
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span><Input id={id} type="number" min={0} step={step} value={value} onChange={(event) => onChange(Math.max(0, Number(event.target.value)))} className="h-11 border-[var(--line)] bg-[var(--soft-bg)] pl-7 pr-12 tabular-nums" /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{suffix}</span></div></div>;
}

function HeroMetric({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-3"><p className="text-xs font-medium text-white/55">{label}</p><p className="mt-1 text-lg font-bold tabular-nums">{value}</p></div>; }
function MiniMetric({ label, value }: { label: string; value: string }) { return <div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-semibold tabular-nums text-[var(--navy)]">{value}</p></div>; }

function SectorCard({ phaseKey, result }: { phaseKey: PhaseKey; result: SimulationSummary | null }) {
  const style = PHASE_STYLES[phaseKey];
  const phase = result?.phases[phaseKey];
  const isPositive = (phase?.economicProfit ?? 0) >= 0;
  return <Card className="overflow-hidden border-[var(--line)] bg-white shadow-sm transition-transform duration-200 hover:-translate-y-0.5"><div className="h-1.5" style={{ background: style.accent }} /><CardContent className="p-5"><div className="flex items-center justify-between"><span className="text-xs font-bold tracking-[0.12em] text-muted-foreground">{style.number}</span><span className="h-2.5 w-2.5 rounded-full" style={{ background: style.accent }} /></div><h3 className="mt-4 font-heading text-lg font-bold text-[var(--navy)]">{phase?.label ?? '—'}</h3><p className={`mt-2 text-2xl font-bold tabular-nums ${isPositive ? 'text-[var(--positive)]' : 'text-[var(--negative)]'}`}>{phase ? compactCurrency.format(phase.economicProfit) : '—'}</p><p className="mt-1 text-xs text-muted-foreground">economic profit</p><div className="mt-5 grid grid-cols-2 gap-3 border-t border-[var(--line)] pt-4"><MiniMetric label="Per started head" value={phase ? currency.format(phase.economicProfitPerStartedHead) : '—'} /><MiniMetric label="Operating" value={phase ? compactCurrency.format(phase.operatingContribution) : '—'} /></div><div className="mt-4 rounded-xl px-3 py-2 text-xs text-muted-foreground" style={{ background: style.surface }}>Range {phase ? `${compactCurrency.format(phase.p10EconomicProfit)} to ${compactCurrency.format(phase.p90EconomicProfit)}` : '—'}</div></CardContent></Card>;
}

function FlowNode({ phaseKey, result }: { phaseKey: PhaseKey; result: SimulationSummary | null }) {
  const phase = result?.phases[phaseKey];
  const style = PHASE_STYLES[phaseKey];
  return <div className="rounded-2xl border border-[var(--line)] p-4" style={{ background: style.surface }}><p className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">{phase?.label ?? phaseKey}</p><p className="mt-2 text-xl font-bold tabular-nums text-[var(--navy)]">{phase ? whole.format(phase.exitedHead) : '—'}</p><p className="text-xs text-muted-foreground">head exited · {phase ? `${whole.format(phase.averageExitWeight)} lb avg.` : '—'}</p></div>;
}

function SummaryTile({ label, value, positive = false }: { label: string; value: string; positive?: boolean }) { return <div className="rounded-2xl border border-[var(--line)] bg-white p-4 shadow-sm"><p className="text-xs text-muted-foreground">{label}</p><p className={`mt-2 text-lg font-bold tabular-nums ${positive ? 'text-[var(--positive)]' : 'text-[var(--navy)]'}`}>{value}</p></div>; }
function compactNumber(value: number) { return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value); }
