# `lib/model/format.ts` — number formatting helpers

**Role:** Shared, cached `Intl.NumberFormat('en-US')` formatters, so the results UI and the assistant's text description of the screen display numbers identically.

## Why it exists

The assistant has to quote the same strings the user sees (for example "$76.5M"). Both the results components and [`lib/assistant/context.ts`](../assistant/context.ts) go through these helpers, so the two can't drift apart.

## Public API

| Function | Example | Notes |
|---|---|---|
| `compactCurrency(n)` | `$76.5M` | USD, compact notation, ≤1 decimal |
| `currency(n)` | `$1,070` | USD, 0 decimals |
| `compactNumber(n)` | `13.2M` | compact notation, ≤1 decimal |
| `whole(n)` | `23,200` | 0 decimals, with grouping |
| `percent(n)` | `12.5%` | input is a **fraction** (0.125) |

- **Imported by:** most `components/simulator/results/*` files, `scenario-panel.tsx`, `lib/assistant/context.ts`, and `tests/assistant.test.ts`.

## Testing

There's no dedicated test. `tests/assistant.test.ts` asserts that the dashboard description contains `compactCurrency(...)` and `currency(...)` output, which pins the shared usage.

If you change a format:
- Expect assistant tests that compare strings to need updating.
- Add a small table-driven test (value → expected string) if you add a helper.
- Remember that `percent` takes a fraction, not a whole percent.
