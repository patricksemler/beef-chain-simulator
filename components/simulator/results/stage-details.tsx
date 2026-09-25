'use client';

import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PHASE_META, PHASE_ORDER } from '@/components/simulator/results/phases';
import {
  RangeBar,
  RangeScale,
  domainAcross,
} from '@/components/simulator/results/range-bar';
import { StageEconomics } from '@/components/simulator/results/stage-economics';
import { compactCurrency, currency, percent } from '@/lib/model/format';
import type { PhaseKey, SimulationSummary } from '@/lib/model/types';

export function StageDetails({ result }: { result: SimulationSummary }) {
  const [selectedKey, setSelectedKey] = useState<PhaseKey>('cowCalf');
  const phase = result.phases[selectedKey];
  const perAnimal = phase.economicProfit / Math.max(phase.enteredHead, 1);
  const domain = domainAcross([
    phase.p10EconomicProfit,
    phase.p90EconomicProfit,
    phase.economicProfit,
  ]);

  return (
    <section className="panel" aria-labelledby="stage-details-heading">
      <div className="panel-header stage-details-header">
        <div>
          <h2 id="stage-details-heading" className="panel-title">
            Stage details
          </h2>
          <p className="panel-subtitle">
            Pick a stage to see where its money comes from and goes
          </p>
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
              <span
                className="stage-picker-dot"
                style={{ background: PHASE_META[key].color }}
                aria-hidden="true"
              />
              {PHASE_META[key].label}
            </button>
          ))}
        </div>
      </div>

      <div className="stage-snapshot" aria-live="polite">
        <dl className="stage-snapshot-stats">
          <SnapshotStat
            label="Total profit"
            value={compactCurrency(phase.economicProfit)}
            negative={phase.economicProfit < 0}
          />
          <SnapshotStat
            label="Per animal"
            value={currency(perAnimal)}
            detail="entering this stage"
            negative={perAnimal < 0}
          />
          <SnapshotStat label="Margin" value={percent(phase.margin)} />
          <SnapshotStat
            label="Chance of a loss"
            value={percent(phase.probabilityOfLoss)}
            negative={phase.probabilityOfLoss > 0.5}
          />
        </dl>
        <div className="stage-snapshot-range">
          <span className="label">Range of outcomes</span>
          <RangeBar
            low={phase.p10EconomicProfit}
            high={phase.p90EconomicProfit}
            median={phase.economicProfit}
            domain={domain}
            color={PHASE_META[selectedKey].color}
            label={phase.label}
          />
          <RangeScale
            low={phase.p10EconomicProfit}
            high={phase.p90EconomicProfit}
            domain={domain}
          />
        </div>
      </div>

      <StageEconomics result={result} selectedKey={selectedKey} />

      <div className="stage-compare">
        <div className="stage-compare-head">
          <h3>All stages side by side</h3>
          <p>Select a row to open that stage above.</p>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Stage</TableHead>
                <TableHead className="text-right">Money in</TableHead>
                <TableHead className="text-right">Money out</TableHead>
                <TableHead className="text-right">Cash profit</TableHead>
                <TableHead className="text-right">Total profit</TableHead>
                <TableHead className="text-right">Margin</TableHead>
                <TableHead className="text-right">Chance of a loss</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {PHASE_ORDER.map((key) => {
                const row = result.phases[key];
                const moneyIn = row.revenue + row.terminalInventoryValue;
                const moneyOut =
                  row.acquisitionCost + row.directCosts + row.economicCosts;
                return (
                  <TableRow
                    key={key}
                    data-selected={selectedKey === key}
                    className="stage-compare-row"
                    onClick={() => setSelectedKey(key)}
                  >
                    <TableCell>
                      <button
                        type="button"
                        className="stage-compare-name"
                        aria-pressed={selectedKey === key}
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedKey(key);
                        }}
                      >
                        <span
                          className="size-2 shrink-0 rounded-full"
                          style={{ background: PHASE_META[key].color }}
                          aria-hidden="true"
                        />
                        {row.label}
                      </button>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {compactCurrency(moneyIn)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {compactCurrency(moneyOut)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {compactCurrency(row.operatingContribution)}
                    </TableCell>
                    <TableCell
                      className={`text-right font-semibold tabular-nums ${
                        row.economicProfit >= 0
                          ? 'text-[var(--positive)]'
                          : 'text-[var(--negative)]'
                      }`}
                    >
                      {compactCurrency(row.economicProfit)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {percent(row.margin)}
                    </TableCell>
                    <TableCell
                      className={`text-right tabular-nums ${
                        row.probabilityOfLoss > 0.5
                          ? 'text-[var(--negative)]'
                          : ''
                      }`}
                    >
                      {percent(row.probabilityOfLoss)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </section>
  );
}

function SnapshotStat({
  label,
  value,
  detail,
  negative = false,
}: {
  label: string;
  value: string;
  detail?: string;
  negative?: boolean;
}) {
  return (
    <div>
      <dt className="label">{label}</dt>
      <dd
        className={`stage-snapshot-value ${
          negative ? 'text-[var(--negative)]' : 'text-[var(--ink)]'
        }`}
      >
        {value}
      </dd>
      {detail ? <p className="detail">{detail}</p> : null}
    </div>
  );
}
