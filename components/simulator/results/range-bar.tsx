import { compactCurrency } from '@/lib/model/format';

export type Domain = readonly [number, number];

/**
 * Builds a domain that always includes zero, so every bar drawn against it
 * shows how far an outcome sits from break-even.
 */
export function domainAcross(values: number[]): Domain {
  let min = 0;
  let max = 0;
  for (const value of values) {
    if (!Number.isFinite(value)) continue;
    if (value < min) min = value;
    if (value > max) max = value;
  }
  if (min === max) return [-1, 1];
  const padding = (max - min) * 0.04;
  return [min - padding, max + padding];
}

export function position(value: number, [min, max]: Domain) {
  return ((value - min) / (max - min)) * 100;
}

/**
 * P10–P90 band with a median marker, drawn against a shared domain so bars in
 * a column are directly comparable.
 */
export function RangeBar({
  low,
  high,
  median,
  domain,
  color,
  label,
}: {
  low: number;
  high: number;
  median: number;
  domain: Domain;
  color: string;
  label: string;
}) {
  const start = position(Math.min(low, high), domain);
  const end = position(Math.max(low, high), domain);
  const zero = position(0, domain);
  const center = position(median, domain);

  return (
    <div className="range-bar">
      <span className="sr-only">
        {`${label}: low end ${compactCurrency(low)}, typical ${compactCurrency(median)}, high end ${compactCurrency(high)}.`}
      </span>
      <span
        className="range-zero"
        style={{ left: `${zero}%` }}
        aria-hidden="true"
      />
      <span
        className="range-band"
        style={{
          left: `${start}%`,
          width: `${Math.max(end - start, 0.75)}%`,
          background: color,
        }}
        aria-hidden="true"
      />
      <span
        className="range-median"
        style={{ left: `${center}%` }}
        aria-hidden="true"
      />
    </div>
  );
}

/**
 * Labels for a RangeBar, anchored at the same positions as the marks they
 * describe. Break-even is dropped when it would collide with a percentile.
 */
export function RangeScale({
  low,
  high,
  domain,
}: {
  low: number;
  high: number;
  domain: Domain;
}) {
  const lowAt = position(low, domain);
  const highAt = position(high, domain);
  const zeroAt = position(0, domain);
  const showZero =
    Math.abs(zeroAt - lowAt) > 9 && Math.abs(zeroAt - highAt) > 9;

  return (
    <div className="range-scale">
      <ScaleMark at={lowAt} title="Low end" value={compactCurrency(low)} />
      {showZero ? <ScaleMark at={zeroAt} title="Break-even" value="$0" muted /> : null}
      <ScaleMark at={highAt} title="High end" value={compactCurrency(high)} />
    </div>
  );
}

function ScaleMark({
  at,
  title,
  value,
  muted = false,
}: {
  at: number;
  title: string;
  value: string;
  muted?: boolean;
}) {
  // Anchor centred marks on their value, but pin the outermost ones inside the
  // track so they cannot bleed past its edges.
  const anchor = at <= 6 ? 0 : at >= 94 ? -100 : -50;
  return (
    <span
      className="range-scale-mark"
      data-muted={muted ? '' : undefined}
      style={{
        left: `${Math.min(Math.max(at, 0), 100)}%`,
        transform: `translateX(${anchor}%)`,
        textAlign: anchor === 0 ? 'left' : anchor === -100 ? 'right' : 'center',
      }}
    >
      <span className="range-scale-key">{title}</span>
      {value}
    </span>
  );
}
