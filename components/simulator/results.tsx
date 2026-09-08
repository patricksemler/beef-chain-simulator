'use client';

import { ArrowRight, CheckCircle2 } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { PhaseKey, SimulationSummary } from '@/lib/model/types';

const PHASE_ORDER: PhaseKey[] = ['cowCalf', 'stocker', 'feedlot', 'downstream'];
const PHASE_STYLES: Record<PhaseKey, { accent: string; shortLabel: string }> = {
  cowCalf: { accent: '#688a9a', shortLabel: 'Cow-calf' },
  stocker: { accent: '#78927b', shortLabel: 'Stocker' },
  feedlot: { accent: '#b68670', shortLabel: 'Feedlot' },
  downstream: { accent: '#ad9656', shortLabel: 'Packer / retail' },
};
const compactCurrency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 1,
});
const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});
const whole = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const percent = new Intl.NumberFormat('en-US', {
  style: 'percent',
  maximumFractionDigits: 1,
});
const chartConfig = {
  cowCalf: { label: 'Cow-calf', color: '#688a9a' },
  stocker: { label: 'Stocker', color: '#78927b' },
  feedlot: { label: 'Feedlot', color: '#b68670' },
  downstream: { label: 'Packer / retail', color: '#ad9656' },
  swing: { label: 'Profit sensitivity', color: '#426e68' },
  revenue: { label: 'Revenue', color: '#688a9a' },
  costs: { label: 'Total costs', color: '#b68670' },
  profit: { label: 'Economic profit', color: '#426e68' },
} satisfies ChartConfig;

