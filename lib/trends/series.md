# `lib/trends/series.ts` — USDA history shaping for public pages

**Role:** Pure data shaping and formatting of the yearly USDA prices for the home page ledger (`/`) and the market trends page (`/trends`). It never runs the simulation.

## Why it exists

The public pages show how the five chain prices and feed moved from 2015 to the latest year. Precomputing the rows and summaries once at module load keeps those components as thin renderers and gives every chart one consistent set of series metadata (units, decimals, colors).

## Where it fits

- **Imports:** [`lib/data/historical-scenarios.json`](../data/historical-scenarios.md) only.
- **Imported by:**
  - `app/page.tsx`, `app/trends/page.tsx`
  - `components/trends/*` (chain-ledger, ledger-cell, series-picker, series-table, trend-chart, index-chart, trends-dashboard)
  - `components/site/site-footer.tsx` (`DATA_SOURCES`)

## Public API

| Export | Purpose |
|---|---|
| `SeriesKey` | The 5 chain prices plus `feedCostPerTon`. These are the same names as the `ScenarioInput` and JSON fields. |
| `SERIES` | Per-series metadata: `stage`, `product`, `unit`, `decimals`, `color`. The colors match the simulator's stage colors. |
| `CHAIN_SERIES` / `ALL_SERIES` | The chain order, and that order plus feed. |
| `YEARS`, `FIRST_YEAR`, `LAST_YEAR`, `ROWS` | One `SeriesRow` per available year. |
| `DATA_SOURCES` | `Object.values(historicalData.sources)`. |
| `formatValue(key, v)` | `$` plus a fixed number of decimals for that series. |
| `percentChange(from, to)` | `(to − from) / from × 100`. Returns `Infinity` or `NaN` when `from` is 0. |
| `formatChange(pct)` | `"+46.4%"` / `"−12.0%"`, using a real minus sign (U+2212). |
| `sparklinePath(values, w, h)` | SVG path `M…L…` with 2 px padding. Returns `''` for fewer than 2 points, and draws a flat line when all values are equal. |
| `SPARK_WIDTH` / `SPARK_HEIGHT` | 120 × 32. The cell's SVG `viewBox` must match. |
| `SERIES_SUMMARY` | Per series: `latest`, `decadeChange` (first→last %), and `sparkline`. |
| `indexRows(rows)` | Rebases every series to 100 at `rows[0]`, so mixed units can share one axis. The index chart uses it. |
| `yearOverYear(key, i)` | % change versus the prior row, or `null` at i = 0. |

## Testing

There's no dedicated test file. The module is pure and easy to test.

```bash
npm test   # add tests/trends-series.test.ts
```

Suggested cases:
- `ROWS.length === YEARS.length`, and the rows are in order.
- `formatChange(-12)` uses `−`.
- `sparklinePath([1])` returns `''`.
- `sparklinePath` keeps every coordinate within `[2, w−2] × [2, h−2]`.
- `indexRows(ROWS)[0][k] === 100` for every key.
- `yearOverYear(k, 0) === null`.
- `SERIES_SUMMARY[k].latest === ROWS.at(-1)[k]`.

## When changing this file

- If you add a series, it must exist in every JSON year. Then add it to `SERIES`, to `ALL_SERIES`, and to the `SERIES_SUMMARY` literal.
- Keep the colors aligned with `components/simulator/results/phases.ts`.
