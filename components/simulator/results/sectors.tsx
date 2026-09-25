import { PHASE_META, PHASE_ORDER } from '@/components/simulator/results/phases';
import { compactCurrency, percent } from '@/lib/model/format';
import type { SimulationSummary } from '@/lib/model/types';

export function Sectors({ result }: { result: SimulationSummary }) {
  const rows = PHASE_ORDER.map((key) => {
    const phase = result.phases[key];
    return { key, phase, value: phase.economicProfit };
  }).sort((a, b) => b.value - a.value);

  const maxProfit = Math.max(...rows.map((row) => Math.abs(row.value)), 1);

  return (
    <section className="panel card-panel" aria-labelledby="sectors-heading">
      <div className="panel-header">
        <h2 id="sectors-heading" className="panel-title">
          Profit by stage
        </h2>
        <p className="panel-subtitle">Who in the chain makes or loses money</p>
      </div>

      <div className="sector-summary">
        {rows.map(({ key, phase, value }) => (
          <div
            key={key}
            className="sector-summary-row"
            title={`${phase.label}: ${compactCurrency(value)} · ${percent(phase.probabilityOfLoss)} chance of a loss`}
          >
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
        <div className="sector-summary-row sector-summary-total">
          <span className="sector-summary-label">Whole chain</span>
          <span className="detail">Sum of the five stages</span>
          <span
            className={`sector-summary-value ${
              result.chainEconomicProfit < 0
                ? 'text-[var(--negative)]'
                : 'text-[var(--ink)]'
            }`}
          >
            {compactCurrency(result.chainEconomicProfit)}
          </span>
        </div>
      </div>
    </section>
  );
}
