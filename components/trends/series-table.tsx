'use client';

import { useState, type CSSProperties } from 'react';
import {
  ALL_SERIES,
  formatChange,
  formatValue,
  ROWS,
  SERIES,
  yearOverYear,
  type SeriesKey,
} from '@/lib/trends/series';

/** A yearly swing this large or larger gets the full tint. */
const HEAT_CLAMP = 30;

type TableView = 'price' | 'change';

type SeriesTableProps = {
  selected: SeriesKey;
  /** Inclusive year window; rows outside it are shown but set back. */
  from: number;
  through: number;
};

/**
 * Tint strength for a year-over-year change, 0 to 1. The square root lifts
 * the modest moves most years see so they don't all read as blank.
 */
function heat(change: number) {
  return Math.sqrt(Math.min(Math.abs(change), HEAT_CLAMP) / HEAT_CLAMP);
}

/**
 * The whole dataset, as a market report would print it. The selected series
 * and year window are picked out so the table reads with the chart above it.
 * The change view swaps prices for moves from the prior year and shades each
 * cell, so run-ups and slumps show across the chain at a glance.
 */
export function SeriesTable({ selected, from, through }: SeriesTableProps) {
  const [view, setView] = useState<TableView>('price');

  return (
    <div className="series-table-block">
      <div className="series-table-head">
        <h2 className="series-table-caption" id="series-table-title">
          {view === 'price'
            ? 'Annual averages by year'
            : 'Change from the prior year'}
        </h2>
        <fieldset className="segmented">
          <legend className="sr-only">Table values</legend>
          <button
            type="button"
            aria-pressed={view === 'price'}
            onClick={() => setView('price')}
          >
            Prices
          </button>
          <button
            type="button"
            aria-pressed={view === 'change'}
            onClick={() => setView('change')}
          >
            Change vs prior year
          </button>
        </fieldset>
      </div>

      <div className="series-table-wrap">
        <table
          className="series-table"
          aria-labelledby="series-table-title"
          data-view={view}
        >
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
                  <span className="series-table-unit">
                    {view === 'price' ? SERIES[key].unit : '% y/y'}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row, index) => (
              <tr
                key={row.year}
                data-outside={
                  row.year < from || row.year > through ? '' : undefined
                }
              >
                <th scope="row">{row.year}</th>
                {ALL_SERIES.map((key) => {
                  const isSelected = key === selected ? '' : undefined;
                  if (view === 'price') {
                    return (
                      <td key={key} data-selected={isSelected}>
                        {formatValue(key, row[key])}
                      </td>
                    );
                  }
                  const change = yearOverYear(key, index);
                  if (change === null) {
                    return (
                      <td key={key} data-selected={isSelected}>
                        <span aria-label="No prior year">—</span>
                      </td>
                    );
                  }
                  return (
                    <td
                      key={key}
                      data-selected={isSelected}
                      data-direction={change < 0 ? 'down' : 'up'}
                      style={{ '--heat': heat(change) } as CSSProperties}
                    >
                      {formatChange(change)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {view === 'change' && (
        <div className="heat-key" aria-hidden="true">
          <span>−{HEAT_CLAMP}% or more</span>
          <span className="heat-key-ramp" />
          <span>+{HEAT_CLAMP}% or more</span>
        </div>
      )}
    </div>
  );
}
