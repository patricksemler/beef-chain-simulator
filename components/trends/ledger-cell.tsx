import {
  FIRST_YEAR,
  formatChange,
  formatValue,
  LAST_YEAR,
  SERIES,
  SERIES_SUMMARY,
  SPARK_HEIGHT,
  SPARK_WIDTH,
  type SeriesKey,
} from '@/lib/trends/series';

/**
 * One column of the chain ledger: the stage, what it sells, the latest annual
 * price, and the decade behind it. Presentational only, so the landing page
 * can render it statically and the trends page can wrap it in a control.
 */
export function LedgerCell({ series }: { series: SeriesKey }) {
  const meta = SERIES[series];
  const summary = SERIES_SUMMARY[series];
  const direction = summary.decadeChange < 0 ? 'down' : 'up';

  return (
    <>
      <span className="ledger-stage">{meta.stage}</span>
      <span className="ledger-product">{meta.product}</span>
      <span className="ledger-price">
        {formatValue(series, summary.latest)}
        <span className="ledger-unit">{meta.unit}</span>
      </span>
      <svg
        className="ledger-spark"
        viewBox={`0 0 ${SPARK_WIDTH} ${SPARK_HEIGHT}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path d={summary.sparkline} stroke={meta.color} />
      </svg>
      <span className="ledger-change" data-direction={direction}>
        {formatChange(summary.decadeChange)}
        <span className="ledger-change-span">
          {FIRST_YEAR}–{LAST_YEAR}
        </span>
      </span>
    </>
  );
}
