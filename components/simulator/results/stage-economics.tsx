'use client';

import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartContainer, type ChartConfig } from '@/components/ui/chart';
import { PHASE_META, PHASE_ORDER } from '@/components/simulator/results/phases';
import { compactCurrency, currency } from '@/lib/model/format';
import type {
  PhaseKey,
  PhaseResult,
  SimulationSummary,
} from '@/lib/model/types';

const STAGE_STORY: Record<
  PhaseKey,
  { source: string; work: string; output: string }
> = {
  cowCalf: {
    source: 'Calf sales and the value of cattle still being raised',
    work: 'Breeding herd, grazing, health, and calf care',
    output: 'Weaned calves',
  },
  stocker: {
    source: 'Feeder cattle sales and remaining inventory value',
    work: 'Purchased calves, forage, health, and weight gain',
    output: 'Feeder cattle',
  },
  feedlot: {
    source: 'Fed cattle sales and remaining inventory value',
    work: 'Purchased feeders, feed ration, yardage, and health',
    output: 'Finished cattle',
  },
  packer: {
    source: 'Wholesale beef sales plus byproduct credits',
    work: 'Purchased fed cattle, processing, and plant overhead',
    output: 'Wholesale beef',
  },
  retail: {
    source: 'Beef sold at retail',
    work: 'Purchased wholesale beef, merchandising, and store overhead',
    output: 'Retail beef',
  },
};

const sensitivityConfig = {
  profit: { label: 'Profit per head', color: '#500000' },
} satisfies ChartConfig;

type BridgeRow = {
  label: string;
  value: number;
  kind: 'income' | 'cost' | 'profit';
};

function perHead(value: number, phase: PhaseResult) {
  const result = value / Math.max(phase.enteredHead, 1);
  return Math.abs(result) < 0.5 ? 0 : result;
}

