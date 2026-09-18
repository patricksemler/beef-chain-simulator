'use client';

import { ArrowUpRight, Play, Undo2 } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import {
  NumberField,
  PercentField,
  SelectField,
} from '@/components/simulator/fields';
import { SOURCE_NOTES } from '@/lib/model/defaults';
import { whole } from '@/lib/model/format';
import {
  applyHistoricalYear,
  AVAILABLE_HISTORICAL_YEARS,
  type HistoricalYear,
} from '@/lib/model/historical';
import type { PhaseKey, ScenarioInput } from '@/lib/model/types';
import type { ScenarioSection } from '@/lib/assistant/types';

const PHASES: PhaseKey[] = [
  'cowCalf',
  'stocker',
  'feedlot',
  'packer',
  'retail',
];
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
const MAX_HEAD = 30_000_000;
const LOG_MAX = Math.log10(MAX_HEAD);

/** Tick values chosen so their true log positions are evenly spread. */
const HEAD_TICKS = [1, 100, 10_000, 1_000_000, MAX_HEAD];

const HORIZON_OPTIONS = Array.from({ length: 10 }, (_, index) => ({
  value: String((index + 1) * 12),
  label: index === 0 ? '1 year' : `${index + 1} years`,
}));

const CADENCE_OPTIONS = [
  { value: 'even', label: 'Even monthly' },
  { value: 'upfront', label: 'All upfront' },
  { value: 'spring', label: 'Spring weighted' },
  { value: 'fall', label: 'Fall weighted' },
  { value: 'custom', label: 'Custom weights' },
] as const;

const TRIAL_OPTIONS = [
  { value: '100', label: '100 — fastest' },
  { value: '250', label: '250 — balanced' },
  { value: '500', label: '500 — tighter' },
  { value: '1000', label: '1,000 — most stable' },
] as const;

const YEAR_OPTIONS = [...AVAILABLE_HISTORICAL_YEARS]
  .reverse()
  .map((year) => ({ value: String(year), label: String(year) }));

function headToSlider(head: number) {
  return (Math.log10(Math.max(1, head)) / LOG_MAX) * 100;
}
function sliderToHead(position: number) {
  return Math.min(
    MAX_HEAD,
    Math.max(1, Math.round(10 ** ((position / 100) * LOG_MAX))),
  );
}

function tickLabel(value: number) {
  if (value >= 1_000_000) return `${value / 1_000_000}M`;
  if (value >= 1_000) return `${value / 1_000}K`;
  return String(value);
}

interface Props {
  scenario: ScenarioInput;
  setScenario: React.Dispatch<React.SetStateAction<ScenarioInput>>;
  isRunning: boolean;
  isStale: boolean;
  error: string | null;
  runScenario: (scenario: ScenarioInput) => Promise<unknown>;
  restoreDefaults: () => void;
  openSections: ScenarioSection[];
  onOpenSectionsChange: (sections: ScenarioSection[]) => void;
}

