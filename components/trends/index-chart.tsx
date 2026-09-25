'use client';

import { useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ALL_SERIES,
  formatChange,
  formatValue,
  indexRows,
  SERIES,
  type IndexRow,
  type SeriesKey,
  type SeriesRow,
} from '@/lib/trends/series';

const AXIS_TICK = { fill: 'var(--muted-foreground)', fontSize: 12 };
const CHART_MARGIN = { top: 16, right: 64, left: 0, bottom: 0 };
const INITIAL_DIMENSION = { width: 800, height: 320 };
const CONTEXT_STROKE = 'var(--chart-context)';

type TipProps = {
  active?: boolean;
  label?: string | number;
  payload?: readonly { payload?: IndexRow }[];
  rows: readonly SeriesRow[];
  highlighted: ReadonlySet<SeriesKey>;
};

/**
 * Every series at the hovered year, ordered as the lines stack on the chart
 * so the list reads top to bottom like the plot does.
 */
function IndexTip({ active, label, payload, rows, highlighted }: TipProps) {
  const indexed = payload?.[0]?.payload;
  const row = rows.find((candidate) => candidate.year === label);
  if (!active || !indexed || !row) return null;
  const ordered = [...ALL_SERIES].sort((a, b) => indexed[b] - indexed[a]);
  return (
    <div className="chart-tip index-tip">
      <span className="chart-tip-year">
        {label} vs {rows[0].year}
      </span>
      <ul>
        {ordered.map((key) => (
          <li
            key={key}
            data-highlighted={highlighted.has(key) ? '' : undefined}
          >
            <span
              className="index-swatch"
              style={{
                background: highlighted.has(key)
                  ? SERIES[key].color
                  : CONTEXT_STROKE,
              }}
            />
            <span className="index-tip-name">{SERIES[key].product}</span>
            <span className="index-tip-change">
              {formatChange(indexed[key] - 100)}
            </span>
            <span className="index-tip-value">
              {formatValue(key, row[key])}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

type EndLabelProps = {
  x?: number | string;
  y?: number | string;
  index?: number;
};

type IndexChartProps = {
  rows: readonly SeriesRow[];
  selected: SeriesKey;
  onSelect: (series: SeriesKey) => void;
};

/**
 * All six series on one axis, rebased so the first year of the window is 100.
 * The table above it mixes $/cwt, $/lb and $/ton; this is the view where they
 * can be compared. The selected series carries its colour and the rest sit
 * behind it in grey; hovering a line or its legend entry brings it forward.
 */
export function IndexChart({ rows, selected, onSelect }: IndexChartProps) {
  const [hovered, setHovered] = useState<SeriesKey | null>(null);
  const data = indexRows(rows);
  const last = data[data.length - 1];
  const highlighted = new Set<SeriesKey>(
    hovered ? [selected, hovered] : [selected],
  );
  // Grey lines first, then the highlighted ones, so colour always draws on top.
  const drawOrder = [
    ...ALL_SERIES.filter((key) => !highlighted.has(key)),
    ...ALL_SERIES.filter((key) => key !== selected && highlighted.has(key)),
    selected,
  ];

  const endLabel = (key: SeriesKey) =>
    function EndLabel({ x, y, index }: EndLabelProps) {
      if (index !== data.length - 1 || x === undefined || y === undefined) {
        return null;
      }
      return (
        <text
          x={Number(x) + 8}
          y={y}
          dy="0.35em"
          className="index-end-label"
          fill="var(--ink)"
        >
          {formatChange(last[key] - 100)}
        </text>
      );
    };

  return (
    <div className="index-chart">
      <figure
        className="trend-chart"
        aria-label={`All series indexed to ${rows[0].year} equals 100, ${rows[0].year} to ${last.year}`}
      >
        <ResponsiveContainer
          width="100%"
          height="100%"
          initialDimension={INITIAL_DIMENSION}
        >
          <LineChart
            data={data}
            margin={CHART_MARGIN}
            onMouseLeave={() => setHovered(null)}
          >
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis
              dataKey="year"
              tickLine={false}
              axisLine={false}
              tick={AXIS_TICK}
              tickMargin={10}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={48}
              tick={AXIS_TICK}
              tickFormatter={(value: number) => value.toFixed(0)}
              domain={['auto', 'auto']}
            />
            <ReferenceLine
              y={100}
              stroke="var(--muted-foreground)"
              strokeDasharray="3 3"
            />
            <Tooltip
              cursor={{ stroke: 'var(--line)' }}
              content={<IndexTip rows={rows} highlighted={highlighted} />}
            />
            {drawOrder.map((key) => {
              const isOn = highlighted.has(key);
              return (
                <Line
                  key={key}
                  type="linear"
                  dataKey={key}
                  stroke={isOn ? SERIES[key].color : CONTEXT_STROKE}
                  strokeWidth={isOn ? 2.5 : 1.5}
                  dot={
                    isOn
                      ? {
                          r: 3.5,
                          fill: '#fff',
                          stroke: SERIES[key].color,
                          strokeWidth: 2,
                        }
                      : false
                  }
                  activeDot={isOn ? { r: 5, strokeWidth: 0 } : false}
                  label={isOn ? endLabel(key) : undefined}
                  isAnimationActive={false}
                />
              );
            })}
            {/* Wide invisible twins give the thin lines a usable hit area. */}
            {ALL_SERIES.map((key) => (
              <Line
                key={`${key}-hit`}
                type="linear"
                dataKey={key}
                stroke="transparent"
                strokeWidth={14}
                dot={false}
                activeDot={false}
                isAnimationActive={false}
                className="index-hit"
                onMouseEnter={() => setHovered(key)}
                onClick={() => onSelect(key)}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </figure>

      <ul className="index-legend" aria-label="Series">
        {ALL_SERIES.map((key) => {
          const isOn = highlighted.has(key);
          return (
            <li key={key}>
              <button
                type="button"
                aria-pressed={key === selected}
                onClick={() => onSelect(key)}
                onMouseEnter={() => setHovered(key)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(key)}
                onBlur={() => setHovered(null)}
              >
                <span
                  className="index-swatch"
                  style={{
                    background: isOn ? SERIES[key].color : CONTEXT_STROKE,
                  }}
                />
                <span className="index-legend-name">{SERIES[key].product}</span>
                <span
                  className="index-legend-change"
                  data-direction={last[key] < 100 ? 'down' : 'up'}
                >
                  {formatChange(last[key] - 100)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
