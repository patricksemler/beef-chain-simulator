import { PHASE_META, PHASE_ORDER } from '@/components/simulator/results/phases';
import { percent, whole } from '@/lib/model/format';
import type { SimulationSummary } from '@/lib/model/types';

export function Flow({ result }: { result: SimulationSummary }) {
  const entered = Math.max(result.totalStartedHead, 1);
  const chainStatus = [
    {
      label: 'Completed',
      value: result.completedHead,
      color: PHASE_META.retail.color,
    },
    {
      label: 'Still in chain',
      value: result.endingInventoryHead,
      color: 'var(--muted-foreground)',
    },
    {
      label: 'Mortality',
      value: result.mortalityHead,
      color: 'var(--negative)',
    },
  ];

  return (
    <section className="panel flow-panel" aria-labelledby="flow-heading">
      <div className="panel-header flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="flow-heading" className="panel-title">
          Cattle flow
        </h2>
        <span className="detail tabular-nums">
          {whole(result.totalStartedHead)} calves in
        </span>
      </div>

      <div className="flow-summary">
        <div className="flow-summary-head">
          <span className="label">Current chain status</span>
          <span className="detail">share of calves started</span>
        </div>
        <figure
          className="flow-summary-bar"
          aria-label={chainStatus
            .map(({ label, value }) => `${label}: ${percent(value / entered)}`)
            .join('; ')}
        >
          {chainStatus.map(({ label, value, color }) => (
            <span
              key={label}
              className="flow-summary-segment"
              style={{
                width: `${(value / entered) * 100}%`,
                background: color,
              }}
              title={`${label}: ${percent(value / entered)}`}
            />
          ))}
        </figure>
        <ul className="flow-summary-key" aria-hidden="true">
          {chainStatus.map(({ label, value, color }) => (
            <li key={label}>
              <span
                className="flow-summary-key-dot"
                style={{ background: color }}
              />
              <span>{label}</span>
              <strong>{percent(value / entered)}</strong>
            </li>
          ))}
        </ul>
      </div>

      <ol className="flow-track">
        {PHASE_ORDER.map((key) => {
          const phase = result.phases[key];
          const share = phase.exitedHead / entered;
          return (
            <li key={key} className="flow-node">
              <p className="label flow-label">{phase.label}</p>
              <p className="flow-value">{whole(phase.exitedHead)}</p>
              <div className="flow-bar">
                <span
                  className="flow-bar-fill"
                  style={{
                    width: `${Math.max(share * 100, 1)}%`,
                    background: PHASE_META[key].color,
                  }}
                />
              </div>
              <p className="detail flow-detail">
                {percent(share)}
                {phase.averageExitWeight > 0
                  ? ` · ${whole(phase.averageExitWeight)} lb`
                  : ''}
              </p>
            </li>
          );
        })}
      </ol>

      <dl className="stat-strip">
        <StatItem label="Died" value={whole(result.mortalityHead)} />
        <StatItem
          label="Still being raised"
          value={whole(result.endingInventoryHead)}
        />
        <StatItem
          label="Break-even cattle price"
          value={`$${result.breakEvenFedPricePerCwt.toFixed(2)}/cwt`}
        />
        <StatItem
          label="Break-even beef price"
          value={`$${result.breakEvenRetailPricePerLb.toFixed(2)}/lb`}
        />
      </dl>
    </section>
  );
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-item">
      <dt className="label">{label}</dt>
      <dd className="stat-item-value">{value}</dd>
    </div>
  );
}
