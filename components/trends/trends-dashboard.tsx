'use client';

import { useState } from 'react';
import { IndexChart } from '@/components/trends/index-chart';
import { SeriesPicker } from '@/components/trends/series-picker';
import { SeriesTable } from '@/components/trends/series-table';
import { TrendChart } from '@/components/trends/trend-chart';
import {
  FIRST_YEAR,
  formatChange,
  formatValue,
  LAST_YEAR,
  percentChange,
  ROWS,
  SERIES,
  YEARS,
  type SeriesKey,
} from '@/lib/trends/series';

type YearSelectProps = {
  id: string;
  label: string;
  value: number;
  options: readonly number[];
  onChange: (year: number) => void;
};

function YearSelect({ id, label, value, options, onChange }: YearSelectProps) {
  return (
    <label className="year-select" htmlFor={id}>
      <span>{label}</span>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      >
        {options.map((year) => (
          <option key={year} value={year}>
            {year}
          </option>
        ))}
      </select>
    </label>
  );
}

export function TrendsDashboard() {
  const [series, setSeries] = useState<SeriesKey>('retailPricePerLb');
  const [from, setFrom] = useState(FIRST_YEAR);
  const [through, setThrough] = useState(LAST_YEAR);

  // The window always spans at least two years, so "from" can only move up to
  // the year before "through" and vice versa; the change figure stays real.
  const fromOptions = YEARS.filter((year) => year < through);
  const throughOptions = YEARS.filter((year) => year > from);

  const rows = ROWS.filter((row) => row.year >= from && row.year <= through);
  const first = rows[0];
  const last = rows[rows.length - 1];
  let high = first;
  let low = first;
  for (const row of rows) {
    if (row[series] > high[series]) high = row;
    if (row[series] < low[series]) low = row;
  }
  const change = percentChange(first[series], last[series]);
  const meta = SERIES[series];

  return (
    <>
      <section className="site-section" aria-label="Choose a price series">
        <SeriesPicker selected={series} onSelect={setSeries} />
      </section>

      <section className="site-section trend" aria-labelledby="trend-title">
        <div className="trend-head">
          <h2 id="trend-title">
            {meta.product}
            <span className="trend-unit">{meta.unit}</span>
          </h2>
          <div className="trend-window">
            <YearSelect
              id="trend-from"
              label="From"
              value={from}
              options={fromOptions}
              onChange={setFrom}
            />
            <YearSelect
              id="trend-through"
              label="Through"
              value={through}
              options={throughOptions}
              onChange={setThrough}
            />
          </div>
        </div>

        <TrendChart rows={rows} series={series} />

        <dl className="trend-stats">
          <div>
            <dt>{first.year}</dt>
            <dd>{formatValue(series, first[series])}</dd>
          </div>
          <div>
            <dt>{last.year}</dt>
            <dd>{formatValue(series, last[series])}</dd>
          </div>
          <div>
            <dt>Change</dt>
            <dd data-direction={change < 0 ? 'down' : 'up'}>
              {formatChange(change)}
            </dd>
          </div>
          <div>
            <dt>High, {high.year}</dt>
            <dd>{formatValue(series, high[series])}</dd>
          </div>
          <div>
            <dt>Low, {low.year}</dt>
            <dd>{formatValue(series, low[series])}</dd>
          </div>
        </dl>
      </section>

      <section className="site-section trend" aria-labelledby="index-title">
        <div className="trend-head">
          <h2 id="index-title">
            Across the chain
            <span className="trend-unit">{first.year} = 100</span>
          </h2>
          <p className="trend-note">
            Every series rebased to the same starting point, so moves in $/cwt,
            $/lb and $/ton can be compared directly. Hover a line to identify
            it; click to select it.
          </p>
        </div>

        <IndexChart rows={rows} selected={series} onSelect={setSeries} />
      </section>

      <section className="site-section" aria-label="Full dataset">
        <SeriesTable selected={series} from={from} through={through} />
      </section>
    </>
  );
}
