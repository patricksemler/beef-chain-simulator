'use client';

/**
 * # Scenario Panel
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
 * - `ScenarioPanel`: the main thing this file provides to the app.
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
import { useState } from 'react';
import { ArrowUpRight, Play, Undo2 } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { HelpPopover } from '@/components/simulator/help-popover';
import {
  NumberField,
  NumericInput,
  PercentField,
  SelectField,
  UnitInput,
} from '@/components/simulator/fields';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cloneDefaultScenario, SOURCE_NOTES } from '@/lib/model/defaults';
import { whole } from '@/lib/model/format';
import {
  applyHistoricalYear,
  AVAILABLE_HISTORICAL_YEARS,
  isEditedFromProfile,
  type HistoricalYear,
} from '@/lib/model/historical';
import { PHASE_ORDER } from '@/lib/model/phases';
import type { PhaseKey, ScenarioInput } from '@/lib/model/types';
import {
  CADENCE_LABELS,
  horizonLabel,
  MONTH_LABELS,
  SCENARIO_SECTION_LABELS,
  type ScenarioSection,
} from '@/lib/dashboard';

const MAX_HEAD = 30_000_000;
const LOG_MAX = Math.log10(MAX_HEAD);

/** Tick values chosen so their true log positions are evenly spread. */
const HEAD_TICKS = [1, 100, 10_000, 1_000_000, MAX_HEAD];

const HORIZON_OPTIONS = Array.from({ length: 10 }, (_, index) => ({
  value: String((index + 1) * 12),
  label: horizonLabel((index + 1) * 12),
}));

const CADENCE_OPTIONS = Object.entries(CADENCE_LABELS).map(
  ([value, label]) => ({ value, label }),
);

