'use client';

import { useMemo } from 'react';
import { GradeBreakdown } from '@/components/simulator/results/grade-breakdown';
import { PHASE_META } from '@/lib/model/phases';
import { compactCurrency, currency, percent } from '@/lib/model/format';
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
    source: 'Calf sales + inventory',
    work: 'Breeding herd, grazing, care',
    output: 'Weaned calves',
  },
  stocker: {
    source: 'Feeder sales + inventory',
    work: 'Calves, forage, and health',
    output: 'Feeder cattle',
  },
  feedlot: {
    source: 'Fed cattle sales + inventory',
    work: 'Feeders, feed, and yardage',
    output: 'Finished cattle',
  },
  packer: {
    source: 'Wholesale beef + byproducts',
    work: 'Fed cattle and processing',
    output: 'Wholesale beef',
  },
  retail: {
    source: 'Retail beef sales',
    work: 'Wholesale beef and store costs',
    output: 'Retail beef',
  },
};

type BridgeRow = {
  label: string;
  value: number;
  kind: 'income' | 'cost' | 'profit';
};

function perHead(value: number, phase: PhaseResult) {
  const result = value / Math.max(phase.enteredHead, 1);
  return Math.abs(result) < 0.5 ? 0 : result;
}

export function StageEconomics({
  result,
  selectedKey,
}: {
  result: SimulationSummary;
  selectedKey: PhaseKey;
}) {
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

  // Waterfall: money in rises from zero, each cost steps down from the running
  // total, and profit is drawn from zero so it lines up with where costs end.
  const steps = bridge.map((row, index) => {
    const start =
      row.kind === 'cost'
        ? bridge.slice(0, index).reduce((sum, earlier) => sum + earlier.value, 0)
        : 0;
    return { ...row, start, end: start + row.value };
  });
  const lowest = Math.min(0, ...steps.flatMap((step) => [step.start, step.end]));
  const highest = Math.max(
    ...steps.flatMap((step) => [step.start, step.end]),
    lowest + 1,
  );
  const at = (value: number) =>
    ((value - lowest) / (highest - lowest)) * 100;
  const controllableCosts = phase.directCosts + phase.economicCosts;
  const sensitivity = [-10, 0, 10].map((change) => ({
    change,
    profit: perHead(
      phase.economicProfit - controllableCosts * (change / 100),
      phase,
    ),
  }));
  const cushion =
    controllableCosts > 0 ? phase.economicProfit / controllableCosts : null;
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
    <div className="stage-economics">
      <div className="stage-story" aria-live="polite">
        <div>
          <span className="label">Money comes from</span>
          <strong>{story.source}</strong>
        </div>
        <div>
          <span className="label">This stage pays for</span>
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
              <p>Typical dollars per animal entering this stage</p>
            </div>
          </div>
          <div className="profit-bridge">
            {steps.map((row) => (
              <div key={row.label} className="profit-bridge-row">
                <span>{row.label}</span>
                <div
                  className="profit-bridge-track"
                  style={{ '--zero': `${at(0)}%` } as React.CSSProperties}
                  aria-hidden="true"
                >
                  <span
                    data-kind={row.kind}
                    data-negative={row.value < 0}
                    style={{
                      left: `${at(Math.min(row.start, row.end))}%`,
                      width: `${Math.abs(at(row.end) - at(row.start))}%`,
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
          {cushion !== null ? (
            <p className="cost-pressure-headline">
              {cushion >= 0 ? (
                <>
                  Costs could rise <strong>{percent(cushion)}</strong> before
                  this stage loses money.
                </>
              ) : -cushion < 1 ? (
                <>
                  Costs would need to fall <strong>{percent(-cushion)}</strong>{' '}
                  for this stage to break even.
                </>
              ) : (
                <>Cutting these costs alone cannot make this stage break even.</>
              )}
            </p>
          ) : null}
          <div className="cost-pressure-summary">
            <span>
              Costs −10%
              <strong>{currency(sensitivity[0].profit)}</strong>
            </span>
            <span>
              Current
              <strong>{currency(sensitivity[1].profit)}</strong>
            </span>
            <span>
              Costs +10%
              <strong>{currency(sensitivity[2].profit)}</strong>
            </span>
          </div>
          <p className="stage-visual-note">
            Holds revenue and cattle purchase price constant to isolate this
            stage’s operating and overhead costs.
          </p>
        </div>
      </div>

      {selectedKey === 'retail' ? <GradeBreakdown result={result} /> : null}
    </div>
  );
}
