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