const TRIAL_OPTIONS = [
  { value: '100', label: '100 — fastest' },
  { value: '250', label: '250 — balanced' },
  { value: '500', label: '500 — tighter' },
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
  // One step of undo for the two actions that replace many inputs at once.
  // It disappears as soon as the inputs move on from what the action left.
  const [undo, setUndo] = useState<{
    label: string;
    before: ScenarioInput;
    after: string;
    rerun: boolean;
  } | null>(null);
  const canUndo = undo !== null && undo.after === JSON.stringify(scenario);
  // Herd & costs shows one stage's six fields at a time instead of all thirty.
  const [stage, setStage] = useState<PhaseKey>(PHASE_ORDER[0]);

  const resetScenario = () => {
    setUndo({
      label: 'Undo reset',
      before: scenario,
      after: JSON.stringify(cloneDefaultScenario()),
      rerun: true,
    });
    restoreDefaults();
  };

  const changeYear = (year: HistoricalYear) => {
    const next = applyHistoricalYear(scenario, year);
    setUndo({
      label: 'Undo year change',
      before: scenario,
      after: JSON.stringify(next),
      rerun: false,
    });
    setScenario(next);
  };

  const undoLastChange = () => {
    if (!undo) return;
    if (undo.rerun) void runScenario(undo.before).catch(() => undefined);
    else setScenario(undo.before);
    setUndo(null);
  };

  const run = () => {
    void runScenario(scenario).catch(() => undefined);
    // In the single-column layout the results sit below the inputs.
    if (!window.matchMedia('(min-width: 1024px)').matches)
      document
        .getElementById('results')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

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

  /** Edits Prime or Select; Choice takes whatever share is left. */
  const updateGradeShare = (key: 'prime' | 'select', value: number) =>
    setScenario((current) => {
      const gradeMix = { ...current.gradeMix, [key]: value };
      gradeMix.choice = Math.max(
        0,
        Math.round((1 - gradeMix.prime - gradeMix.select) * 10_000) / 10_000,
      );
      return { ...current, gradeMix };
    });

  const updateGradeIndex = (key: 'prime' | 'select', value: number) =>
    setScenario((current) => ({
      ...current,
      gradePriceIndex: { ...current.gradePriceIndex, [key]: value },
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
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="-mr-2 h-9 gap-1.5 px-2.5 text-[0.9375rem] text-muted-foreground hover:text-[var(--ink)]"
              onClick={canUndo ? undoLastChange : resetScenario}
            >
              <Undo2 className="size-3.5" aria-hidden="true" />
              {canUndo ? undo.label : 'Reset'}
            </Button>
            <HelpPopover
              id="reset"
              title="Reset"
              description="Restore default inputs, or undo the last bulk change when available."
            />
          </div>
        </header>

        <div className="scenario-scroll">
          <div className="space-y-5 px-5 pb-5">
            <div className="space-y-2.5">
              <div className="flex items-center gap-1.5">
                <Label htmlFor="assistant-total-head" className="field-label">
                  Calves entering
                  <span className="sr-only">, head</span>
                </Label>
                <HelpPopover
                  id="total-head"
                  title="Calves entering"
                  description="Set how many calves start the supply chain. The slider uses a logarithmic scale."
                />
              </div>
              <UnitInput unit="head">
                <NumericInput
                  id="assistant-total-head"
                  name="totalHead"
                  inputMode="numeric"
                  autoComplete="off"
                  spellCheck={false}
                  format={whole}
                  value={scenario.totalHead}
                  onValueChange={(next) =>
                    updateNumber(
                      'totalHead',
                      Math.min(MAX_HEAD, Math.max(1, Math.round(next))),
                    )
                  }
                  className="bg-card text-lg font-semibold tabular-nums"
                />
              </UnitInput>
              <div className="pt-0.5">
                <Slider
                  aria-label="Calves entering, logarithmic scale"
                  thumbLabel="Calves entering"
                  thumbValueText={`${whole(scenario.totalHead)} head`}
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
                helpText="Choose how many months the model follows the cattle and market."
                value={String(scenario.horizonMonths)}
                options={HORIZON_OPTIONS}
                onChange={(value) =>
                  updateNumber('horizonMonths', Number(value))
                }
              />
              <SelectField
                id="cadence"
                label="When calves enter"
                helpText="Choose whether calves enter evenly, all at once, by season, or using monthly weights."
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

            <div>
              <SelectField
                id="reference-year"
                label="Market year"
                helpText="Load market prices and production assumptions from the selected USDA year."
                value={String(scenario.referenceYear)}
                options={YEAR_OPTIONS}
                onChange={(value) =>
                  changeYear(Number(value) as HistoricalYear)
                }
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                {isEditedFromProfile(scenario)
                  ? `Edited from the ${scenario.referenceYear} USDA profile. Picking a year reloads its prices, grade mix, yields, and stage costs.`
                  : 'Loads that year’s USDA prices, grade mix, yields, and stage costs.'}
              </p>
            </div>

            {scenario.cadence === 'custom' ? (
              <fieldset
                className="phase-group"
                aria-labelledby="monthly-weights"
              >
                <div className="flex items-center gap-1.5">
                  <h4 id="monthly-weights" className="phase-legend">
                    Monthly weights
                  </h4>
                  <HelpPopover
                    id="monthly-weights"
                    title="Monthly weights"
                    description="Set each month's share of calf entries. Larger weights place more calves in that month."
                  />
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {MONTH_LABELS.map((month, index) => (
                    <div key={month}>
                      <Label
                        htmlFor={`cadence-${index}`}
                        className="mb-1 block text-xs text-muted-foreground"
                      >
                        {month}
                      </Label>
                      <NumericInput
                        id={`cadence-${index}`}
                        name={`cadence-${month.toLowerCase()}`}
                        inputMode="decimal"
                        autoComplete="off"
                        spellCheck={false}
                        min={0}
                        step={0.1}
                        value={scenario.customCadence[index]}
                        onValueChange={(next) =>
                          setScenario((current) => ({
                            ...current,
                            customCadence: current.customCadence.map(
                              (weight, itemIndex) =>
                                itemIndex === index
                                  ? Math.max(0, next)
                                  : weight,
                            ),
                          }))
                        }
                        className="bg-card px-2 text-sm tabular-nums"
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
            <Section value="prices">
              <div className="space-y-4">
                <div className="field-grid">
                  <NumberField
                    id="calf-price"
                    label="Weaned calf"
                    helpText="Sale price for calves leaving the cow-calf phase, per hundredweight."
                    unit="$/cwt"
                    value={scenario.calfPricePerCwt}
                    onChange={(value) => updateNumber('calfPricePerCwt', value)}
                  />
                  <NumberField
                    id="feeder-price"
                    label="Feeder cattle"
                    helpText="Purchase or transfer price for feeder cattle, per hundredweight."
                    unit="$/cwt"
                    value={scenario.feederPricePerCwt}
                    onChange={(value) =>
                      updateNumber('feederPricePerCwt', value)
                    }
                  />
                  <NumberField
                    id="fed-price"
                    label="Fed cattle"
                    helpText="Sale price for finished cattle, per hundredweight."
                    unit="$/cwt"
                    value={scenario.fedPricePerCwt}
                    onChange={(value) => updateNumber('fedPricePerCwt', value)}
                  />
                  <NumberField
                    id="wholesale-price"
                    label="Wholesale beef (Choice)"
                    helpText="Wholesale beef price for Choice-grade carcasses, per pound."
                    unit="$/lb"
                    step={0.01}
                    value={scenario.wholesalePricePerLb}
                    onChange={(value) =>
                      updateNumber('wholesalePricePerLb', value)
                    }
                  />
                  <NumberField
                    id="retail-price"
                    label="Retail beef (Choice)"
                    helpText="Retail beef price for Choice-grade cuts, per pound."
                    unit="$/lb"
                    step={0.01}
                    value={scenario.retailPricePerLb}
                    onChange={(value) =>
                      updateNumber('retailPricePerLb', value)
                    }
                  />
                  <NumberField
                    id="feed-cost"
                    label="Feed"
                    helpText="Feed price per ton of dry matter."
                    unit="$/ton"
                    value={scenario.feedCostPerTon}
                    onChange={(value) => updateNumber('feedCostPerTon', value)}
                  />
                  <NumberField
                    id="byproduct-credit"
                    label="Byproduct"
                    helpText="Additional packer revenue credited per head from byproducts."
                    unit="$/head"
                    value={scenario.byproductCreditPerHead}
                    onChange={(value) =>
                      updateNumber('byproductCreditPerHead', value)
                    }
                  />
                </div>
                <fieldset
                  className="phase-group"
                  aria-labelledby="grade-mix-heading"
                >
                  <h4 id="grade-mix-heading" className="phase-legend">
                    Carcass grade mix
                  </h4>
                  <div className="field-grid">
                    <PercentField
                      id="grade-prime-share"
                      label="Prime share"
                      helpText="Share of cattle grading Prime. Choice receives the remaining share after Prime and Select."
                      value={scenario.gradeMix.prime}
                      max={round((1 - scenario.gradeMix.select) * 100, 2)}
                      onChange={(value) => updateGradeShare('prime', value)}
                    />
                    <PercentField
                      id="grade-select-share"
                      label="Select share"
                      helpText="Share of cattle grading Select. Choice receives the remaining share after Prime and Select."
                      value={scenario.gradeMix.select}
                      max={round((1 - scenario.gradeMix.prime) * 100, 2)}
                      onChange={(value) => updateGradeShare('select', value)}
                    />
                    <PercentField
                      id="grade-prime-premium"
                      label="Prime premium"
                      helpText="Price premium for Prime relative to the Choice price."
                      value={round(scenario.gradePriceIndex.prime - 1, 4)}
                      max={400}
                      onChange={(value) => updateGradeIndex('prime', 1 + value)}
                    />
                    <PercentField
                      id="grade-select-discount"
                      label="Select discount"
                      helpText="Price discount for Select relative to the Choice price."
                      value={round(1 - scenario.gradePriceIndex.select, 4)}
                      max={99}
                      onChange={(value) =>
                        updateGradeIndex('select', 1 - value)
                      }
                    />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Choice gets the remaining{' '}
                    {(scenario.gradeMix.choice * 100).toFixed(1)}%. The premium
                    and discount are relative to the Choice price, at wholesale
                    and retail.
                  </p>
                </fieldset>
              </div>
            </Section>

            <Section value="biology">
              <div className="space-y-4">
                <div className="field-grid">
                  <NumberField
                    id="start-weight"
                    label="Start weight"
                    helpText="Average calf weight when it enters the model."
                    unit="lb"
                    value={scenario.startWeight}
                    onChange={(value) => updateNumber('startWeight', value)}
                  />
                  <PercentField
                    id="biological-variation"
                    label="Animal variation"
                    helpText="Spread in animal performance around the average; higher values widen outcomes."
                    value={scenario.biologicalVariation}
                    onChange={(value) =>
                      updateNumber('biologicalVariation', value)
                    }
                  />
                </div>
                <Tabs
                  value={stage}
                  onValueChange={(value) => setStage(value as PhaseKey)}
                  className="gap-4"
                >
                  <TabsList
                    aria-label="Stage"
                    activateOnFocus
                    className="stage-tabs"
                  >
                    {PHASE_ORDER.map((phase) => (
                      <TabsTrigger key={phase} value={phase}>
                        {scenario.phases[phase].label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  <HelpPopover
                    id="stage-selector"
                    title="Production stage"
                    description="Choose a stage to edit its duration, weight gain, mortality, and costs."
                  />
                  {PHASE_ORDER.map((phase) => (
                    <TabsContent key={phase} value={phase}>
                      <div className="field-grid">
                        <NumberField
                          id={`${phase}-days`}
                          label="Days"
                          helpText="Number of days cattle spend in this production stage."
                          value={scenario.phases[phase].durationDays}
                          onChange={(value) =>
                            updatePhase(phase, 'durationDays', value)
                          }
                        />
                        <NumberField
                          id={`${phase}-gain`}
                          label="Daily gain"
                          helpText="Average live-weight gain per animal per day in this stage."
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
                          helpText="Share of animals expected to die during this stage."
                          value={scenario.phases[phase].mortalityRate}
                          onChange={(value) =>
                            updatePhase(phase, 'mortalityRate', value)
                          }
                        />
                        <NumberField
                          id={`${phase}-direct-cost`}
                          label="Direct cost"
                          helpText="One-time operating cost per head for this stage."
                          unit="$/head"
                          value={scenario.phases[phase].directCostPerHead}
                          onChange={(value) =>
                            updatePhase(phase, 'directCostPerHead', value)
                          }
                        />
                        <NumberField
                          id={`${phase}-daily-cost`}
                          label="Daily cost"
                          helpText="Operating cost per head for each day in this stage."
                          unit="$/head"
                          step={0.01}
                          value={scenario.phases[phase].dailyCostPerHead}
                          onChange={(value) =>
                            updatePhase(phase, 'dailyCostPerHead', value)
                          }
                        />
                        <NumberField
                          id={`${phase}-economic-cost`}
                          label="Overhead & land"
                          helpText="Other costs allocated per head, excluding daily and direct costs."
                          unit="$/head"
                          value={scenario.phases[phase].economicCostPerHead}
                          onChange={(value) =>
                            updatePhase(phase, 'economicCostPerHead', value)
                          }
                        />
                      </div>
                    </TabsContent>
                  ))}
                </Tabs>
              </div>
            </Section>

            <Section value="yield">
              <div className="field-grid">
                <PercentField
                  id="dressing"
                  label="Dressing yield"
                  helpText="Carcass weight as a share of live weight at slaughter."
                  value={scenario.dressingPercentage}
                  onChange={(value) =>
                    updateNumber('dressingPercentage', value)
                  }
                />
                <PercentField
                  id="saleable-yield"
                  label="Saleable yield"
                  helpText="Saleable beef as a share of carcass weight."
                  value={scenario.saleableYield}
                  onChange={(value) => updateNumber('saleableYield', value)}
                />
                <NumberField
                  id="feed-intake"
                  label="Feed intake"
                  helpText="Average dry-matter feed consumed per animal each day."
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
                  helpText="Annual change applied to cattle prices over the selected time period."
                  value={scenario.annualCattlePriceTrend}
                  max={50}
                  onChange={(value) =>
                    updateNumber('annualCattlePriceTrend', value)
                  }
                />
                <PercentField
                  id="wholesale-trend"
                  label="Wholesale price trend"
                  helpText="Annual change applied to wholesale beef prices over time."
                  value={scenario.annualWholesalePriceTrend}
                  max={50}
                  onChange={(value) =>
                    updateNumber('annualWholesalePriceTrend', value)
                  }
                />
                <PercentField
                  id="retail-trend"
                  label="Retail price trend"
                  helpText="Annual change applied to retail beef prices over time."
                  value={scenario.annualRetailPriceTrend}
                  max={50}
                  onChange={(value) =>
                    updateNumber('annualRetailPriceTrend', value)
                  }
                />
                <PercentField
                  id="feed-trend"
                  label="Feed cost trend"
                  helpText="Annual change applied to feed costs over time."
                  value={scenario.annualFeedCostTrend}
                  max={50}
                  onChange={(value) =>
                    updateNumber('annualFeedCostTrend', value)
                  }
                />
              </div>
            </Section>

            <Section value="risk">
              <p className="mb-3 text-xs text-muted-foreground">
                How much each price typically moves in a year. Correlation, from
                0 to 1, sets how closely the prices move together.
              </p>
              <div className="field-grid">
                <PercentField
                  id="calf-volatility"
                  label="Calf price swing"
                  helpText="Expected variation in weaned calf prices between simulation runs."
                  value={scenario.marketRisk.calfVolatility}
                  onChange={(value) => updateRisk('calfVolatility', value)}
                />
                <PercentField
                  id="feeder-volatility"
                  label="Feeder price swing"
                  helpText="Expected variation in feeder cattle prices between simulation runs."
                  value={scenario.marketRisk.feederVolatility}
                  onChange={(value) => updateRisk('feederVolatility', value)}
                />
                <PercentField
                  id="fed-volatility"
                  label="Fed price swing"
                  helpText="Expected variation in fed cattle prices between simulation runs."
                  value={scenario.marketRisk.fedVolatility}
                  onChange={(value) => updateRisk('fedVolatility', value)}
                />
                <PercentField
                  id="wholesale-volatility"
                  label="Wholesale price swing"
                  helpText="Expected variation in wholesale beef prices between simulation runs."
                  value={scenario.marketRisk.wholesaleVolatility}
                  onChange={(value) => updateRisk('wholesaleVolatility', value)}
                />
                <PercentField
                  id="retail-volatility"
                  label="Retail price swing"
                  helpText="Expected variation in retail beef prices between simulation runs."
                  value={scenario.marketRisk.retailVolatility}
                  onChange={(value) => updateRisk('retailVolatility', value)}
                />
                <PercentField
                  id="feed-volatility"
                  label="Feed cost swing"
                  helpText="Expected variation in feed costs between simulation runs."
                  value={scenario.marketRisk.feedVolatility}
                  onChange={(value) => updateRisk('feedVolatility', value)}
                />
                <NumberField
                  id="market-correlation"
                  label="Correlation"
                  helpText="How strongly price and feed-cost changes move together. Higher values link their swings more closely."
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

            <Section value="run">
              <div className="field-grid">
                <SelectField
                  id="trials"
                  label="Runs"
                  helpText="Number of simulated outcomes. More runs improve stability but take longer."
                  value={String(scenario.trials)}
                  options={TRIAL_OPTIONS}
                  onChange={(value) => updateNumber('trials', Number(value))}
                />
                <NumberField
                  id="random-seed"
                  label="Random seed"
                  helpText="Sets the random sequence so runs can be repeated with the same inputs."
                  value={scenario.seed}
                  onChange={(value) => updateNumber('seed', Math.round(value))}
                />
              </div>
            </Section>

            <Section value="sources">
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

          <div className="flex items-center gap-2">
            <Button
              className="run-button"
              onClick={run}
              disabled={isRunning}
              data-stale={isStale ? '' : undefined}
            >
              {isRunning ? (
                'Working on it?'
              ) : (
                <>
                  <Play className="size-4 fill-current" aria-hidden="true" />
                  {isStale ? 'Update results' : 'Run simulation'}
                </>
              )}
            </Button>
            <HelpPopover
              id="run-simulation"
              title="Run simulation"
              description="Calculate results from the current inputs, or refresh stale results."
            />
          </div>
        </footer>
      </div>
    </aside>
  );
}

function Section({
  value,
  children,
}: {
  value: ScenarioSection;
  children: React.ReactNode;
}) {
  return (
    <AccordionItem
      id={`scenario-section-${value}`}
      value={value}
      className="border-b border-[var(--line)] px-5"
    >
      <AccordionTrigger className="section-trigger">
        {SCENARIO_SECTION_LABELS[value]}
      </AccordionTrigger>
      <AccordionContent className="pb-4">{children}</AccordionContent>
    </AccordionItem>
  );
}

function round(value: number, places: number) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}