export function StageEconomics({ result }: { result: SimulationSummary }) {
  const [selectedKey, setSelectedKey] = useState<PhaseKey>('cowCalf');
  const phase = result.phases[selectedKey];
  const story = STAGE_STORY[selectedKey];

  const bridge = useMemo<BridgeRow[]>(
    () => [
      {
        label: 'Money in',
        value: perHead(phase.revenue + phase.terminalInventoryValue, phase),
        kind: 'income',
      },
      {
        label: 'Cattle purchased',
        value: perHead(-phase.acquisitionCost, phase),
        kind: 'cost',
      },
      {
        label: 'Operating expenses',
        value: perHead(-phase.directCosts, phase),
        kind: 'cost',
      },
      {
        label: 'Overhead and land',
        value: perHead(-phase.economicCosts, phase),
        kind: 'cost',
      },
      {
        label: 'Total profit',
        value: perHead(phase.economicProfit, phase),
        kind: 'profit',
      },
    ],
    [phase],
  );

  const maxBridgeValue = Math.max(
    ...bridge.map((row) => Math.abs(row.value)),
    1,
  );
  const controllableCosts = phase.directCosts + phase.economicCosts;
  const sensitivity = [-20, -10, 0, 10, 20].map((change) => ({
    change,
    profit: perHead(
      phase.economicProfit - controllableCosts * (change / 100),
      phase,
    ),
  }));
  const expenseTotal = Math.max(
    phase.acquisitionCost + phase.directCosts + phase.economicCosts,
    1,
  );
  const expenseMix = [
    {
      label: 'Cattle purchased',
      value: phase.acquisitionCost,
      color: '#746d66',
    },
    {
      label: 'Operating',
      value: phase.directCosts,
      color: PHASE_META[selectedKey].color,
    },
    {
      label: 'Overhead',
      value: phase.economicCosts,
      color: '#c9b59a',
    },
  ];

  return (
    <section
      className="stage-economics"
      aria-labelledby="stage-economics-heading"
    >
      <div className="stage-economics-head">
        <div>
          <h3 id="stage-economics-heading">Follow the money</h3>
          <p>Choose a stage to see what creates revenue and what absorbs it.</p>
        </div>
        <div className="stage-picker" aria-label="Beef chain stage">
          {PHASE_ORDER.map((key) => (
            <button
              key={key}
              type="button"
              data-active={selectedKey === key}
              aria-pressed={selectedKey === key}
              onClick={() => setSelectedKey(key)}
            >
              {PHASE_META[key].label}
            </button>
          ))}
        </div>
      </div>

      <div className="stage-story" aria-live="polite">
        <div>
          <span className="label">Money comes from</span>
          <strong>{story.source}</strong>
        </div>
        <div>
          <span className="label">What this stage pays for</span>
          <strong>{story.work}</strong>
        </div>
        <div>
          <span className="label">What moves forward</span>
          <strong>{story.output}</strong>
        </div>
      </div>

      <div className="stage-visual-grid">
        <div className="stage-visual">
          <div className="stage-visual-heading">
            <div>
              <h4>Profit bridge</h4>
              <p>Average dollars per animal entering this stage</p>
            </div>
          </div>
          <div className="profit-bridge">
            {bridge.map((row) => (
              <div key={row.label} className="profit-bridge-row">
                <span>{row.label}</span>
                <div className="profit-bridge-track" aria-hidden="true">
                  <span
                    data-kind={row.kind}
                    data-negative={row.value < 0}
                    style={{
                      width: `${(Math.abs(row.value) / maxBridgeValue) * 50}%`,
                    }}
                  />
                </div>
                <strong
                  className={
                    row.kind === 'profit' && row.value < 0 ? 'negative' : ''
                  }
                >
                  {currency(row.value)}
                </strong>
              </div>
            ))}
          </div>

          <div className="expense-mix">
            <div className="expense-mix-head">
              <span className="label">Where every cost dollar goes</span>
              <span className="detail">
                {compactCurrency(expenseTotal)} total
              </span>
            </div>
            <div
              className="expense-mix-bar"
              aria-label={expenseMix
                .map(
                  (item) =>
                    `${item.label}: ${Math.round((item.value / expenseTotal) * 100)}%`,
                )
                .join('; ')}
            >
              {expenseMix.map((item) => (
                <span
                  key={item.label}
                  style={{
                    width: `${(item.value / expenseTotal) * 100}%`,
                    background: item.color,
                  }}
                />
              ))}
            </div>
            <ul className="expense-mix-key">
              {expenseMix.map((item) => (
                <li key={item.label}>
                  <span style={{ background: item.color }} aria-hidden="true" />
                  {item.label}
                  <strong>
                    {Math.round((item.value / expenseTotal) * 100)}%
                  </strong>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="stage-visual">
          <div className="stage-visual-heading">
            <div>
              <h4>Cost pressure</h4>
              <p>Profit if operating and overhead costs move together</p>
            </div>
          </div>
          <ChartContainer
            config={sensitivityConfig}
            className="cost-pressure-chart aspect-auto h-[270px] w-full"
          >
            <LineChart
              data={sensitivity}
              margin={{ left: 4, right: 18, top: 18, bottom: 4 }}
            >
              <CartesianGrid
                vertical={false}
                stroke="var(--line)"
                strokeDasharray="4 4"
              />
              <XAxis
                dataKey="change"
                tickLine={false}
                axisLine={false}
                tickMargin={10}
                tickFormatter={(value) =>
                  `${Number(value) > 0 ? '+' : ''}${value}%`
                }
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={60}
                tickFormatter={(value) => compactCurrency(value)}
              />
              <ReferenceLine
                x={0}
                stroke="var(--muted-foreground)"
                strokeDasharray="4 4"
              />
              <ReferenceLine
                y={0}
                stroke="var(--negative)"
                strokeOpacity={0.45}
              />
              <Tooltip
                cursor={{
                  stroke: 'var(--muted-foreground)',
                  strokeOpacity: 0.3,
                }}
                formatter={(value) => [
                  currency(Number(value)),
                  'Profit per head',
                ]}
                labelFormatter={(value) =>
                  `${Number(value) > 0 ? '+' : ''}${value}% expenses`
                }
              />
              <Line
                type="monotone"
                dataKey="profit"
                stroke="var(--color-profit)"
                strokeWidth={3}
                dot={{ r: 4, fill: 'var(--color-profit)', strokeWidth: 0 }}
                activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ChartContainer>
          <div className="cost-pressure-summary">
            <span>
              Costs −10%
              <strong>{currency(sensitivity[1].profit)}</strong>
            </span>
            <span>
              Current
              <strong>{currency(sensitivity[2].profit)}</strong>
            </span>
            <span>
              Costs +10%
              <strong>{currency(sensitivity[3].profit)}</strong>
            </span>
          </div>
          <p className="stage-visual-note">
            Holds revenue and cattle purchase price constant to isolate this
            stage’s operating and overhead costs.
          </p>
        </div>
      </div>
    </section>
  );
}
