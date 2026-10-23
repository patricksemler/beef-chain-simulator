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
import { PHASE_META, PHASE_ORDER } from '@/lib/model/phases';
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
