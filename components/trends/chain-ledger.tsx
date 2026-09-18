import { LedgerCell } from '@/components/trends/ledger-cell';
import { CHAIN_SERIES, LAST_YEAR } from '@/lib/trends/series';

/**
 * The chain, read left to right: each column is a stage and the price it sells
 * at. The list is ordered because cattle really do move through these stages
 * in this order.
 */
export function ChainLedger() {
  return (
    <figure className="ledger">
      <figcaption className="ledger-caption">
        <span>What each stage sells, and for how much</span>
        <span className="ledger-caption-meta">
          {LAST_YEAR} USDA annual averages
        </span>
      </figcaption>
      <ol className="ledger-row" aria-label="Stages of the beef chain">
        {CHAIN_SERIES.map((series) => (
          <li key={series} className="ledger-cell">
            <LedgerCell series={series} />
          </li>
        ))}
      </ol>
    </figure>
  );
}
