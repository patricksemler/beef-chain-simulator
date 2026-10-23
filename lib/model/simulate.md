# `lib/model/simulate.ts` — simulation engine

**Role:** The Monte Carlo model. Every result number in the app comes from `runSimulation()` here. Pure TypeScript with no DOM, React, or network use, so it runs the same in the Web Worker, in Node (tests), and anywhere else.

## Why it exists

The app's whole purpose is "what does profit look like at each stage of the U.S. beef chain under these assumptions?" This file answers it. It simulates weighted agents (sample animals) through five stages, draws correlated market shocks per trial, and collapses many trials into one `SimulationSummary` of medians, P10/P90, and loss probabilities.

## Where it fits

```
ScenarioInput (types.ts) ─► runSimulation() ─► SimulationSummary (types.ts)
        ▲                                           │
 defaults.ts / historical.ts               workers/simulation.worker.ts → use-simulation.ts → results UI
                                            lib/assistant/context.ts (turns it into prompt text)
```

- **Imports:** `historical.ts` (`isHistoricalYear`, `historicalDataVintage`), `phases.ts` (`PHASE_ORDER`), and `types.ts`.
- **Imported by:** `workers/simulation.worker.ts` (production path) and the tests. `blendedGradeIndex` is exported but currently used only inside this file.

## Public API

| Export | Purpose |
|---|---|
| `runSimulation(input, onProgress?)` | Entry point. Validates (throws one `Error` whose message joins all errors), runs `input.trials` trials, sorts them by chain profit, then aggregates. Calls `onProgress` when `trial % 10 === 0` and on the last trial. |
| `validateScenario(input)` | Returns `string[]` of human-readable errors (empty means valid). The UI shows these messages verbatim. |
| `allocateEntryMonths(input)` | Head count per month across the whole horizon (an integer array that sums to exactly `totalHead`). |
| `blendedGradeIndex(input)` | Σ gradeMix × price index (Choice = 1). It multiplies wholesale and retail prices. It's ≈1.015 for the 2025 profile. |

Internal: `mulberry32`, `normal` (Box–Muller), `percentile` (linear interpolation), `clamp`, `cadenceWeights`, `emptyLedger`, `trend`, `simulateTrial`, `splitRetailByGrade`, `aggregate`, `buildSensitivity`.

## Core logic

**Stages:** `cowCalf → stocker → feedlot → packer → retail` (`PHASE_ORDER` from [`phases.ts`](phases.md)). Each stage pays the previous stage's sale value as `acquisitionCost`. Cow-calf pays 0.

**Agents:** `min(totalHead, 2500)` agents. Each one represents `totalHead / agentCount` head, and every ledger sum is multiplied by that weight. An agent's entry month is where its midpoint head index falls in the cumulative `allocateEntryMonths` output.

**Randomness (per trial, seeded `seed + trialIndex × 7919`):**
- One common factor, plus a lognormal mean-1 shock per price: `exp(σ(ρ·common + √(1−ρ²)·ε) − σ²/2)`, with ρ clamped to [0, 0.95].
- Feed uses a fixed −0.2 loading on the common factor.
- The shocks are constant for the whole trial. They don't vary by month.
- Per-agent noise: start weight `×clamp(1+N·v·0.85, 0.8, 1.2)`. Per stage: duration `×clamp(1+N·v, 0.78, 1.22)` and gain `×clamp(1+N·v·0.7, 0.82, 1.18)`.

**Per stage, per agent:** enter, then `completionRatio = min(1, monthsLeft / stageMonths)`, then gain weight, then costs:
- Direct cost: one-time × ratio + daily × days.
- Feed (feedlot only): lb/day × days × trended, shocked $/ton ÷ 2000, trended at the **entry** month.
- Overhead: × ratio.

Then:
- **Not finished** (`ratio < 0.999999`): the animal becomes ending inventory, valued at the stage's **untrended** shocked price. Packer value includes the byproduct credit.
- **Finished:** mortality is drawn **after** costs. If the animal survives, it's sold at the trended, shocked price.
- **Packer** sells `lbs × wholesale × gradeIndex + byproduct`. Retail pays only the wholesale part.
- **Retail** sells `lbs × retail × gradeIndex` and adds `RETAIL_COST_PER_LB` ($1.55) × lbs to direct costs.

Here `lbs = liveWt × dressing% × saleableYield`.

**Ledger identities (per trial and after aggregation):**
- `operatingContribution = revenue + terminalInventoryValue − acquisitionCost − directCosts` (shown as "Cash profit")
- `economicProfit = operatingContribution − economicCosts` (shown as "Total profit")
- Chain = Σ stages. Inter-stage transfers cancel, which is why the **wholesale price sensitivity swing is ~0**.

