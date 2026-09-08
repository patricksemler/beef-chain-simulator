'use client';

import { Bookmark, Database, Play, RotateCcw, SlidersHorizontal, Undo2 } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { SOURCE_NOTES } from '@/lib/model/defaults';
import type { PhaseKey, ScenarioInput } from '@/lib/model/types';

const PHASES: PhaseKey[] = ['cowCalf', 'stocker', 'feedlot', 'downstream'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface Props {
  scenario: ScenarioInput;
  setScenario: React.Dispatch<React.SetStateAction<ScenarioInput>>;
  progress: number;
  isRunning: boolean;
  error: string | null;
  notice: string | null;
  runScenario: (scenario: ScenarioInput) => Promise<unknown>;
  saveBaseline: () => void;
  restoreDefaults: () => void;
}

function toSlider(head: number) { return (Math.log10(Math.max(1, head)) / Math.log10(30_000_000)) * 100; }
function fromSlider(value: number) { return Math.max(1, Math.min(30_000_000, Math.round(10 ** ((value / 100) * Math.log10(30_000_000))))); }

export function SimulatorControls({ scenario, setScenario, progress, isRunning, error, notice, runScenario, saveBaseline, restoreDefaults }: Props) {
  const updateNumber = (key: keyof ScenarioInput, value: number) => setScenario((current) => ({ ...current, [key]: value }));
  const updatePhase = (phase: PhaseKey, key: keyof ScenarioInput['phases'][PhaseKey], value: number) => setScenario((current) => ({ ...current, phases: { ...current.phases, [phase]: { ...current.phases[phase], [key]: value } } }));
  const updateRisk = (key: keyof ScenarioInput['marketRisk'], value: number) => setScenario((current) => ({ ...current, marketRisk: { ...current.marketRisk, [key]: value } }));

  return <aside className="lg:sticky lg:top-5 lg:max-h-[calc(100vh-2.5rem)] lg:self-start lg:overflow-y-auto lg:pr-1">
    <Card className="overflow-hidden border-[var(--line)] bg-white shadow-[0_12px_40px_rgba(38,52,69,0.07)]">
      <CardHeader className="border-b border-[var(--line)] pb-4"><div className="flex items-center justify-between gap-3"><div><p className="eyebrow">Scenario</p><CardTitle className="mt-1 font-heading text-xl text-[var(--navy)]">Core assumptions</CardTitle></div><SlidersHorizontal className="h-5 w-5 text-muted-foreground" aria-hidden="true" /></div></CardHeader>
      <CardContent className="space-y-5 pt-5">
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-3"><Label htmlFor="head-count">Calves entering</Label><span className="text-xs text-muted-foreground">1–30 million</span></div>
          <Input id="head-count" type="number" min={1} max={30_000_000} step={1} value={scenario.totalHead} onChange={(event) => updateNumber('totalHead', Math.max(1, Math.min(30_000_000, Number(event.target.value))))} className="h-11 border-[var(--line)] bg-[var(--soft-bg)] text-base font-semibold tabular-nums" />
          <Slider aria-label="Calves entering, logarithmic scale" value={[toSlider(scenario.totalHead)]} onValueChange={(value) => updateNumber('totalHead', fromSlider(Array.isArray(value) ? value[0] : Number(value)))} min={0} max={100} step={0.1} className="py-1" />
          <div className="flex justify-between text-[11px] text-muted-foreground" aria-hidden="true"><span>1</span><span>10K</span><span>1M</span><span>30M</span></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <SelectField label="Horizon" id="horizon" value={String(scenario.horizonMonths)} onChange={(value) => updateNumber('horizonMonths', Number(value))} options={Array.from({ length: 10 }, (_, index) => ({ value: String((index + 1) * 12), label: `${index + 1} ${index === 0 ? 'year' : 'years'}` }))} />
          <SelectField label="Entry cadence" id="cadence" value={scenario.cadence} onChange={(value) => setScenario((current) => ({ ...current, cadence: value as ScenarioInput['cadence'] }))} options={[{ value: 'even', label: 'Even monthly' }, { value: 'upfront', label: 'All upfront' }, { value: 'spring', label: 'Spring weighted' }, { value: 'fall', label: 'Fall weighted' }, { value: 'custom', label: 'Custom' }]} />
        </div>
        {scenario.cadence === 'custom' && <div><Label>Monthly entry weights</Label><div className="mt-2 grid grid-cols-4 gap-2">{MONTHS.map((month, index) => <div key={month}><span className="mb-1 block text-[11px] text-muted-foreground">{month}</span><Input aria-label={`${month} entry weight`} type="number" min={0} step="0.1" value={scenario.customCadence[index]} onChange={(event) => setScenario((current) => ({ ...current, customCadence: current.customCadence.map((value, itemIndex) => itemIndex === index ? Math.max(0, Number(event.target.value)) : value) }))} className="h-9 px-2" /></div>)}</div></div>}
        <div className="grid grid-cols-2 gap-3">
          <MoneyInput label="Weaned calf" value={scenario.calfPricePerCwt} suffix="/cwt" onChange={(value) => updateNumber('calfPricePerCwt', value)} />
          <MoneyInput label="Feeder cattle" value={scenario.feederPricePerCwt} suffix="/cwt" onChange={(value) => updateNumber('feederPricePerCwt', value)} />
          <MoneyInput label="Fed cattle" value={scenario.fedPricePerCwt} suffix="/cwt" onChange={(value) => updateNumber('fedPricePerCwt', value)} />
          <MoneyInput label="Retail beef" value={scenario.retailPricePerLb} suffix="/lb" step="0.01" onChange={(value) => updateNumber('retailPricePerLb', value)} />
          <MoneyInput label="Feed" value={scenario.feedCostPerTon} suffix="/ton" onChange={(value) => updateNumber('feedCostPerTon', value)} />
          <NumberInput label="Random seed" value={scenario.seed} onChange={(value) => updateNumber('seed', Math.round(value))} />
        </div>
        <Accordion className="rounded-2xl border border-[var(--line)] bg-[var(--soft-bg)] px-3">
          <AccordionItem value="advanced"><AccordionTrigger className="py-3 font-semibold no-underline hover:no-underline"><span className="flex items-center gap-2"><SlidersHorizontal className="h-4 w-4" /> Advanced settings</span></AccordionTrigger><AccordionContent className="space-y-5 pb-4">
            <AdvancedSection title="Biology and phase costs">{PHASES.map((phase) => <div key={phase} className="rounded-xl border border-[var(--line)] bg-white p-3"><p className="mb-3 font-heading text-sm font-bold text-[var(--navy)]">{scenario.phases[phase].label}</p><div className="grid grid-cols-2 gap-2"><NumberInput label="Days" value={scenario.phases[phase].durationDays} onChange={(value) => updatePhase(phase, 'durationDays', value)} /><NumberInput label="Daily gain (lb)" value={scenario.phases[phase].averageDailyGain} step="0.01" onChange={(value) => updatePhase(phase, 'averageDailyGain', value)} /><NumberInput label="Mortality (%)" value={scenario.phases[phase].mortalityRate * 100} step="0.1" onChange={(value) => updatePhase(phase, 'mortalityRate', value / 100)} /><NumberInput label="Direct cost/head" value={scenario.phases[phase].directCostPerHead} onChange={(value) => updatePhase(phase, 'directCostPerHead', value)} /><NumberInput label="Daily cost/head" value={scenario.phases[phase].dailyCostPerHead} step="0.01" onChange={(value) => updatePhase(phase, 'dailyCostPerHead', value)} /><NumberInput label="Economic cost/head" value={scenario.phases[phase].economicCostPerHead} onChange={(value) => updatePhase(phase, 'economicCostPerHead', value)} /></div></div>)}</AdvancedSection>
            <AdvancedSection title="Yield and trends"><div className="grid grid-cols-2 gap-2"><NumberInput label="Start weight (lb)" value={scenario.startWeight} onChange={(value) => updateNumber('startWeight', value)} /><NumberInput label="Feed intake (lb/day)" value={scenario.feedDryMatterLbPerDay} step="0.1" onChange={(value) => updateNumber('feedDryMatterLbPerDay', value)} /><NumberInput label="Dressing (%)" value={scenario.dressingPercentage * 100} step="0.1" onChange={(value) => updateNumber('dressingPercentage', value / 100)} /><NumberInput label="Saleable yield (%)" value={scenario.saleableYield * 100} step="0.1" onChange={(value) => updateNumber('saleableYield', value / 100)} /><NumberInput label="Cattle trend (%/yr)" value={scenario.annualCattlePriceTrend * 100} step="0.1" onChange={(value) => updateNumber('annualCattlePriceTrend', value / 100)} /><NumberInput label="Retail trend (%/yr)" value={scenario.annualRetailPriceTrend * 100} step="0.1" onChange={(value) => updateNumber('annualRetailPriceTrend', value / 100)} /><NumberInput label="Feed trend (%/yr)" value={scenario.annualFeedCostTrend * 100} step="0.1" onChange={(value) => updateNumber('annualFeedCostTrend', value / 100)} /><NumberInput label="Byproduct/head" value={scenario.byproductCreditPerHead} onChange={(value) => updateNumber('byproductCreditPerHead', value)} /></div></AdvancedSection>
            <AdvancedSection title="Market risk"><div className="grid grid-cols-2 gap-2"><NumberInput label="Calf volatility (%)" value={scenario.marketRisk.calfVolatility * 100} step="0.1" onChange={(value) => updateRisk('calfVolatility', value / 100)} /><NumberInput label="Feeder volatility (%)" value={scenario.marketRisk.feederVolatility * 100} step="0.1" onChange={(value) => updateRisk('feederVolatility', value / 100)} /><NumberInput label="Fed volatility (%)" value={scenario.marketRisk.fedVolatility * 100} step="0.1" onChange={(value) => updateRisk('fedVolatility', value / 100)} /><NumberInput label="Retail volatility (%)" value={scenario.marketRisk.retailVolatility * 100} step="0.1" onChange={(value) => updateRisk('retailVolatility', value / 100)} /><NumberInput label="Feed volatility (%)" value={scenario.marketRisk.feedVolatility * 100} step="0.1" onChange={(value) => updateRisk('feedVolatility', value / 100)} /><NumberInput label="Common correlation" value={scenario.marketRisk.commonMarketCorrelation} step="0.05" onChange={(value) => updateRisk('commonMarketCorrelation', value)} /></div></AdvancedSection>
          </AccordionContent></AccordionItem>
          <AccordionItem value="methodology"><AccordionTrigger className="py-3 font-semibold no-underline hover:no-underline"><span className="flex items-center gap-2"><Database className="h-4 w-4" /> Data & methodology</span></AccordionTrigger><AccordionContent className="space-y-3 pb-4"><p className="text-xs leading-5 text-muted-foreground">The editable baseline is a planning reference assembled from national USDA series. It is not a forecast.</p>{SOURCE_NOTES.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="block rounded-xl border border-[var(--line)] bg-white p-3 no-underline"><span className="block text-xs font-semibold text-[var(--navy)]">{source.label}</span><span className="text-[11px] text-muted-foreground">{source.organization}</span></a>)}</AccordionContent></AccordionItem>
        </Accordion>
        <Button className="h-12 w-full bg-[var(--navy)] text-base font-semibold text-white hover:bg-[var(--navy-hover)]" onClick={() => void runScenario(scenario)} disabled={isRunning}>{isRunning ? <><RotateCcw className="animate-spin" /> Running {Math.round(progress)}%</> : <><Play className="fill-current" /> Run simulation</>}</Button>
        {isRunning && <Progress value={progress} aria-label="Simulation progress" className="h-1.5" />}
        {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
        {notice && <p role="status" className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</p>}
        <div className="grid grid-cols-2 gap-2"><Button variant="outline" className="border-[var(--line)]" onClick={saveBaseline}><Bookmark /> Save baseline</Button><Button variant="ghost" onClick={restoreDefaults}><Undo2 /> Restore defaults</Button></div>
      </CardContent>
    </Card>
  </aside>;
}

function SelectField({ label, id, value, onChange, options }: { label: string; id: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[] }) { return <div className="space-y-2"><Label htmlFor={id}>{label}</Label><Select value={value} onValueChange={(nextValue) => { if (nextValue !== null) onChange(nextValue); }}><SelectTrigger id={id} className="h-11 w-full border-[var(--line)] bg-[var(--soft-bg)]"><SelectValue /></SelectTrigger><SelectContent>{options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></div>; }
function MoneyInput({ label, value, suffix, step = '1', onChange }: { label: string; value: number; suffix: string; step?: string; onChange: (value: number) => void }) { const id = label.toLowerCase().replaceAll(' ', '-'); return <div className="space-y-2"><Label htmlFor={id}>{label}</Label><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span><Input id={id} type="number" min={0} step={step} value={value} onChange={(event) => onChange(Math.max(0, Number(event.target.value)))} className="h-11 border-[var(--line)] bg-[var(--soft-bg)] pl-7 pr-12 tabular-nums" /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{suffix}</span></div></div>; }
function NumberInput({ label, value, step = '1', onChange }: { label: string; value: number; step?: string; onChange: (value: number) => void }) { const id = `advanced-${label.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}`; return <div className="space-y-1.5"><Label htmlFor={id} className="text-xs text-muted-foreground">{label}</Label><Input id={id} type="number" min={0} step={step} value={Number.isFinite(value) ? value : 0} onChange={(event) => onChange(Math.max(0, Number(event.target.value)))} className="h-9 bg-white px-2 tabular-nums" /></div>; }
function AdvancedSection({ title, children }: { title: string; children: React.ReactNode }) { return <section className="space-y-2"><h3 className="font-heading text-sm font-bold text-[var(--navy)]">{title}</h3>{children}</section>; }
