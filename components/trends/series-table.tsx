import {
  ALL_SERIES,
  formatValue,
  ROWS,
  SERIES,
  type SeriesKey,
} from '@/lib/trends/series';

type SeriesTableProps = {
  selected: SeriesKey;
  /** Inclusive year window; rows outside it are shown but set back. */
  from: number;
  through: number;
};

/**
 * The whole dataset, as a market report would print it. The selected series
 * and year window are picked out so the table reads with the chart above it.
 */
export function SeriesTable({ selected, from, through }: SeriesTableProps) {
  return (
    <div className="series-table-wrap">
      <table className="series-table">
        <caption className="series-table-caption">
          Annual averages by year
        </caption>
        <thead>
          <tr>
            <th scope="col">Year</th>
            {ALL_SERIES.map((key) => (
              <th
                key={key}
                scope="col"
                data-selected={key === selected ? '' : undefined}
              >
                {SERIES[key].product}
                <span className="series-table-unit">{SERIES[key].unit}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row) => (
            <tr
              key={row.year}
              data-outside={
                row.year < from || row.year > through ? '' : undefined
              }
            >
              <th scope="row">{row.year}</th>
              {ALL_SERIES.map((key) => (
                <td key={key} data-selected={key === selected ? '' : undefined}>
                  {formatValue(key, row[key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
