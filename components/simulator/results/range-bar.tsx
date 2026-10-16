/**
 * # Range Bar
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
 * - `domainAcross`: the main thing this file provides to the app.
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
 * describe. The center line is the zero-profit threshold, not a market price.
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
      <ScaleMark at={lowAt} title="P10" value={compactCurrency(low)} />
      {showZero ? (
        <ScaleMark at={zeroAt} title="Break-even" value="$0" muted />
      ) : null}
      <ScaleMark at={highAt} title="P90" value={compactCurrency(high)} />
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
