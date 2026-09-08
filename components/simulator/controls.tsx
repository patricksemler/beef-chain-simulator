'use client';

import {
  Bookmark,
  Database,
  Play,
  RotateCcw,
  Settings2,
  Undo2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Slider } from '@/components/ui/slider';
import { SOURCE_NOTES } from '@/lib/model/defaults';
import type { PhaseKey, ScenarioInput } from '@/lib/model/types';

const PHASES: PhaseKey[] = ['cowCalf', 'stocker', 'feedlot', 'downstream'];
const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

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

function toSlider(head: number) {
  return (Math.log10(Math.max(1, head)) / Math.log10(30_000_000)) * 100;
}

function fromSlider(value: number) {
  return Math.max(
    1,
    Math.min(
      30_000_000,
      Math.round(10 ** ((value / 100) * Math.log10(30_000_000))),
    ),
  );
}

export function SimulatorControls({
  scenario,
  setScenario,
  progress,
  isRunning,
  error,
  notice,
  runScenario,
  saveBaseline,
  restoreDefaults,
}: Props) {
  const updateNumber = (key: keyof ScenarioInput, value: number) =>
    setScenario((current) => ({ ...current, [key]: value }));
  const updatePhase = (
    phase: PhaseKey,
    key: keyof ScenarioInput['phases'][PhaseKey],
    value: number,
  ) =>
    setScenario((current) => ({
      ...current,
      phases: {
        ...current.phases,
        [phase]: { ...current.phases[phase], [key]: value },
      },
    }));
  const updateRisk = (key: keyof ScenarioInput['marketRisk'], value: number) =>
    setScenario((current) => ({
      ...current,
      marketRisk: { ...current.marketRisk, [key]: value },
    }));

  return (
    <aside
      className="lg:sticky lg:top-6 lg:self-start"
      aria-label="Scenario controls"
    >
      <div className="surface overflow-hidden">
        <div className="border-b border-[var(--line)] px-5 py-4">
          <h2 className="font-heading text-base font-semibold text-[var(--ink)]">
            Scenario
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Set the scale and market assumptions.
          </p>
        </div>

        <div className="space-y-5 p-5">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="head-count">Calves entering</Label>
              <span className="text-xs text-muted-foreground">
                1–30 million
              </span>
            </div>
            <Input
              id="head-count"
              name="totalHead"
              autoComplete="off"
              inputMode="numeric"
              type="number"
              min={1}
              max={30_000_000}
              step={1}
              value={scenario.totalHead}
              onChange={(event) =>
                updateNumber(
                  'totalHead',
                  Math.max(1, Math.min(30_000_000, Number(event.target.value))),
                )
              }
              className="h-10 bg-white text-base font-semibold tabular-nums"
            />
            <Slider
              aria-label="Calves entering, logarithmic scale"
              value={[toSlider(scenario.totalHead)]}
              onValueChange={(value) =>
                updateNumber(
                  'totalHead',
                  fromSlider(Array.isArray(value) ? value[0] : Number(value)),
                )
              }
              min={0}
              max={100}
              step={0.1}
              className="py-1"
            />
            <div
              className="flex justify-between text-xs text-muted-foreground"
              aria-hidden="true"
            >
              <span>1</span>
              <span>10K</span>
              <span>1M</span>
              <span>30M</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <SelectField
              label="Horizon"
              id="horizon"
              value={String(scenario.horizonMonths)}
              onChange={(value) => updateNumber('horizonMonths', Number(value))}
              options={Array.from({ length: 10 }, (_, index) => ({
                value: String((index + 1) * 12),
                label: `${index + 1} ${index === 0 ? 'year' : 'years'}`,
              }))}
            />
            <SelectField
              label="Entry cadence"
              id="cadence"
              value={scenario.cadence}
              onChange={(value) =>
                setScenario((current) => ({
                  ...current,
                  cadence: value as ScenarioInput['cadence'],
                }))
              }
              options={[
                { value: 'even', label: 'Even monthly' },
                { value: 'upfront', label: 'All upfront' },
                { value: 'spring', label: 'Spring weighted' },
                { value: 'fall', label: 'Fall weighted' },
                { value: 'custom', label: 'Custom' },
              ]}
            />
          </div>

          {scenario.cadence === 'custom' && (
            <fieldset>
              <legend className="text-sm font-medium">
                Monthly entry weights
              </legend>
              <div className="mt-2 grid grid-cols-4 gap-2">
                {MONTHS.map((month, index) => (
                  <div key={month}>
                    <Label
                      htmlFor={`cadence-${index}`}
                      className="mb-1 block text-xs text-muted-foreground"
                    >
                      {month}
                    </Label>
                    <Input
                      id={`cadence-${index}`}
                      name={`cadence-${month.toLowerCase()}`}
                      autoComplete="off"
                      inputMode="decimal"
                      type="number"
                      min={0}
                      step="0.1"
                      value={scenario.customCadence[index]}
                      onChange={(event) =>
                        setScenario((current) => ({
                          ...current,
                          customCadence: current.customCadence.map(
                            (value, itemIndex) =>
                              itemIndex === index
                                ? Math.max(0, Number(event.target.value))
                                : value,
                          ),
                        }))
                      }
                      className="h-9 px-2 tabular-nums"
                    />
                  </div>
                ))}
              </div>
            </fieldset>
          )}

          <div className="grid grid-cols-2 gap-3">
            <MoneyInput
              id="calf-price"
              label="Weaned calf"
              value={scenario.calfPricePerCwt}
              suffix="/cwt"
              onChange={(value) => updateNumber('calfPricePerCwt', value)}
            />
            <MoneyInput
              id="feeder-price"
              label="Feeder cattle"
              value={scenario.feederPricePerCwt}
              suffix="/cwt"
              onChange={(value) => updateNumber('feederPricePerCwt', value)}
            />
            <MoneyInput
              id="fed-price"
              label="Fed cattle"
              value={scenario.fedPricePerCwt}
              suffix="/cwt"
              onChange={(value) => updateNumber('fedPricePerCwt', value)}
            />
            <MoneyInput
              id="retail-price"
              label="Retail beef"
              value={scenario.retailPricePerLb}
              suffix="/lb"
              step="0.01"
              onChange={(value) => updateNumber('retailPricePerLb', value)}
            />
            <MoneyInput
              id="feed-cost"
              label="Feed"
              value={scenario.feedCostPerTon}
              suffix="/ton"
              onChange={(value) => updateNumber('feedCostPerTon', value)}
            />
            <NumberInput
              id="random-seed"
              label="Random seed"
              value={scenario.seed}
              onChange={(value) => updateNumber('seed', Math.round(value))}
            />
          </div>

          <Sheet>
            <SheetTrigger
              render={
                <Button
                  variant="outline"
                  className="h-9 w-full justify-between px-3"
                />
              }
            >
              <span className="flex items-center gap-2">
                <Settings2 aria-hidden="true" />
                Advanced assumptions
              </span>
              <span className="text-xs font-normal text-muted-foreground">
                Biology, costs & risk
              </span>
            </SheetTrigger>
            <SheetContent className="w-full gap-0 sm:max-w-xl">
              <SheetHeader className="border-b border-[var(--line)] px-5 py-4">
                <SheetTitle className="font-heading text-lg font-semibold">
                  Advanced assumptions
                </SheetTitle>
                <SheetDescription>
                  Fine-tune biology, phase costs, yields, trends, and market
                  risk.
                </SheetDescription>
              </SheetHeader>
              <div className="min-h-0 flex-1 space-y-7 overflow-y-auto px-5 py-5">
                <AdvancedSection title="Biology and phase costs">
                  <NumberInput
                    id="biological-variation"
                    label="Biological variation (%)"
                    value={scenario.biologicalVariation * 100}
                    step="0.1"
                    onChange={(value) =>
                      updateNumber('biologicalVariation', value / 100)
                    }
                  />
                  {PHASES.map((phase) => (
                    <fieldset
                      key={phase}
                      className="border-t border-[var(--line)] pt-4 first:border-0 first:pt-1"
                    >
                      <legend className="font-heading text-sm font-semibold text-[var(--ink)]">
                        {scenario.phases[phase].label}
                      </legend>
                      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                        <NumberInput
                          id={`${phase}-days`}
                          label="Days"
                          value={scenario.phases[phase].durationDays}
                          onChange={(value) =>
                            updatePhase(phase, 'durationDays', value)
                          }
                        />
                        <NumberInput
                          id={`${phase}-gain`}
                          label="Daily gain (lb)"
                          value={scenario.phases[phase].averageDailyGain}
                          step="0.01"
                          onChange={(value) =>
                            updatePhase(phase, 'averageDailyGain', value)
                          }
                        />
                        <NumberInput
                          id={`${phase}-mortality`}
                          label="Mortality (%)"
                          value={scenario.phases[phase].mortalityRate * 100}
                          step="0.1"
                          onChange={(value) =>
                            updatePhase(phase, 'mortalityRate', value / 100)
                          }
                        />
                        <NumberInput
                          id={`${phase}-direct-cost`}
                          label="Direct cost/head"
                          value={scenario.phases[phase].directCostPerHead}
                          onChange={(value) =>
                            updatePhase(phase, 'directCostPerHead', value)
                          }
                        />
                        <NumberInput
                          id={`${phase}-daily-cost`}
                          label="Daily cost/head"
                          value={scenario.phases[phase].dailyCostPerHead}
                          step="0.01"
                          onChange={(value) =>
                            updatePhase(phase, 'dailyCostPerHead', value)
                          }
                        />
                        <NumberInput
                          id={`${phase}-economic-cost`}
                          label="Economic cost/head"
                          value={scenario.phases[phase].economicCostPerHead}
                          onChange={(value) =>
                            updatePhase(phase, 'economicCostPerHead', value)
                          }
                        />
                      </div>
                    </fieldset>
                  ))}
                </AdvancedSection>

                <AdvancedSection title="Yield and trends">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <NumberInput
                      id="start-weight"
                      label="Start weight (lb)"
                      value={scenario.startWeight}
                      onChange={(value) => updateNumber('startWeight', value)}
                    />
                    <NumberInput
                      id="feed-intake"
                      label="Feed intake (lb/day)"
                      value={scenario.feedDryMatterLbPerDay}
                      step="0.1"
                      onChange={(value) =>
                        updateNumber('feedDryMatterLbPerDay', value)
                      }
                    />
                    <NumberInput
                      id="dressing"
                      label="Dressing (%)"
                      value={scenario.dressingPercentage * 100}
                      step="0.1"
                      onChange={(value) =>
                        updateNumber('dressingPercentage', value / 100)
                      }
                    />
                    <NumberInput
                      id="saleable-yield"
                      label="Saleable yield (%)"
                      value={scenario.saleableYield * 100}
                      step="0.1"
                      onChange={(value) =>
                        updateNumber('saleableYield', value / 100)
                      }
                    />
                    <NumberInput
                      id="cattle-trend"
                      label="Cattle trend (%/yr)"
                      value={scenario.annualCattlePriceTrend * 100}
                      step="0.1"
                      onChange={(value) =>
                        updateNumber('annualCattlePriceTrend', value / 100)
                      }
                    />
                    <NumberInput
                      id="retail-trend"
                      label="Retail trend (%/yr)"
                      value={scenario.annualRetailPriceTrend * 100}
                      step="0.1"
                      onChange={(value) =>
                        updateNumber('annualRetailPriceTrend', value / 100)
                      }
                    />
                    <NumberInput
                      id="feed-trend"
                      label="Feed trend (%/yr)"
                      value={scenario.annualFeedCostTrend * 100}
                      step="0.1"
                      onChange={(value) =>
                        updateNumber('annualFeedCostTrend', value / 100)
                      }
                    />
                    <NumberInput
                      id="byproduct-credit"
                      label="Byproduct/head"
                      value={scenario.byproductCreditPerHead}
                      onChange={(value) =>
                        updateNumber('byproductCreditPerHead', value)
                      }
                    />
                  </div>
                </AdvancedSection>

                <AdvancedSection title="Market risk">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <NumberInput
                      id="calf-volatility"
                      label="Calf volatility (%)"
                      value={scenario.marketRisk.calfVolatility * 100}
                      step="0.1"
                      onChange={(value) =>
                        updateRisk('calfVolatility', value / 100)
                      }
                    />
                    <NumberInput
                      id="feeder-volatility"
                      label="Feeder volatility (%)"
                      value={scenario.marketRisk.feederVolatility * 100}
                      step="0.1"
                      onChange={(value) =>
                        updateRisk('feederVolatility', value / 100)
                      }
                    />
                    <NumberInput
                      id="fed-volatility"
                      label="Fed volatility (%)"
                      value={scenario.marketRisk.fedVolatility * 100}
                      step="0.1"
                      onChange={(value) =>
                        updateRisk('fedVolatility', value / 100)
                      }
                    />
                    <NumberInput
                      id="retail-volatility"
                      label="Retail volatility (%)"
                      value={scenario.marketRisk.retailVolatility * 100}
                      step="0.1"
                      onChange={(value) =>
                        updateRisk('retailVolatility', value / 100)
                      }
                    />
                    <NumberInput
                      id="feed-volatility"
                      label="Feed volatility (%)"
                      value={scenario.marketRisk.feedVolatility * 100}
                      step="0.1"
                      onChange={(value) =>
                        updateRisk('feedVolatility', value / 100)
                      }
                    />
                    <NumberInput
                      id="market-correlation"
                      label="Common correlation"
                      value={scenario.marketRisk.commonMarketCorrelation}
                      step="0.05"
                      onChange={(value) =>
                        updateRisk('commonMarketCorrelation', value)
                      }
                    />
                  </div>
                </AdvancedSection>

                <AdvancedSection title="Data and methodology">
                  <p className="text-sm leading-6 text-muted-foreground">
                    The editable baseline is a planning reference assembled from
                    national USDA series. It is not a forecast.
                  </p>
                  <div className="divide-y divide-[var(--line)] border-y border-[var(--line)]">
                    {SOURCE_NOTES.map((source) => (
                      <a
                        key={source.url}
                        href={source.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between gap-4 py-3 text-sm no-underline hover:text-[var(--accent-strong)]"
                      >
                        <span>
                          <span className="block font-medium text-[var(--ink)]">
                            {source.label}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {source.organization}
                          </span>
                        </span>
                        <Database
                          className="h-4 w-4 shrink-0 text-muted-foreground"
                          aria-hidden="true"
                        />
                      </a>
                    ))}
                  </div>
                </AdvancedSection>
              </div>
            </SheetContent>
          </Sheet>

          <Button
            className="h-11 w-full bg-[var(--accent-strong)] text-sm font-semibold text-white hover:bg-[var(--accent-strong-hover)]"
            onClick={() => void runScenario(scenario)}
            disabled={isRunning}
          >
            {isRunning ? (
              <>
                <RotateCcw className="animate-spin" aria-hidden="true" />
                Running… {Math.round(progress)}%
              </>
            ) : (
              <>
                <Play className="fill-current" aria-hidden="true" />
                Run Simulation
              </>
            )}
          </Button>
          {isRunning && (
            <Progress
              value={progress}
              aria-label="Simulation progress"
              className="h-1.5"
            />
          )}
          <div aria-live="polite">
            {error && (
              <p
                role="alert"
                className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800"
              >
                {error}
              </p>
            )}
            {notice && (
              <output className="block rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                {notice}
              </output>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 border-t border-[var(--line)] bg-[var(--soft-bg)] p-3">
          <Button
            variant="ghost"
            className="justify-start"
            onClick={saveBaseline}
          >
            <Bookmark aria-hidden="true" />
            Save Baseline
          </Button>
          <Button
            variant="ghost"
            className="justify-start"
            onClick={restoreDefaults}
          >
            <Undo2 aria-hidden="true" />
            Restore Defaults
          </Button>
        </div>
      </div>
    </aside>
  );
}

function SelectField({
  label,
  id,
  value,
  onChange,
  options,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Select
        name={id}
        value={value}
        onValueChange={(nextValue) => {
          if (nextValue !== null) onChange(nextValue);
        }}
      >
        <SelectTrigger id={id} className="h-10 w-full bg-white">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function MoneyInput({
  id,
  label,
  value,
  suffix,
  step = '1',
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  suffix: string;
  step?: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <span
          className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground"
          aria-hidden="true"
        >
          $
        </span>
        <Input
          id={id}
          name={id}
          autoComplete="off"
          inputMode="decimal"
          type="number"
          min={0}
          step={step}
          value={value}
          onChange={(event) =>
            onChange(Math.max(0, Number(event.target.value)))
          }
          className="h-10 bg-white pl-7 pr-12 tabular-nums"
        />
        <span
          className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground"
          aria-hidden="true"
        >
          {suffix}
        </span>
      </div>
    </div>
  );
}

function NumberInput({
  id,
  label,
  value,
  step = '1',
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  step?: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Input
        id={id}
        name={id}
        autoComplete="off"
        inputMode="decimal"
        type="number"
        min={0}
        step={step}
        value={Number.isFinite(value) ? value : 0}
        onChange={(event) => onChange(Math.max(0, Number(event.target.value)))}
        className="h-9 bg-white px-2 tabular-nums"
      />
    </div>
  );
}

function AdvancedSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h3 className="font-heading text-sm font-semibold text-[var(--ink)]">
        {title}
      </h3>
      {children}
    </section>
  );
}
