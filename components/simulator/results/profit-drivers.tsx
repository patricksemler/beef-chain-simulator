import { compactCurrency } from '@/lib/model/format';
import type { SimulationSummary } from '@/lib/model/types';

const LOWER_COLOR = '#b38b5d';
const HIGHER_COLOR = '#4f6a8a';

function signedCompact(value: number) {
  return `${value > 0 ? '+' : ''}${compactCurrency(value)}`;
}

/**
 * Tornado chart of the engine's ±10% one-at-a-time runs. Each bar grows out
 * from the no-change case, so the longest bars are the inputs worth watching.
 */
export function ProfitDrivers({ result }: { result: SimulationSummary }) {
  const base = result.sensitivityBase;
  const rows = result.sensitivity.map((driver) => ({
    ...driver,
    lower: driver.lowEconomicProfit - base,
    higher: driver.highEconomicProfit - base,
  }));
  const reach = Math.max(
    ...rows.flatMap((row) => [Math.abs(row.lower), Math.abs(row.higher)]),
    1,
  );

  return (
    <section className="panel card-panel" aria-labelledby="drivers-heading">
      <div className="panel-header">
        <h2 id="drivers-heading" className="panel-title">
          What moves profit most
        </h2>
        <p className="panel-subtitle">
          Change in total profit if one input moves 10%
        </p>
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
                  title={`${row.label} ${bar.name}: ${signedCompact(bar.value)}`}
                  style={{
                    background: bar.color,
                    width: `${(Math.abs(bar.value) / reach) * 50}%`,
                    left: bar.value >= 0 ? '50%' : undefined,
                    right: bar.value < 0 ? '50%' : undefined,
                  }}
                />
              ))}
            </figure>
            <span className="driver-value">
              ±{compactCurrency(Math.abs(row.swing))}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
