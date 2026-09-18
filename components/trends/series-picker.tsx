'use client';

import { LedgerCell } from '@/components/trends/ledger-cell';
import { ALL_SERIES, SERIES, type SeriesKey } from '@/lib/trends/series';

type SeriesPickerProps = {
  selected: SeriesKey;
  onSelect: (series: SeriesKey) => void;
};

/**
 * The chain ledger as a control: pick the point in the chain whose history
 * the chart should show. Native radios give arrow-key movement between the
 * cells for free. Feed cost is the sixth column, set apart because it is an
 * input to the chain rather than a handoff within it.
 */
export function SeriesPicker({ selected, onSelect }: SeriesPickerProps) {
  return (
    <fieldset className="ledger-row ledger-row-picker">
      <legend className="sr-only">Price series</legend>
      {ALL_SERIES.map((series) => (
        <label
          key={series}
          className="ledger-cell ledger-option"
          data-input={series === 'feedCostPerTon' ? '' : undefined}
        >
          <input
            type="radio"
            name="series"
            value={series}
            className="sr-only"
            checked={series === selected}
            onChange={() => onSelect(series)}
            aria-label={`${SERIES[series].product}, ${SERIES[series].unit}`}
          />
          <LedgerCell series={series} />
        </label>
      ))}
    </fieldset>
  );
}
