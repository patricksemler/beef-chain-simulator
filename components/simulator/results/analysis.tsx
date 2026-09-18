'use client';

import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ReferenceLine,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartContainer, type ChartConfig } from '@/components/ui/chart';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PHASE_ORDER } from '@/components/simulator/results/phases';
import { StageEconomics } from '@/components/simulator/results/stage-economics';
import { compactCurrency, currency } from '@/lib/model/format';
import type { SimulationSummary } from '@/lib/model/types';

const chartConfig = {
  revenue: { label: 'Money in', color: '#6d7a8d' },
  costs: { label: 'Money out', color: '#c9b59a' },
  profit: { label: 'Total profit', color: '#500000' },
} satisfies ChartConfig;

/** Recharts orders its own legend by series internals, so the key is explicit. */
const SERIES = ['revenue', 'costs', 'profit'] as const;

/** Recharts hands label formatters a loose renderable value. */
function formatBarLabel(value: unknown) {
  return typeof value === 'number' || typeof value === 'string'
    ? compactCurrency(Number(value))
    : '';
}

const LEDGER_KEY = SERIES.map((key) => ({
  label: chartConfig[key].label,
  color: chartConfig[key].color,
}));

export function Analysis({ result }: { result: SimulationSummary }) {
  const ledger = useMemo(
    () =>
      PHASE_ORDER.map((key) => {
        const phase = result.phases[key];
        return {
          name: phase.label,
          revenue: phase.revenue + phase.terminalInventoryValue,
          costs:
            phase.acquisitionCost + phase.directCosts + phase.economicCosts,
          operating: phase.operatingContribution,
          profit: phase.economicProfit,
        };
      }),
    [result],
  );

  return (
    <section className="panel" aria-labelledby="analysis-heading">
      <div className="panel-header">
        <h2 id="analysis-heading" className="panel-title">
          Details
        </h2>
      </div>

      <div className="px-5 pt-5">
        <div className="chart-heading">
          <span className="label">Where value is created</span>
          <span className="detail">
            Revenue, costs, and net contribution by sector
          </span>
        </div>
        <ChartContainer
          config={chartConfig}
          className="analysis-chart aspect-auto h-[320px] w-full"
        >
          <BarChart
            data={ledger}
            margin={{ left: 8, right: 20, top: 20, bottom: 6 }}
            barCategoryGap="20%"
          >
            <CartesianGrid
              vertical={false}
              stroke="var(--line)"
              strokeDasharray="4 4"
            />
            <XAxis
              dataKey="name"
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              fontSize={12}
              interval={0}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={64}
              tickFormatter={(value) => compactCurrency(value)}
            />
            <ReferenceLine
              y={0}
              stroke="var(--muted-foreground)"
              strokeOpacity={0.5}
              strokeDasharray="4 4"
            />
            <Bar
              dataKey="revenue"
              fill="var(--color-revenue)"
              radius={[5, 5, 0, 0]}
              maxBarSize={26}
              fillOpacity={0.92}
              stroke="rgba(255,255,255,0.8)"
              strokeWidth={1}
              isAnimationActive={false}
            >
              <LabelList
                dataKey="revenue"
                position="top"
                offset={6}
                className="bar-label"
                formatter={formatBarLabel}
              />
            </Bar>
            <Bar
              dataKey="costs"
              fill="var(--color-costs)"
              radius={[5, 5, 0, 0]}
              maxBarSize={26}
              fillOpacity={0.9}
              stroke="rgba(255,255,255,0.7)"
              strokeWidth={1}
              isAnimationActive={false}
            >
              <LabelList
                dataKey="costs"
                position="top"
                offset={6}
                className="bar-label"
                formatter={formatBarLabel}
              />
            </Bar>
            <Bar
              dataKey="profit"
              fill="var(--color-profit)"
              radius={[5, 5, 0, 0]}
              maxBarSize={26}
              fillOpacity={0.94}
              stroke="rgba(255,255,255,0.75)"
              strokeWidth={1}
              isAnimationActive={false}
            >
              <LabelList
                dataKey="profit"
                position="top"
                offset={6}
                className="bar-label"
                formatter={formatBarLabel}
              />
            </Bar>
          </BarChart>
        </ChartContainer>
        <ChartKey entries={LEDGER_KEY} />
      </div>

      <div className="mt-5 overflow-x-auto border-t border-[var(--line)]">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Sector</TableHead>
              <TableHead className="text-right">Money in</TableHead>
              <TableHead className="text-right">Money out</TableHead>
              <TableHead className="text-right">Cash profit</TableHead>
              <TableHead className="text-right">Total profit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ledger.map((row) => (
              <TableRow key={row.name}>
                <TableCell className="font-medium">{row.name}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {currency(row.revenue)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {currency(row.costs)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {currency(row.operating)}
                </TableCell>
                <TableCell
                  className={`text-right font-semibold tabular-nums ${
                    row.profit >= 0
                      ? 'text-[var(--positive)]'
                      : 'text-[var(--negative)]'
                  }`}
                >
                  {currency(row.profit)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <StageEconomics result={result} />
    </section>
  );
}

function ChartKey({
  entries,
}: {
  entries: { label: string; color: string }[];
}) {
  return (
    <ul className="chart-key">
      {entries.map((entry) => (
        <li key={entry.label}>
          <span
            className="chart-key-swatch"
            style={{ background: entry.color }}
            aria-hidden="true"
          />
          {entry.label}
        </li>
      ))}
    </ul>
  );
}
