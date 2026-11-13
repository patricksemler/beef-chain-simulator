'use client';

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  formatChange,
  formatValue,
  percentChange,
  SERIES,
  type SeriesKey,
  type SeriesRow,
} from '@/lib/trends/series';

const AXIS_TICK = { fill: 'var(--muted-foreground)', fontSize: 12 };
const CHART_MARGIN = { top: 16, right: 12, left: 0, bottom: 0 };
const INITIAL_DIMENSION = { width: 800, height: 320 };
const ACTIVE_DOT = { r: 5, strokeWidth: 0 };

type TipProps = {
  active?: boolean;
  label?: string | number;
  payload?: readonly { value?: number | string }[];
  series: SeriesKey;
};

function ChartTip({ active, label, payload, series }: TipProps) {
  const value = payload?.[0]?.value;
  if (!active || typeof value !== 'number') return null;
  return (
    <div className="chart-tip">
      <span className="chart-tip-year">{label}</span>
      <span className="chart-tip-value">{formatValue(series, value)}</span>
      <span className="chart-tip-unit">{SERIES[series].unit}</span>
    </div>
  );
}

type TrendChartProps = {
  rows: readonly SeriesRow[];
  series: SeriesKey;
};

/**
 * One series, its own unit, straight segments between annual points. The data
 * is annual, so a smoothed curve would imply values that were never observed.
 */
export function TrendChart({ rows, series }: TrendChartProps) {
  const meta = SERIES[series];
  const tickFormatter = (value: number) => formatValue(series, value);
  const dot = {
    r: 3.5,
    fill: 'var(--surface)',
    stroke: meta.color,
    strokeWidth: 2,
  };
  const first = rows[0];
  const last = rows[rows.length - 1];
  const change = percentChange(first[series], last[series]);
  // A handwritten note beside the last point, like a pencil mark on a printout.
  const endNote = (props: {
    x?: number | string;
    y?: number | string;
    index?: number;
  }) => {
    if (props.index !== rows.length - 1 || rows.length < 2) return null;
    const x = Number(props.x);
    const y = Number(props.y);
    return (
      <text
        key="end-note"
        className="chart-hand-note"
        x={x - 14}
        y={y + (change < 0 ? 28 : -14)}
        textAnchor="end"
      >
        {formatChange(change)} since {first.year}
      </text>
    );
  };

  return (
    <figure
      className="trend-chart"
      aria-label={`${meta.product} in ${meta.unit}, ${rows[0].year} to ${rows[rows.length - 1].year}`}
    >
      <ResponsiveContainer
        width="100%"
        height="100%"
        initialDimension={INITIAL_DIMENSION}
      >
        <LineChart data={rows} margin={CHART_MARGIN}>
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
            width={60}
            tick={AXIS_TICK}
            tickFormatter={tickFormatter}
            domain={['auto', 'auto']}
          />
          <Tooltip
            cursor={{ stroke: 'var(--line)' }}
            content={<ChartTip series={series} />}
          />
          <Line
            type="linear"
            dataKey={series}
            stroke={meta.color}
            strokeWidth={2.75}
            dot={dot}
            activeDot={ACTIVE_DOT}
            label={endNote}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </figure>
  );
}