export function ResultsDashboard({
  result,
  baseline,
  trials,
}: {
  result: SimulationSummary | null;
  baseline: SimulationSummary | null;
  trials: number;
}) {
  const completedRate = result
    ? result.completedHead / result.totalStartedHead
    : 0;
  const totalCosts = result
    ? PHASE_ORDER.reduce(
        (sum, key) =>
          sum +
          result.phases[key].directCosts +
          result.phases[key].economicCosts,
        0,
      )
    : 0;
  const cumulative =
    result?.monthly.reduce<Array<Record<string, number>>>((rows, month) => {
      const previous = rows.at(-1) ?? {
        cowCalf: 0,
        stocker: 0,
        feedlot: 0,
        downstream: 0,
      };
      rows.push({
        month: month.month,
        cowCalf: previous.cowCalf + month.cowCalf,
        stocker: previous.stocker + month.stocker,
        feedlot: previous.feedlot + month.feedlot,
        downstream: previous.downstream + month.downstream,
      });
      return rows;
    }, []) ?? [];
  const ledger = result
    ? PHASE_ORDER.map((key) => ({
        name: result.phases[key].label,
        revenue:
          result.phases[key].revenue +
          result.phases[key].terminalInventoryValue,
        costs:
          result.phases[key].acquisitionCost +
          result.phases[key].directCosts +
          result.phases[key].economicCosts,
        profit: result.phases[key].economicProfit,
      }))
    : [];

  return (
    <section className="min-w-0 space-y-5" aria-labelledby="results-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2
            id="results-heading"
            className="font-heading text-xl font-semibold tracking-[-0.025em] text-[var(--ink)]"
          >
            Scenario results
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Median outcome with the current assumptions.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <CheckCircle2
            className="h-3.5 w-3.5 text-[var(--positive)]"
            aria-hidden="true"
          />
          {trials} seeded trials
        </span>
      </div>

      <div className="surface grid overflow-hidden sm:grid-cols-2 xl:grid-cols-4">
        <PrimaryMetric
          label="Economic profit"
          value={
            result ? compactCurrency.format(result.chainEconomicProfit) : '—'
          }
          detail={
            baseline && result
              ? `${formatSigned(result.chainEconomicProfit - baseline.chainEconomicProfit)} vs. baseline`
              : 'After all modeled costs'
          }
          tone={
            result && result.chainEconomicProfit < 0 ? 'negative' : 'positive'
          }
        />
        <PrimaryMetric
          label="Operating contribution"
          value={
            result
              ? compactCurrency.format(result.chainOperatingContribution)
              : '—'
          }
          detail="Before ownership and overhead"
        />
        <PrimaryMetric
          label="Completed cattle"
          value={result ? whole.format(result.completedHead) : '—'}
          detail={
            result
              ? `${percent.format(completedRate)} of calves entering`
              : 'Through the full chain'
          }
        />
        <PrimaryMetric
          label="Probability of loss"
          value={result ? percent.format(result.chainProbabilityOfLoss) : '—'}
          detail={
            result
              ? `${compactCurrency.format(result.chainP10)} to ${compactCurrency.format(result.chainP90)}`
              : 'P10 to P90 range'
          }
          tone={
            result && result.chainProbabilityOfLoss > 0.5
              ? 'negative'
              : 'neutral'
          }
        />
      </div>

      <section
        className="surface overflow-hidden"
        aria-labelledby="sector-heading"
      >
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--line)] px-5 py-4">
          <div>
            <h3
              id="sector-heading"
              className="font-heading text-base font-semibold text-[var(--ink)]"
            >
              Sector economics
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              How value and risk are distributed across the chain.
            </p>
          </div>
          <span className="text-xs text-muted-foreground">
            All values are median unless noted
          </span>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-[var(--soft-bg)] hover:bg-[var(--soft-bg)]">
                <TableHead>Sector</TableHead>
                <TableHead className="text-right">Economic profit</TableHead>
                <TableHead className="text-right">Operating</TableHead>
                <TableHead className="text-right">Per head</TableHead>
                <TableHead className="text-right">Margin</TableHead>
                <TableHead className="text-right">P10–P90</TableHead>
                <TableHead className="text-right">Loss risk</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {PHASE_ORDER.map((key) => {
                const phase = result?.phases[key];
                const delta =
                  phase && baseline
                    ? phase.economicProfit - baseline.phases[key].economicProfit
                    : null;
                return (
                  <TableRow key={key}>
                    <TableCell className="min-w-40">
                      <span className="flex items-center gap-2.5 font-medium text-[var(--ink)]">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ background: PHASE_STYLES[key].accent }}
                          aria-hidden="true"
                        />
                        {phase?.label ?? PHASE_STYLES[key].shortLabel}
                      </span>
                      {delta !== null && (
                        <span
                          className={`ml-[18px] mt-0.5 block text-xs ${delta >= 0 ? 'text-[var(--positive)]' : 'text-[var(--negative)]'}`}
                        >
                          {formatSigned(delta)} vs. baseline
                        </span>
                      )}
                    </TableCell>
                    <MoneyCell value={phase?.economicProfit} emphasize />
                    <MoneyCell value={phase?.operatingContribution} />
                    <MoneyCell
                      value={phase?.economicProfitPerStartedHead}
                      full
                    />
                    <TableCell className="text-right tabular-nums">
                      {phase ? percent.format(phase.margin) : '—'}
                    </TableCell>
                    <TableCell className="min-w-40 text-right text-xs tabular-nums text-muted-foreground">
                      {phase
                        ? `${compactCurrency.format(phase.p10EconomicProfit)} – ${compactCurrency.format(phase.p90EconomicProfit)}`
                        : '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {phase ? percent.format(phase.probabilityOfLoss) : '—'}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </section>

      <section
        className="surface overflow-hidden"
        aria-labelledby="flow-heading"
      >
        <div className="border-b border-[var(--line)] px-5 py-4">
          <h3
            id="flow-heading"
            className="font-heading text-base font-semibold text-[var(--ink)]"
          >
            Cattle flow
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Head exiting each phase and average exit weight.
          </p>
        </div>
        <div className="grid gap-0 p-5 md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] md:items-center">
          {PHASE_ORDER.map((key, index) => (
            <div className="contents" key={key}>
              <FlowNode phaseKey={key} result={result} />
              {index < PHASE_ORDER.length - 1 && (
                <ArrowRight
                  className="mx-auto hidden h-4 w-4 text-muted-foreground/60 md:block"
                  aria-hidden="true"
                />
              )}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 border-t border-[var(--line)] bg-[var(--soft-bg)] sm:grid-cols-3 xl:grid-cols-6">
          <DetailMetric
            label="Mortality"
            value={result ? whole.format(result.mortalityHead) : '—'}
          />
          <DetailMetric
            label="Ending inventory"
            value={result ? whole.format(result.endingInventoryHead) : '—'}
          />
          <DetailMetric
            label="Retail pounds"
            value={result ? compactNumber(result.retailPounds) : '—'}
          />
          <DetailMetric
            label="Modeled costs"
            value={result ? compactCurrency.format(totalCosts) : '—'}
          />
          <DetailMetric
            label="Break-even fed"
            value={
              result ? `$${result.breakEvenFedPricePerCwt.toFixed(2)}/cwt` : '—'
            }
          />
          <DetailMetric
            label="Break-even retail"
            value={
              result
                ? `$${result.breakEvenRetailPricePerLb.toFixed(2)}/lb`
                : '—'
            }
          />
        </div>
      </section>

      <section
        className="surface overflow-hidden"
        aria-labelledby="analysis-heading"
      >
        <div className="border-b border-[var(--line)] px-5 py-4">
          <h3
            id="analysis-heading"
            className="font-heading text-base font-semibold text-[var(--ink)]"
          >
            Analysis
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Explore timing, sensitivity, and the sector ledger.
          </p>
        </div>
        <div className="p-5">
          <Tabs defaultValue="trend">
            <TabsList
              variant="line"
              className="mb-5 h-9 w-full justify-start gap-5 overflow-x-auto border-b border-[var(--line)] p-0"
            >
              <TabsTrigger value="trend" className="flex-none px-0">
                Profit over time
              </TabsTrigger>
              <TabsTrigger value="sensitivity" className="flex-none px-0">
                Sensitivity
              </TabsTrigger>
              <TabsTrigger value="ledger" className="flex-none px-0">
                Sector ledger
              </TabsTrigger>
            </TabsList>
            <TabsContent value="trend">
              <ChartContainer
                config={chartConfig}
                className="h-[310px] w-full aspect-auto"
              >
                <LineChart
                  data={cumulative}
                  margin={{ left: 8, right: 18, top: 12, bottom: 4 }}
                >
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="month"
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `M${value}`}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => compactCurrency.format(value)}
                    width={70}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value, name) => (
                          <div className="flex min-w-36 justify-between gap-4">
                            <span>
                              {
                                chartConfig[name as keyof typeof chartConfig]
                                  ?.label
                              }
                            </span>
                            <strong>
                              {compactCurrency.format(Number(value))}
                            </strong>
                          </div>
                        )}
                      />
                    }
                  />
                  <ReferenceLine y={0} stroke="#9aa5ad" />
                  <Line
                    type="monotone"
                    dataKey="cowCalf"
                    stroke="var(--color-cowCalf)"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="stocker"
                    stroke="var(--color-stocker)"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="feedlot"
                    stroke="var(--color-feedlot)"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="downstream"
                    stroke="var(--color-downstream)"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ChartContainer>
              <ChartKey />
            </TabsContent>
            <TabsContent value="sensitivity">
              <p className="mb-3 text-sm text-muted-foreground">
                Median chain profit response to a ±10% change in each driver.
              </p>
              <ChartContainer
                config={chartConfig}
                className="h-[310px] w-full aspect-auto"
              >
                <BarChart
                  data={result?.sensitivity ?? []}
                  layout="vertical"
                  margin={{ left: 24, right: 24 }}
                >
                  <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                  <XAxis
                    type="number"
                    tickFormatter={(value) => compactCurrency.format(value)}
                  />
                  <YAxis
                    dataKey="label"
                    type="category"
                    width={110}
                    tickLine={false}
                    axisLine={false}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value) => (
                          <strong>
                            {compactCurrency.format(Number(value))}
                          </strong>
                        )}
                      />
                    }
                  />
                  <Bar
                    dataKey="swing"
                    fill="var(--color-swing)"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ChartContainer>
            </TabsContent>
            <TabsContent value="ledger">
              <ChartContainer
                config={chartConfig}
                className="h-[280px] w-full aspect-auto"
              >
                <BarChart
                  data={ledger}
                  margin={{ left: 8, right: 18, top: 12 }}
                >
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} />
                  <YAxis
                    tickFormatter={(value) => compactCurrency.format(value)}
                    width={70}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value, name) => (
                          <div className="flex min-w-32 justify-between gap-4">
                            <span>
                              {
                                chartConfig[name as keyof typeof chartConfig]
                                  ?.label
                              }
                            </span>
                            <strong>
                              {compactCurrency.format(Number(value))}
                            </strong>
                          </div>
                        )}
                      />
                    }
                  />
                  <Bar
                    dataKey="revenue"
                    fill="var(--color-revenue)"
                    radius={[3, 3, 0, 0]}
                  />
                  <Bar
                    dataKey="costs"
                    fill="var(--color-costs)"
                    radius={[3, 3, 0, 0]}
                  />
                  <Bar
                    dataKey="profit"
                    fill="var(--color-profit)"
                    radius={[3, 3, 0, 0]}
                  />
                </BarChart>
              </ChartContainer>
              <div className="mt-5 overflow-x-auto border-t border-[var(--line)]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sector</TableHead>
                      <TableHead className="text-right">
                        Revenue + inventory
                      </TableHead>
                      <TableHead className="text-right">Total costs</TableHead>
                      <TableHead className="text-right">
                        Economic profit
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ledger.map((row) => (
                      <TableRow key={row.name}>
                        <TableCell className="font-medium">
                          {row.name}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {currency.format(row.revenue)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {currency.format(row.costs)}
                        </TableCell>
                        <TableCell
                          className={`text-right font-semibold tabular-nums ${row.profit >= 0 ? 'text-[var(--positive)]' : 'text-[var(--negative)]'}`}
                        >
                          {currency.format(row.profit)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-2 px-1 pb-4 text-xs leading-5 text-muted-foreground">
        <span>Planning scenario, not a USDA forecast or financial advice.</span>
        <span>
          {result && Math.abs(result.reconciliationDifference) < 0.01
            ? 'Flow reconciliation balanced'
            : 'Flow reconciliation needs review'}
          {result ? ` · ${Math.round(result.runtimeMs)} ms` : ''}
        </span>
      </div>
    </section>
  );
}

function PrimaryMetric({
  label,
  value,
  detail,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  detail: string;
  tone?: 'positive' | 'negative' | 'neutral';
}) {
  const color =
    tone === 'positive'
      ? 'text-[var(--positive)]'
      : tone === 'negative'
        ? 'text-[var(--negative)]'
        : 'text-[var(--ink)]';
  return (
    <div className="border-b border-[var(--line)] p-5 last:border-b-0 sm:border-r sm:odd:border-r sm:[&:nth-child(n+3)]:border-b-0 sm:[&:nth-child(2)]:border-r-0 xl:border-b-0 xl:[&:nth-child(2)]:border-r xl:last:border-r-0">
      <p className="section-label">{label}</p>
      <p
        className={`mt-2 font-heading text-2xl font-semibold tracking-[-0.035em] tabular-nums ${color}`}
      >
        {value}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function MoneyCell({
  value,
  emphasize = false,
  full = false,
}: {
  value?: number;
  emphasize?: boolean;
  full?: boolean;
}) {
  const tone =
    value !== undefined && value < 0
      ? 'text-[var(--negative)]'
      : emphasize
        ? 'text-[var(--positive)]'
        : 'text-[var(--ink)]';
  return (
    <TableCell
      className={`text-right tabular-nums ${emphasize ? 'font-semibold' : ''} ${tone}`}
    >
      {value === undefined
        ? '—'
        : full
          ? currency.format(value)
          : compactCurrency.format(value)}
    </TableCell>
  );
}

function FlowNode({
  phaseKey,
  result,
}: {
  phaseKey: PhaseKey;
  result: SimulationSummary | null;
}) {
  const phase = result?.phases[phaseKey];
  return (
    <div
      className="border-l-2 py-2 pl-3"
      style={{ borderColor: PHASE_STYLES[phaseKey].accent }}
    >
      <p className="text-sm font-medium text-[var(--ink)]">
        {phase?.label ?? PHASE_STYLES[phaseKey].shortLabel}
      </p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-[var(--ink)]">
        {phase ? whole.format(phase.exitedHead) : '—'}
      </p>
      <p className="text-xs text-muted-foreground">
        {phase
          ? `${whole.format(phase.averageExitWeight)} lb average`
          : 'Head exited'}
      </p>
    </div>
  );
}

function DetailMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-r border-[var(--line)] px-4 py-3 last:border-r-0 sm:border-b-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold tabular-nums text-[var(--ink)]">
        {value}
      </p>
    </div>
  );
}

function ChartKey() {
  return (
    <div className="mt-3 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
      {PHASE_ORDER.map((key) => (
        <span key={key} className="flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: PHASE_STYLES[key].accent }}
            aria-hidden="true"
          />
          {chartConfig[key].label}
        </span>
      ))}
    </div>
  );
}

function compactNumber(value: number) {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

function formatSigned(value: number) {
  return `${value >= 0 ? '+' : '−'}${compactCurrency.format(Math.abs(value))}`;
}