**Aggregation (`aggregate`):**
- Each ledger line is the median of that line on its own. Profits are then *recomputed* from those medians, so the ledger adds up but doesn't correspond to any single trial.
- P10, P90, and probability of loss come from per-trial stage or chain profit.
- `endingInventoryHead = totalHead − completed − mortality` (derived), so `reconciliationDifference` is always 0.
- `margin` and `economicProfitPerExitedHead` use the median-by-chain-profit trial (`medianTrial`) as the denominator. `economicProfitPerStartedHead` divides by `totalHead`.
- Break-evens:
  - `breakEvenRetailPricePerLb = retail − chainProfit / (retailPounds × gradeIndex)`
  - `breakEvenFedPricePerCwt = fed − feedlotProfit / fedCwtSold`
  - Both are floored at 0.
- `retailByGrade` (`splitRetailByGrade`):
  - Revenue and beef cost are split by value share (`share × index / blended`). Store cost is split by pound share. The three rows sum exactly to the retail ledger.
  - Per-lb figures use only beef actually *sold* (`retailSales`).
- `monthly`: each stage's profit is allocated to months in proportion to that stage's sales. It's not a true monthly P&L, and the UI doesn't display it.

**Sensitivity (`buildSensitivity`):**
- 7 drivers: retail, wholesale, fed, feeder, calf, feed, and saleable yield (clamped to 0.40–0.85).
- Each driver is set to ×0.9 and ×1.1, and one **deterministic** trial runs for each. `swing = |hi − lo| / 2`, and the list is sorted by swing descending.
- `sensitivityBase` is the deterministic run with no changes.
- Deterministic means no shocks, no noise, and **no mortality**, so the base won't equal the headline median.
- It's shown in the "What moves profit most" chart (`profit-drivers.tsx`) and sent to the assistant.

## Hard-coded constants

| Constant | Value |
|---|---|
| Max agents | 2,500 |
| `MONTH_DAYS` | 30.4375 |
| `RETAIL_COST_PER_LB` | $1.55 |
| Feed's loading on the common factor | −0.2 |
| Correlation cap | 0.95 |
| Sensitivity step | ±10% |
| Trial seed stride | 7919 |

The noise multipliers and clamps listed above are also hard-coded.

## Gotchas

- `validateScenario` caps `trials` at 500. The UI's Runs dropdown offers 100, 250 and 500, so raising the cap means adding an option there too.
- Trends compound from simulation month 0, not a calendar month. Ending inventory ignores trends.
- The break-even retail price looks low on short horizons because most profit is unsold inventory, while the divisor counts only beef actually sold.
- Mortality and gain apply to packer and retail too if a user sets them, even though that isn't physically meaningful.
- `entryMonth` uses `findIndex` and falls back to month 0 if no month matches. That case is defensive and shouldn't happen.

## Testing

```bash
npm test -- tests/simulation.test.ts
```

Existing coverage (`tests/simulation.test.ts`):
- Exact entry allocation, and `upfront` puts everyone in month 0.
- Validation of head count, horizon, custom cadence, grade shares, and year.
- The same seed gives identical results.
- Head counts reconcile and P10 ≤ median ≤ P90.
- Ledgers add up and totals scale linearly with head count.
- Packer and retail are kept separate.
- Edge cases: 100% mortality, unfinished inventory, 30M head, 1 head, and zero prices.
- Zero variance gives P10 = P90.
- Grade split sums exactly, and per-lb price = Choice × index.
- A higher Prime share raises profit, and the grade mix doesn't matter when all indexes are 1.

Useful pattern: `cloneDefaultScenario()`, then shrink `totalHead` (~10k) and `trials` (~12) to keep tests fast.

**What to test when you change something:**
- Any ledger change: re-assert the two profit identities per stage, and that the chain equals the sum of stages.
- Any new randomness: reproducibility for a fixed seed, and that setting every volatility and `biologicalVariation` to 0 still gives P10 = P90.
- New validation rules: one rejecting case and one accepting case each.
- Gaps worth covering:
  - Trends (a positive cattle trend raises cow-calf revenue).
  - Break-even formulas (plug the break-even price back in and confirm chain or feedlot profit is ≈0 in deterministic mode).
  - The sensitivity ordering and the wholesale swing ≈ 0.
  - Each cadence's monthly shape.

## When changing this file

- Changing a constant or formula also requires updating the assistant's prose in [`lib/assistant/prompt.ts`](../assistant/prompt.ts) ("HOW THE MODEL WORKS"). The assistant explains results from that text.
- Adding a field to `SimulationSummary` means updating [`types.ts`](types.ts), and [`lib/assistant/context.ts`](../assistant/context.ts) if it's shown on screen.
- Keep this file free of browser APIs, because it runs in Node under Vitest.
