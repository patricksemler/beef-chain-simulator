/**
 * # Headline
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
 * - `Headline`: the main thing this file provides to the app.
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
import { RangeBar, RangeScale, domainAcross } from '@/components/simulator/results/range-bar';
import { compactCurrency, compactNumber, percent, whole } from '@/lib/model/format';
import type { SimulationSummary } from '@/lib/model/types';

export function Headline({ result }: { result: SimulationSummary }) {
  const profit = result.chainEconomicProfit;
  const domain = domainAcross([result.chainP10, result.chainP90, profit]);
  const completedShare = result.completedHead / Math.max(result.totalStartedHead, 1);

  return (
    <section className="headline" aria-labelledby="headline-heading">
      <div className="headline-main">
        <h2 id="headline-heading" className="label">
          Total profit
        </h2>

        <p
          className={`headline-value ${profit < 0 ? 'text-[var(--negative)]' : 'text-[var(--ink)]'}`}
        >
          {compactCurrency(profit)}
        </p>

        <div className="mt-5">
          <RangeBar
            low={result.chainP10}
            high={result.chainP90}
            median={profit}
            domain={domain}
            color="var(--accent-strong)"
            label="Total profit"
          />
          <RangeScale low={result.chainP10} high={result.chainP90} domain={domain} />
        </div>
      </div>

      <dl className="headline-stats">
        <Stat
          label="Cash profit"
          value={compactCurrency(result.chainOperatingContribution)}
          detail="Before overhead"
          negative={result.chainOperatingContribution < 0}
        />
        <Stat
          label="Cattle finished"
          value={whole(result.completedHead)}
          detail={`${percent(completedShare)} of calves`}
        />
        <Stat
          label="Beef produced"
          value={`${compactNumber(result.retailPounds)} lb`}
          detail="At retail"
        />
        <Stat
          label="Chance of a loss"
          value={percent(result.chainProbabilityOfLoss)}
          detail={`Across ${whole(result.scenario.trials)} runs`}
          negative={result.chainProbabilityOfLoss > 0.25}
        />
      </dl>
    </section>
  );
}

function Stat({
  label,
  value,
  detail,
  negative = false,
}: {
  label: string;
  value: string;
  detail: string;
  negative?: boolean;
}) {
  return (
    <div className="headline-stat">
      <dt className="label">{label}</dt>
      <dd
        className={`headline-stat-value ${
          negative ? 'text-[var(--negative)]' : 'text-[var(--ink)]'
        }`}
      >
        {value}
      </dd>
      <p className="detail">{detail}</p>
    </div>
  );
}
