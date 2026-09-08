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
import { RangeBar, domainAcross } from '@/components/simulator/results/range-bar';
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

  return (
    <section className="panel" aria-labelledby="sectors-heading">
      <div className="panel-header">
        <h2 id="sectors-heading" className="panel-title">
          Profit by sector
        </h2>
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
            {PHASE_ORDER.map((key) => {
              const phase = result.phases[key];
              return (
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
                      phase.probabilityOfLoss > 0.5 ? 'text-[var(--negative)]' : ''
                    }`}
                  >
                    {percent(phase.probabilityOfLoss)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <p className="panel-note">Vertical line marks break-even.</p>
    </section>
  );
}
