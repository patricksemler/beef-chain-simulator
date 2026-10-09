/**
 * # Sectors
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
 * - `Sectors`: the main thing this file provides to the app.
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
import { useMemo } from 'react';
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
  domainAcross,
} from '@/components/simulator/results/range-bar';
import { compactCurrency, currency, percent } from '@/lib/model/format';
import type { SimulationSummary } from '@/lib/model/types';

export function Sectors({ result }: { result: SimulationSummary }) {
  const domain = useMemo(
    () =>
      domainAcross(
        PHASE_ORDER.flatMap((key) => [
          result.phases[key].p10EconomicProfit,
          result.phases[key].p90EconomicProfit,
        ]),
      ),
    [result],
  );

  const rows = PHASE_ORDER.map((key) => {
    const phase = result.phases[key];
    return { key, phase, value: phase.economicProfit };
  }).sort((a, b) => b.value - a.value);

  const maxProfit = Math.max(...rows.map((row) => Math.abs(row.value)), 1);

  return (
    <section className="panel" aria-labelledby="sectors-heading">
      <div className="panel-header">
        <h2 id="sectors-heading" className="panel-title">
          Profit by sector
        </h2>
      </div>

      <div className="sector-summary">
        {rows.map(({ key, phase, value }) => (
          <div key={key} className="sector-summary-row">
            <div className="sector-summary-label">
              <span
                className="sector-summary-dot"
                style={{ background: PHASE_META[key].color }}
                aria-hidden="true"
              />
              <span>{phase.label}</span>
            </div>
            <div className="sector-summary-bar" aria-hidden="true">
              <span
                className="sector-summary-fill"
                style={{
                  left: value >= 0 ? '50%' : undefined,
                  right: value < 0 ? '50%' : undefined,
                  width: `${(Math.abs(value) / maxProfit) * 50}%`,
                  background:
                    value < 0 ? 'var(--negative)' : PHASE_META[key].color,
                }}
              />
            </div>
            <span
              className={`sector-summary-value ${
                value < 0 ? 'text-[var(--negative)]' : 'text-[var(--ink)]'
              }`}
            >
              {compactCurrency(value)}
            </span>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="min-w-36">Sector</TableHead>
              <TableHead className="text-right">Profit</TableHead>
              <TableHead className="text-right">Per head</TableHead>
              <TableHead className="text-right">Margin</TableHead>
              <TableHead className="min-w-48">Range of outcomes</TableHead>
              <TableHead className="text-right">Chance of a loss</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(({ key, phase }) => (
              <TableRow key={key}>
                <TableCell>
                  <span className="flex items-center gap-2.5 font-medium text-[var(--ink)]">
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ background: PHASE_META[key].color }}
                      aria-hidden="true"
                    />
                    {phase.label}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <span
                    className={`font-semibold tabular-nums ${
                      phase.economicProfit < 0
                        ? 'text-[var(--negative)]'
                        : 'text-[var(--ink)]'
                    }`}
                  >
                    {compactCurrency(phase.economicProfit)}
                  </span>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {currency(phase.economicProfitPerStartedHead)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {percent(phase.margin)}
                </TableCell>
                <TableCell>
                  <RangeBar
                    low={phase.p10EconomicProfit}
                    high={phase.p90EconomicProfit}
                    median={phase.economicProfit}
                    domain={domain}
                    color={PHASE_META[key].color}
                    label={phase.label}
                  />
                </TableCell>
                <TableCell
                  className={`text-right tabular-nums ${
                    phase.probabilityOfLoss > 0.5
                      ? 'text-[var(--negative)]'
                      : ''
                  }`}
                >
                  {percent(phase.probabilityOfLoss)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="panel-note">
        Summary bars extend right for profit and left for loss; outcome ranges
        mark break-even with a vertical line.
      </p>
    </section>
  );
}
