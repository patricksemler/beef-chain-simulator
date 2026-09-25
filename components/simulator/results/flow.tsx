import { PHASE_META, PHASE_ORDER } from '@/components/simulator/results/phases';
import { percent, whole } from '@/lib/model/format';
import type { SimulationSummary } from '@/lib/model/types';

const MONTH_DAYS = 30.4375;
const STILL_HERE_COLOR = 'var(--chart-context)';

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
      color: STILL_HERE_COLOR,
    },
    {
      label: 'Mortality',
      value: result.mortalityHead,
      color: 'var(--negative)',
    },
  ];
  const journeyDays = PHASE_ORDER.reduce(
    (sum, key) => sum + result.scenario.phases[key].durationDays,
    0,
  );
  const beefPerAnimal =
    result.completedHead > 0 ? result.retailPounds / result.completedHead : 0;

  return (
    <>
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
              .map(
                ({ label, value }) => `${label}: ${percent(value / entered)}`,
              )
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
          <StatItem
            label="Calf to retail"
            value={`${whole(journeyDays)} days`}
          />
          <StatItem
            label="Finished weight"
            value={`${whole(result.phases.feedlot.averageExitWeight)} lb`}
          />
          <StatItem
            label="Beef per animal sold"
            value={`${whole(beefPerAnimal)} lb`}
          />
          <StatItem label="Died" value={whole(result.mortalityHead)} />
        </dl>
      </section>

      <StageOutcomes result={result} />
      <JourneyTimeline result={result} journeyDays={journeyDays} />
    </>
  );
}

/**
 * One bar per stage, each as long as the share of calves that reached it, so
 * the rows narrow like a funnel and the segments say why.
 */
function StageOutcomes({ result }: { result: SimulationSummary }) {
  const total = Math.max(result.totalStartedHead, 1);
  const lastKey = PHASE_ORDER[PHASE_ORDER.length - 1];

  return (
    <section className="panel card-panel" aria-labelledby="outcomes-heading">
      <div className="panel-header">
        <h2 id="outcomes-heading" className="panel-title">
          What happened at each stage
        </h2>
        <p className="panel-subtitle">
          Bar length is the share of all calves that reached the stage
        </p>
      </div>

      <div className="outcome-chart">
        <ul className="driver-key" aria-hidden="true">
          <li>
            <span
              style={{
                background: `linear-gradient(90deg, ${PHASE_ORDER.map((key) => PHASE_META[key].color).join(', ')})`,
              }}
            />
            Moved on or sold
          </li>
          <li>
            <span style={{ background: STILL_HERE_COLOR }} />
            Still here when the period ends
          </li>
          <li>
            <span style={{ background: 'var(--negative)' }} />
            Died
          </li>
        </ul>
        {PHASE_ORDER.map((key) => {
          const phase = result.phases[key];
          const segments = [
            {
              name: key === lastKey ? 'Sold' : 'Moved on',
              value: phase.exitedHead,
              color: PHASE_META[key].color,
            },
            {
              name: 'Still here',
              value: phase.endingInventoryHead,
              color: STILL_HERE_COLOR,
            },
            {
              name: 'Died',
              value: phase.mortalityHead,
              color: 'var(--negative)',
            },
          ];
          const summary = segments
            .map((segment) => `${segment.name} ${whole(segment.value)}`)
            .join(', ');
          return (
            <div key={key} className="outcome-row">
              <span className="driver-label">{phase.label}</span>
              <figure
                className="outcome-track"
                aria-label={`${phase.label}: ${whole(phase.enteredHead)} entered. ${summary}.`}
              >
                {segments.map((segment) =>
                  segment.value > 0 ? (
                    <span
                      key={segment.name}
                      title={`${segment.name}: ${whole(segment.value)} (${percent(segment.value / Math.max(phase.enteredHead, 1))} of this stage)`}
                      style={{
                        width: `${(segment.value / total) * 100}%`,
                        background: segment.color,
                      }}
                    />
                  ) : null,
                )}
              </figure>
              <span className="driver-value">
                {whole(phase.enteredHead)}
                <small> in</small>
              </span>
            </div>
          );
        })}
      </div>
      <p className="panel-note">
        Hover a segment for exact head counts. Cattle still in a stage when the
        period ends are counted at their current value, not sold.
      </p>
    </section>
  );
}

