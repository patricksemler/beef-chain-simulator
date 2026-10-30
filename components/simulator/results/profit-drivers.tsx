'use client';

import { useState } from 'react';
import { SelectField } from '@/components/simulator/fields';
import { compactCurrency } from '@/lib/model/format';
import { PHASE_META, PHASE_ORDER } from '@/lib/model/phases';
import type { PhaseKey, SimulationSummary } from '@/lib/model/types';

const LOWER_COLOR = '#b38b5d';
const HIGHER_COLOR = '#4f6a8a';

type Scope = 'chain' | PhaseKey;

const SCOPE_OPTIONS = [
  { value: 'chain', label: 'Whole chain' },
  ...PHASE_ORDER.map((key) => ({ value: key, label: PHASE_META[key].label })),
];

function signedCompact(value: number) {
  return `${value > 0 ? '+' : ''}${compactCurrency(value)}`;
}

/**
 * Horizontal swing chart of whole-chain or one stage's profit when one driver
 * moves ±10%.
 */
export function ProfitDrivers({ result }: { result: SimulationSummary }) {
  const [scope, setScope] = useState<Scope>('chain');
  const base =
    scope === 'chain'
      ? result.sensitivityBase
      : result.sensitivityBasePhases[scope];
  const allRows = result.sensitivity
    .map((driver) => {
      const low =
        scope === 'chain'
          ? driver.lowEconomicProfit
          : driver.lowPhaseProfit[scope];
      const high =
        scope === 'chain'
          ? driver.highEconomicProfit
          : driver.highPhaseProfit[scope];
      return {
        key: driver.key,
        label: driver.label,
        lower: low - base,
        higher: high - base,
      };
    })
    .sort(
      (a, b) =>
        Math.abs(b.higher - b.lower) - Math.abs(a.higher - a.lower),
    );
  // Rows that move profit by less than 0.1% of the largest effect would draw
  // as empty tracks; they are listed in the note instead.
  const largest = Math.max(
    ...allRows.flatMap((row) => [Math.abs(row.lower), Math.abs(row.higher)]),
    1,
  );
  const isFlat = (row: (typeof allRows)[number]) =>
    Math.max(Math.abs(row.lower), Math.abs(row.higher)) < largest * 0.001;
  const rows = allRows.filter((row) => !isFlat(row));
  const flat = allRows.filter(isFlat);

  return (
    <section className="panel card-panel" aria-labelledby="drivers-heading">
      <div className="panel-header drivers-header">
        <div>
          <h2 id="drivers-heading" className="panel-title">
            What moves profit most
          </h2>
          <p className="panel-subtitle">
            Change in profit if one input moves 10%, all else unchanged
          </p>
        </div>
        <SelectField
          id="drivers-scope"
          label="Profit for"
          value={scope}
          options={SCOPE_OPTIONS}
          onChange={(value) => setScope(value as Scope)}
        />
      </div>

      <div className="driver-chart">
        <ul className="driver-key" aria-hidden="true">
          <li>
            <span style={{ background: LOWER_COLOR }} />
            Input 10% lower
          </li>
          <li>
            <span style={{ background: HIGHER_COLOR }} />
            Input 10% higher
          </li>
        </ul>
        {rows.map((row) => (
          <div key={row.key} className="driver-row">
            <span className="driver-label">{row.label}</span>
            <figure
              className="driver-track"
              aria-label={`${row.label}: 10% lower changes profit by ${signedCompact(row.lower)}; 10% higher by ${signedCompact(row.higher)}.`}
            >
              {[
                { value: row.lower, color: LOWER_COLOR, name: '10% lower' },
                { value: row.higher, color: HIGHER_COLOR, name: '10% higher' },
              ].map((bar) => (
                <span
                  key={bar.name}
                  className="driver-bar"
                  data-side={bar.value >= 0 ? 'up' : 'down'}
                  style={{
                    background: bar.color,
                    width: `${(Math.abs(bar.value) / largest) * 50}%`,
                    left: bar.value >= 0 ? '50%' : undefined,
                    right: bar.value < 0 ? '50%' : undefined,
                  }}
                />
              ))}
            </figure>
            <span className="driver-value" aria-hidden="true">
              {signedCompact(row.lower)}
              <small> / </small>
              {signedCompact(row.higher)}
            </span>
          </div>
        ))}
      </div>
      {flat.length > 0 ? (
        <p className="panel-note">
          No effect {scope === 'chain' ? 'on the whole chain' : 'on this stage'}
          : {flat.map((row) => row.label.toLowerCase()).join(', ')}.
          {scope === 'chain'
            ? ' Prices paid between stages are one stage’s cost and the next one’s revenue, so they cancel out across the chain. Pick a stage to see them.'
            : ''}
        </p>
      ) : null}
    </section>
  );
}