export function ScenarioPanel({
  scenario,
  setScenario,
  isRunning,
  isStale,
  error,
  runScenario,
  restoreDefaults,
  openSections,
  onOpenSectionsChange,
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
    <aside className="scenario-rail" aria-label="Scenario inputs">
      <div className="scenario-rail-inner">
        <header className="flex items-baseline justify-between gap-3 px-5 pt-5 pb-4">
          <h2 className="rail-title">Scenario</h2>
          <Button
            variant="ghost"
            size="sm"
            className="-mr-2 h-9 gap-1.5 px-2.5 text-[0.9375rem] text-muted-foreground hover:text-[var(--ink)]"
            onClick={restoreDefaults}
          >
            <Undo2 className="size-3.5" aria-hidden="true" />
            Reset
          </Button>
        </header>

        <div className="scenario-scroll">
          <div className="space-y-5 px-5 pb-5">
            <div className="space-y-2.5">
              <div className="flex items-baseline justify-between gap-2">
                <Label htmlFor="assistant-total-head" className="field-label">
                  Calves entering
                </Label>
                <span className="detail tabular-nums">
                  {whole(scenario.totalHead)} head
                </span>
              </div>
              <Input
                id="assistant-total-head"
                name="totalHead"
                type="number"
                inputMode="numeric"
                autoComplete="off"
                spellCheck={false}
                min={1}
                max={MAX_HEAD}
                step={1}
                value={scenario.totalHead}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  if (Number.isNaN(next)) return;
                  updateNumber(
                    'totalHead',
                    Math.min(MAX_HEAD, Math.max(1, Math.round(next))),
                  );
                }}
                className="bg-white text-lg font-semibold tabular-nums"
              />
              <div className="pt-0.5">
                <Slider
                  aria-label="Calves entering, logarithmic scale"
                  value={[headToSlider(scenario.totalHead)]}
                  onValueChange={(value) =>
                    updateNumber(
                      'totalHead',
                      sliderToHead(
                        Array.isArray(value) ? value[0] : Number(value),
                      ),
                    )
                  }
                  min={0}
                  max={100}
                  step={0.1}
                />
                <div className="tick-rail" aria-hidden="true">
                  {HEAD_TICKS.map((tick) => (
                    <span
                      key={tick}
                      className="tick"
                      style={{ left: `${headToSlider(tick)}%` }}
                    >
                      {tickLabel(tick)}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="field-grid">
              <SelectField
                id="horizon"
                label="Time period"
                value={String(scenario.horizonMonths)}
                options={HORIZON_OPTIONS}
                onChange={(value) =>
                  updateNumber('horizonMonths', Number(value))
                }
              />
              <SelectField
                id="cadence"
                label="When calves enter"
                value={scenario.cadence}
                options={CADENCE_OPTIONS}
                onChange={(value) =>
                  setScenario((current) => ({
                    ...current,
                    cadence: value as ScenarioInput['cadence'],
                  }))
                }
              />
            </div>

            {scenario.cadence === 'custom' ? (
              <fieldset
                className="phase-group"
                aria-labelledby="monthly-weights"
              >
                <h4 id="monthly-weights" className="phase-legend">
                  Monthly weights
                </h4>
                <div className="grid grid-cols-4 gap-2">
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
                        type="number"
                        inputMode="decimal"
                        autoComplete="off"
                        spellCheck={false}
                        min={0}
                        step={0.1}
                        value={scenario.customCadence[index]}
                        onChange={(event) =>
                          setScenario((current) => ({
                            ...current,
                            customCadence: current.customCadence.map(
                              (weight, itemIndex) =>
                                itemIndex === index
                                  ? Math.max(0, Number(event.target.value) || 0)
                                  : weight,
                            ),
                          }))
                        }
                        className="bg-white px-2 text-sm tabular-nums"
                      />
                    </div>
                  ))}
                </div>
              </fieldset>
            ) : null}
          </div>

          <Accordion
            value={openSections}
            onValueChange={(value) =>
              onOpenSectionsChange(value as ScenarioSection[])
            }
            className="border-t border-[var(--line)]"
          >
            <Section value="prices" title="Prices">
              <div className="field-grid">
                <NumberField
                  id="calf-price"
                  label="Weaned calf"
                  unit="$/cwt"
                  value={scenario.calfPricePerCwt}
                  onChange={(value) => updateNumber('calfPricePerCwt', value)}
                />
                <NumberField
                  id="feeder-price"
                  label="Feeder cattle"
                  unit="$/cwt"
                  value={scenario.feederPricePerCwt}
                  onChange={(value) => updateNumber('feederPricePerCwt', value)}
                />
                <NumberField
                  id="fed-price"
                  label="Fed cattle"
                  unit="$/cwt"
                  value={scenario.fedPricePerCwt}
                  onChange={(value) => updateNumber('fedPricePerCwt', value)}
                />
                <NumberField
                  id="wholesale-price"
                  label="Wholesale beef"
                  unit="$/lb"
                  step={0.01}
                  value={scenario.wholesalePricePerLb}
                  onChange={(value) =>
                    updateNumber('wholesalePricePerLb', value)
                  }
                />
                <NumberField
                  id="retail-price"
                  label="Retail beef"
                  unit="$/lb"
                  step={0.01}
                  value={scenario.retailPricePerLb}
                  onChange={(value) => updateNumber('retailPricePerLb', value)}
                />
                <NumberField
                  id="feed-cost"
                  label="Feed"
                  unit="$/ton"
                  value={scenario.feedCostPerTon}
                  onChange={(value) => updateNumber('feedCostPerTon', value)}
                />
                <NumberField
                  id="byproduct-credit"
                  label="Byproduct"
                  unit="$/head"
                  value={scenario.byproductCreditPerHead}
                  onChange={(value) =>
                    updateNumber('byproductCreditPerHead', value)
                  }
                />
              </div>
            </Section>

            <Section value="biology" title="Herd &amp; costs">
              <div className="space-y-4">
                <div className="field-grid">
                  <NumberField
                    id="start-weight"
                    label="Start weight"
                    unit="lb"
                    value={scenario.startWeight}
                    onChange={(value) => updateNumber('startWeight', value)}
                  />
                  <PercentField
                    id="biological-variation"
                    label="Animal variation"
                    value={scenario.biologicalVariation}
                    onChange={(value) =>
                      updateNumber('biologicalVariation', value)
                    }
                  />
                </div>
                {PHASES.map((phase) => (
                  <fieldset
                    key={phase}
                    className="phase-group"
                    aria-labelledby={`${phase}-heading`}
                  >
                    <h4 id={`${phase}-heading`} className="phase-legend">
                      {scenario.phases[phase].label}
                    </h4>
                    <div className="field-grid">
                      <NumberField
                        id={`${phase}-days`}
                        label="Days"
                        value={scenario.phases[phase].durationDays}
                        onChange={(value) =>
                          updatePhase(phase, 'durationDays', value)
                        }
                      />
                      <NumberField
                        id={`${phase}-gain`}
                        label="Daily gain"
                        unit="lb"
                        step={0.01}
                        value={scenario.phases[phase].averageDailyGain}
                        onChange={(value) =>
                          updatePhase(phase, 'averageDailyGain', value)
                        }
                      />
                      <PercentField
                        id={`${phase}-mortality`}
                        label="Mortality"
                        value={scenario.phases[phase].mortalityRate}
                        onChange={(value) =>
                          updatePhase(phase, 'mortalityRate', value)
                        }
                      />
                      <NumberField
                        id={`${phase}-direct-cost`}
                        label="Direct cost"
                        unit="$/head"
                        value={scenario.phases[phase].directCostPerHead}
                        onChange={(value) =>
                          updatePhase(phase, 'directCostPerHead', value)
                        }
                      />
                      <NumberField
                        id={`${phase}-daily-cost`}
                        label="Daily cost"
                        unit="$/head"
                        step={0.01}
                        value={scenario.phases[phase].dailyCostPerHead}
                        onChange={(value) =>
                          updatePhase(phase, 'dailyCostPerHead', value)
                        }
                      />
                      <NumberField
                        id={`${phase}-economic-cost`}
                        label="Overhead"
                        unit="$/head"
                        value={scenario.phases[phase].economicCostPerHead}
                        onChange={(value) =>
                          updatePhase(phase, 'economicCostPerHead', value)
                        }
                      />
                    </div>
                  </fieldset>
                ))}
              </div>
            </Section>

            <Section value="yield" title="Yields &amp; trends">
              <div className="field-grid">
                <PercentField
                  id="dressing"
                  label="Dressing yield"
                  value={scenario.dressingPercentage}
                  onChange={(value) =>
                    updateNumber('dressingPercentage', value)
                  }
                />
                <PercentField
                  id="saleable-yield"
                  label="Saleable yield"
                  value={scenario.saleableYield}
                  onChange={(value) => updateNumber('saleableYield', value)}
                />
                <NumberField
                  id="feed-intake"
                  label="Feed intake"
                  unit="lb/day"
                  step={0.1}
                  value={scenario.feedDryMatterLbPerDay}
                  onChange={(value) =>
                    updateNumber('feedDryMatterLbPerDay', value)
                  }
                />
                <PercentField
                  id="cattle-trend"
                  label="Cattle price trend"
                  value={scenario.annualCattlePriceTrend}
                  max={50}
                  onChange={(value) =>
                    updateNumber('annualCattlePriceTrend', value)
                  }
                />
                <PercentField
                  id="wholesale-trend"
                  label="Wholesale price trend"
                  value={scenario.annualWholesalePriceTrend}
                  max={50}
                  onChange={(value) =>
                    updateNumber('annualWholesalePriceTrend', value)
                  }
                />
                <PercentField
                  id="retail-trend"
                  label="Retail price trend"
                  value={scenario.annualRetailPriceTrend}
                  max={50}
                  onChange={(value) =>
                    updateNumber('annualRetailPriceTrend', value)
                  }
                />
                <PercentField
                  id="feed-trend"
                  label="Feed cost trend"
                  value={scenario.annualFeedCostTrend}
                  max={50}
                  onChange={(value) =>
                    updateNumber('annualFeedCostTrend', value)
                  }
                />
              </div>
            </Section>

            <Section value="risk" title="Price swings">
              <div className="field-grid">
                <PercentField
                  id="calf-volatility"
                  label="Calf price swing"
                  value={scenario.marketRisk.calfVolatility}
                  onChange={(value) => updateRisk('calfVolatility', value)}
                />
                <PercentField
                  id="feeder-volatility"
                  label="Feeder price swing"
                  value={scenario.marketRisk.feederVolatility}
                  onChange={(value) => updateRisk('feederVolatility', value)}
                />
                <PercentField
                  id="fed-volatility"
                  label="Fed price swing"
                  value={scenario.marketRisk.fedVolatility}
                  onChange={(value) => updateRisk('fedVolatility', value)}
                />
                <PercentField
                  id="wholesale-volatility"
                  label="Wholesale price swing"
                  value={scenario.marketRisk.wholesaleVolatility}
                  onChange={(value) => updateRisk('wholesaleVolatility', value)}
                />
                <PercentField
                  id="retail-volatility"
                  label="Retail price swing"
                  value={scenario.marketRisk.retailVolatility}
                  onChange={(value) => updateRisk('retailVolatility', value)}
                />
                <PercentField
                  id="feed-volatility"
                  label="Feed cost swing"
                  value={scenario.marketRisk.feedVolatility}
                  onChange={(value) => updateRisk('feedVolatility', value)}
                />
                <NumberField
                  id="market-correlation"
                  label="Correlation"
                  value={scenario.marketRisk.commonMarketCorrelation}
                  min={0}
                  max={1}
                  step={0.05}
                  onChange={(value) =>
                    updateRisk('commonMarketCorrelation', value)
                  }
                />
              </div>
            </Section>

            <Section value="run" title="Simulation settings">
              <div className="field-grid">
                <div className="col-span-2">
                  <SelectField
                    id="reference-year"
                    label="Reference year"
                    value={String(scenario.referenceYear)}
                    options={YEAR_OPTIONS}
                    onChange={(value) =>
                      setScenario((current) =>
                        applyHistoricalYear(
                          current,
                          Number(value) as HistoricalYear,
                        ),
                      )
                    }
                  />
                </div>
                <SelectField
                  id="trials"
                  label="Runs"
                  value={String(scenario.trials)}
                  options={TRIAL_OPTIONS}
                  onChange={(value) => updateNumber('trials', Number(value))}
                />
                <NumberField
                  id="random-seed"
                  label="Random seed"
                  value={scenario.seed}
                  onChange={(value) => updateNumber('seed', Math.round(value))}
                />
              </div>
            </Section>

            <Section value="sources" title="Data sources">
              <ul id="data-sources" className="space-y-1" tabIndex={-1}>
                {SOURCE_NOTES.map((source) => (
                  <li key={source.url}>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noreferrer"
                      className="group flex items-start gap-2 rounded-md px-2 py-2 -mx-2 text-xs no-underline transition-colors hover:bg-[var(--soft-bg)]"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium text-[var(--ink)]">
                          {source.label}
                        </span>
                        <span className="text-muted-foreground">
                          {source.organization}
                        </span>
                      </span>
                      <ArrowUpRight
                        className="mt-0.5 size-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-[var(--accent-strong)]"
                        aria-hidden="true"
                      />
                    </a>
                  </li>
                ))}
              </ul>
            </Section>
          </Accordion>
        </div>

        <footer className="scenario-footer">
          <div aria-live="polite" className="empty:hidden">
            {error !== null ? (
              <p role="alert" className="status-message status-error">
                {error}
              </p>
            ) : null}
          </div>

          <Button
            className="run-button"
            onClick={() => void runScenario(scenario).catch(() => undefined)}
            disabled={isRunning}
            data-stale={isStale ? '' : undefined}
          >
            {isRunning ? (
              'Working on it…'
            ) : (
              <>
                <Play className="size-4 fill-current" aria-hidden="true" />
                Run Simulation
              </>
            )}
          </Button>
        </footer>
      </div>
    </aside>
  );
}

function Section({
  value,
  title,
  children,
}: {
  value: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <AccordionItem
      id={`scenario-section-${value}`}
      value={value}
      className="border-b border-[var(--line)] px-5"
    >
      <AccordionTrigger className="section-trigger">{title}</AccordionTrigger>
      <AccordionContent className="pb-4">{children}</AccordionContent>
    </AccordionItem>
  );
}