/**
 * Lays one animal's calf-to-retail path against the time period, which is
 * what decides how many calves can finish before it ends.
 */
function JourneyTimeline({
  result,
  journeyDays,
}: {
  result: SimulationSummary;
  journeyDays: number;
}) {
  const horizon = result.scenario.horizonMonths;
  const journeyMonths = journeyDays / MONTH_DAYS;
  const span = Math.max(horizon, journeyMonths);
  const at = (months: number) => `${(months / span) * 100}%`;
  const lastEntry = Math.max(horizon - journeyMonths, 0);
  const lastEntryMonth = Math.floor(lastEntry);
  const tickStep = span > 36 ? 12 : span > 12 ? 6 : 3;
  const ticks = Array.from(
    { length: Math.floor(span / tickStep) + 1 },
    (_, index) => index * tickStep,
  );
  const segments = PHASE_ORDER.map((key, index) => ({
    key,
    start:
      PHASE_ORDER.slice(0, index).reduce(
        (sum, earlier) => sum + result.scenario.phases[earlier].durationDays,
        0,
      ) / MONTH_DAYS,
    months: result.scenario.phases[key].durationDays / MONTH_DAYS,
  }));

  return (
    <section className="panel card-panel" aria-labelledby="journey-heading">
      <div className="panel-header">
        <h2 id="journey-heading" className="panel-title">
          Calf-to-retail timeline
        </h2>
        <p className="panel-subtitle">
          One animal&rsquo;s journey compared with your {horizon}-month period
        </p>
      </div>

      <div className="journey">
        <div className="journey-row">
          <span className="journey-label">One animal</span>
          <div className="journey-lane">
            {segments.map(({ key, start, months }) => (
              <span
                key={key}
                className="journey-segment"
                title={`${PHASE_META[key].label}: ${whole(result.scenario.phases[key].durationDays)} days`}
                style={{
                  left: at(start),
                  width: at(months),
                  background: PHASE_META[key].color,
                }}
              />
            ))}
            <span className="journey-horizon" style={{ left: at(horizon) }} />
          </div>
        </div>

        <div className="journey-row">
          <span className="journey-label">Entry month</span>
          <div className="journey-lane">
            {lastEntry > 0 ? (
              <span
                className="journey-window is-open"
                style={{ left: 0, width: at(lastEntry) }}
                title="Calves entering here can reach retail"
              />
            ) : null}
            <span
              className="journey-window"
              style={{ left: at(lastEntry), width: at(horizon - lastEntry) }}
              title="Calves entering here are still in the chain at period end"
            />
            <span className="journey-horizon" style={{ left: at(horizon) }} />
          </div>
        </div>

        <div className="journey-row">
          <span />
          <div className="journey-axis" aria-hidden="true">
            {ticks.map((tick) => (
              <span key={tick} style={{ left: at(tick) }}>
                {tick === 0 ? 'Start' : `Mo ${tick}`}
              </span>
            ))}
          </div>
        </div>

        <ul className="journey-key">
          {segments.map(({ key }) => (
            <li key={key}>
              <span style={{ background: PHASE_META[key].color }} />
              {PHASE_META[key].label}
              <strong>
                {whole(result.scenario.phases[key].durationDays)} d
              </strong>
            </li>
          ))}
          <li>
            <span className="journey-key-open" />
            Can finish in time
          </li>
          <li>
            <span className="journey-key-line" />
            Period ends
          </li>
        </ul>
      </div>

      <p className="panel-note">
        {lastEntry > 0 ? (
          <>
            Calf to retail takes about{' '}
            <strong>{journeyMonths.toFixed(1)} months</strong>, so only calves
            entering in roughly the first{' '}
            <strong>
              {lastEntryMonth <= 1 ? 'month' : `${lastEntryMonth} months`}
            </strong>{' '}
            can be sold at retail before the period ends.
          </>
        ) : (
          <>
            Calf to retail takes about{' '}
            <strong>{journeyMonths.toFixed(1)} months</strong>, longer than the{' '}
            {horizon}-month period, so no calves reach retail. Lengthen the time
            period to see finished cattle.
          </>
        )}
      </p>
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
