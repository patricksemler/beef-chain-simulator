# Beef Chain Simulator: codebase guide

This guide walks through all the logic in the app: where it lives, what each piece computes, and how the pieces connect. File paths are relative to the repo root. Line numbers point at the main functions and were accurate when this was written.

---

## 1. The short version

The app is a **browser-only Monte Carlo model** of the U.S. beef supply chain. Calves move through five stages (cow-calf → stocker → feedlot → packer → retail). Each stage buys the animal from the stage before it, adds cost and weight, and sells it on. The model reports profit per stage and for the whole chain.

There are two deployables:

| Deployable | What it is | Where it runs |
|---|---|---|
| **The site** | A static export (Next-style app built with `vinext`/Vite) with three pages: `/`, `/trends`, `/simulator` | Vercel (`dist/client`) |
| **The assistant API** | A small Cloudflare Worker that forwards chat requests to OpenAI, Google, or Anthropic using the user's own API key | Cloudflare Workers + a D1 database for rate limits |

There's no app server. The simulation runs in a **Web Worker in the user's browser**. The only backend is the optional chat assistant.

```
                      ┌──────────────────── build time ────────────────────┐
 USDA ERS websites ──►│ scripts/data/refresh-historical-data.mjs            │
                      │   └─► lib/data/historical-scenarios.json (2015–2025)│
                      └─────────────────────────────────────────────────────┘
                                          │ imported by
            ┌─────────────────────────────┼──────────────────────────────┐
            ▼                             ▼                              ▼
   lib/model/historical.ts        lib/trends/series.ts          lib/assistant/metrics.ts
   lib/model/defaults.ts          (home + /trends pages)        lib/assistant/prompt.ts
            │
            ▼
   /simulator page ──► useSimulation() ──postMessage──► workers/simulation.worker.ts
   (ScenarioPanel +         ▲                              └─► runSimulation() in lib/model/simulate.ts
    ResultsDashboard)       └──────── SimulationSummary ◄──┘
            │
            └─► AssistantWidget ──HTTPS + Bearer key──► workers/assistant-api.ts ──► LLM provider
                (sends a text snapshot of the screen)        (Cloudflare Worker, D1 rate limits)
```

---

## 2. Repo map

Only the files with real logic are listed. `components/ui/*` is stock shadcn/Base UI components, so you can ignore it.

| Path | Role |
|---|---|
| `lib/model/types.ts` | All model types: `ScenarioInput`, `PhaseAssumptions`, `PhaseResult`, `SimulationSummary`, etc. |
| `lib/model/simulate.ts` | **The engine.** Validation, entry allocation, per-trial simulation, aggregation, sensitivity. |
| `lib/model/historical.ts` | Reads the USDA JSON and applies a year's profile to a scenario. |
| `lib/model/defaults.ts` | Base scenario plus the 2025 overlay, and `SOURCE_NOTES`. |
| `lib/model/use-simulation.ts` | React hook that owns scenario/result state and talks to the Web Worker. Also registers a WebMCP tool. |
| `lib/model/format.ts` | `Intl.NumberFormat` helpers (`compactCurrency`, `currency`, `percent`, `whole`, `compactNumber`). |
| `workers/simulation.worker.ts` | Web Worker wrapper around `runSimulation`. |
| `lib/data/historical-scenarios.json` | Generated USDA annual profiles. Don't hand-edit it; regenerate it. |
| `scripts/data/refresh-historical-data.mjs` | Downloads the USDA files and builds the JSON above. |
| `lib/trends/series.ts` | Data shaping for the home ledger and the `/trends` page. |
| `components/simulator/*` | Simulator UI: input rail (`scenario-panel.tsx`) and results tabs (`results/*`). |
| `components/trends/*`, `components/site/*` | Public pages UI. |
| `lib/assistant/*` | Assistant: snapshot types, screen-to-text (`context.ts`), system prompt, schemas, rate limiting, storage. |
| `components/assistant/assistant-widget.tsx` | Chat panel UI plus the client-side conversation logic. |
| `workers/assistant-api.ts` | Cloudflare Worker with three endpoints: `/v1/validate`, `/v1/chat`, `/v1/compact`. |
| `migrations/*.sql` | D1 schema (rate-limit windows only). |
| `scripts/configure-assistant-worker.mjs` | CI helper that turns `wrangler.assistant.jsonc` into a deployable config with real D1 IDs. |
| `.github/workflows/*.yml` | PR runs a preview deploy; pushes to `main` run a production deploy. |
| `tests/*.test.ts` | Vitest: engine, assistant prompt/context/schemas, rate limiter. |

---

## 3. Data layer: where the numbers come from

### 3.1 `scripts/data/refresh-historical-data.mjs` (`npm run data:refresh`)

This is a standalone Node script, so it never runs in the app. The steps:

1. **Discover the download links.** `discoverDownload()` fetches each USDA ERS landing page in `SOURCES` and regex-matches the current download link, because USDA changes the `?v=` query strings.
2. **Download and parse** four sources: the livestock ZIP (`LivestockPrices.csv`, `MeatStats.csv`, unzipped with `fflate`), meat price spreads, cow-calf costs and returns, and feed grains.
3. **Pick a reference year.** `latestCandidate` is the latest year that has a "U.S. total" row in the cow-calf file. That year's operating cost, overhead, corn price, and byproduct value become the index denominators.
4. **Build each year (2015 → latest):**
   - **Observed prices** come from `annualMonthlyMean()`, which averages the 12 monthly values. The fed-steer series only needs 11 months because ERS is missing January 2022.
     - Calf = "Steers 500–550 lb", feeder = "Steers 750–800 lb", fed = "Steers 65–80% Choice" (all $/cwt).
     - Wholesale = "Choice beef wholesale value", retail = "All fresh beef retail value". Both are ¢/lb, divided by 100.
     - Dressing % = FI dressed weight ÷ FI live weight.
   - **Indexed assumptions** scale the hard-coded `BASE_2025` values by a USDA ratio:
     - `feedCostPerTon = 230 × (corn_year / corn_ref)`
     - `byproductCreditPerHead = 165 × (byproduct_year / byproduct_ref)`
     - For every phase: `directCostPerHead` and `dailyCostPerHead` × **cow-calf operating-cost index**, and `economicCostPerHead` × **cow-calf overhead index** (`scaledPhaseCosts()`). The stocker, feedlot, and packer costs are indexed off the *cow-calf* cost series too.
   - A year that's missing any required field is skipped. The script then **throws** unless every year from 2015 to latest is present, so you never get gaps.
5. The script writes `{ generatedAt, availableYears, latestYear, methodology, sources, years }`.

> The `BASE_2025` constant is labeled 2025 but is always applied to `latestCandidate`. When USDA publishes 2026 cost data, the base values will silently become "2026" values. That's worth revisiting then.

### 3.2 `lib/model/historical.ts`

- `AVAILABLE_HISTORICAL_YEARS`, `LATEST_HISTORICAL_YEAR` come straight from the JSON. `HistoricalYear` is a type derived from the JSON keys.
- `isHistoricalYear(year)` is a type guard.
- `getHistoricalProfile(year)` returns the year's entry.
- **`applyHistoricalYear(scenario, year)`** (line 46) is the key function. It overwrites only the **data-backed fields**: the 5 prices, feed cost, byproduct credit, dressing %, and each phase's `directCostPerHead` / `dailyCostPerHead` / `economicCostPerHead`. Everything the user owns stays: head count, horizon, cadence, seed, trials, biology (days, gain, mortality), yields, trends, and risk.

### 3.3 `lib/model/defaults.ts`

- `BASE_SCENARIO` holds every non-USDA assumption: 100,000 head, 24 months, even cadence, seed 2025, 250 trials, 7% biological variation, 85 lb start weight, 67% saleable yield, 28 lb/day feed intake, 0% trends, the phase biology (days, ADG, mortality), and the volatilities.
- `DEFAULT_SCENARIO = applyHistoricalYear(BASE_SCENARIO, LATEST_HISTORICAL_YEAR)`. The price literals in `BASE_SCENARIO` (for example `retailPricePerLb: 8.17`) get overwritten, so the **effective defaults are the 2025 JSON values** (retail $8.842/lb, calf $408.40/cwt, …).
- `cloneDefaultScenario()` returns a `structuredClone`, which **Reset** uses.
- `SOURCE_NOTES` is the list shown under "Data sources" in the simulator.

---

## 4. The simulation engine: `lib/model/simulate.ts`

This is the core of the app. Everything else displays or explains what it produces.

### 4.1 Inputs (`ScenarioInput` in `types.ts`)

This is a quick map of the fields. See **§7** for each setting's default, UI range, and exact effect.

| Group | Fields |
|---|---|
| Scale & timing | `totalHead` (1–30M), `horizonMonths` (12–120), `cadence` (`even` / `upfront` / `spring` / `fall` / `custom`), `customCadence[12]` |
| Monte Carlo | `trials` (1–500), `seed`, `biologicalVariation` |
| Prices | `calfPricePerCwt`, `feederPricePerCwt`, `fedPricePerCwt`, `wholesalePricePerLb`, `retailPricePerLb`, `feedCostPerTon`, `byproductCreditPerHead` |
| Yields | `startWeight`, `dressingPercentage`, `saleableYield`, `feedDryMatterLbPerDay` |
| Trends (annual %) | `annualCattlePriceTrend` (calf, feeder, and fed together), `annualWholesalePriceTrend`, `annualRetailPriceTrend`, `annualFeedCostTrend` |
| Per phase (`phases[key]`) | `durationDays`, `averageDailyGain`, `mortalityRate`, `directCostPerHead` (one-time), `dailyCostPerHead`, `economicCostPerHead` (overhead) |
| Risk (`marketRisk`) | 6 volatilities + `commonMarketCorrelation` |

### 4.2 Pipeline

```
runSimulation(input)                                   line 727
 ├─ validateScenario(input)  → throws joined errors    line 74
 ├─ for t in 0..trials-1: simulateTrial(input, t)      line 187
 ├─ sort trials by chainEconomicProfit
 └─ aggregate(input, trials, runtime)                  line 471
       ├─ medians / P10 / P90 / P(loss)
       ├─ buildSensitivity(input)                      line 640  (7 × 2 deterministic runs)
       └─ sensitivityBase = deterministic run
```

### 4.3 Helpers

- `mulberry32(seed)` (line 43) is a tiny seeded PRNG. Each trial is seeded with `seed + trialIndex × 7919`, so **results are fully reproducible** for a given seed.
- `normal(random)` uses Box–Muller to draw a standard normal.
- `percentile(values, q)` does linear interpolation on a sorted copy.
- `trend(base, annualRate, month)` returns `base × (1 + rate)^(month/12)`, a compounding drift.

### 4.4 `validateScenario` (line 74)

This returns a list of error strings. `runSimulation` throws them joined into one message, the worker forwards that message, and the UI shows it. The rules: reference year must exist, head count must be an integer from 1 to 30M, horizon must be an integer from 12 to 120, trials from 1 to 500, variation from 0 to 1, a 12-element non-negative custom cadence with at least one non-zero value when `custom` is selected, non-negative days and gain, and mortality from 0 to 1.

### 4.5 `allocateEntryMonths` (line 137): when calves enter

- `cadenceWeights()` returns 12 monthly weights. `even` is all 1s. `spring` and `fall` are hand-tuned seasonal curves. `custom` is the user's array. `upfront` puts everything in month 0.
- The weights **repeat across the whole horizon** (`weights[month % 12]`), so with a 5-year horizon, calves keep entering in years 2–5 as well. The only exception is `upfront`.
- Weights are normalized to `totalHead`, floored, and leftover head go to the months with the largest fractional parts (largest-remainder method). The total is therefore always exact. `tests/simulation.test.ts` checks this.

### 4.6 `simulateTrial` (line 187): one Monte Carlo run

**Weighted agents.** The model doesn't simulate 30M animals. It simulates `min(totalHead, 2500)` agents, and each agent represents `weight = totalHead / agentCount` head. Every ledger total is multiplied by `weight`. Agent *i* enters in the month where its midpoint head index (`(i + 0.5) × weight`) falls in the cumulative entry allocation.

**Market shocks (once per trial, shared by all agents).**
```
common ~ N(0,1);  ρ = clamp(correlation, 0, 0.95)
linkedShock(σ) = exp( σ·(ρ·common + √(1−ρ²)·ε) − σ²/2 )     // lognormal, mean 1
calf/feeder/fed/wholesale/retail shocks use linkedShock(their σ)
feedShock uses  −0.2·common + √0.96·ε                         // feed mildly *negatively* correlated
```
One trial is one "market world". Prices are multiplied by their shock for the entire trial, so shocks don't vary month to month.

**Per-agent biology.** The start weight is multiplied by `clamp(1 + N·var·0.85, 0.8, 1.2)`. For each phase, the duration is multiplied by `clamp(1 + N·var, 0.78, 1.22)` and the gain by `clamp(1 + N·var·0.7, 0.82, 1.18)`.

**The phase loop.** For each agent, the model walks `cowCalf → stocker → feedlot → packer → retail`:

1. **Stop** if the horizon has been reached, the animal is dead, or it has finished.
2. **Enter:** `enteredHead += weight` and `acquisitionCost += acquisitionValue × weight`. The acquisition value is the previous stage's sale price. It's 0 for cow-calf, because calves are born, not bought.
3. **Time-boxing:** `completionRatio = min(1, monthsLeft / phaseMonths)`, and `daysInPhase = durationDays × completionRatio`.
4. **Weight:** `exitWeight = liveWeight + ADG × daysInPhase × gainFactor`.
5. **Costs**, all scaled by the completion ratio:
   - direct = `directCostPerHead × completionRatio + dailyCostPerHead × daysInPhase`
   - **feedlot only:** feed = `feedLbPerDay × daysInPhase × trend(feedCost) × feedShock / 2000`
   - overhead (`economicCosts`) = `economicCostPerHead × completionRatio`
6. **If the horizon cuts the phase off** (`completionRatio < 1`), the animal becomes **ending inventory**. It's valued at that stage's sale price (shocked but **not trended**), added to `terminalInventoryValue` and `endingInventoryHead`, and the agent stops.
7. **Mortality:** the animal dies with probability `mortalityRate`, which is checked *after* that phase's costs are incurred. A dead animal adds to `mortalityHead` and stops generating revenue.
8. **Sale** at `currentMonth += phaseMonths`, using trended and shocked prices:

| Stage | Sale value per head | What the next stage pays |
|---|---|---|
| Cow-calf | `exitWeight/100 × calf$/cwt` | same |
| Stocker | `exitWeight/100 × feeder$/cwt` | same |
| Feedlot | `exitWeight/100 × fed$/cwt` (also accumulates `fedLiveCwtSold`) | same |
| Packer | `lbs × wholesale$/lb + byproductCredit`, where `lbs = exitWeight × dressing% × saleableYield` | wholesale value **only** (the byproduct credit stays with the packer) |
| Retail | `lbs × retail$/lb`, plus a **hard-coded retail handling cost of $1.55/lb** added to direct costs | — (`completedHead`, `retailPounds`) |

9. The sale value is also added into `monthly[saleMonth][stage]`, which is used next.

**After all agents:**
- Per stage: `operatingContribution = revenue + terminalInventoryValue − acquisitionCost − directCosts`. **"Cash profit" in the UI.**
- `economicProfit = operatingContribution − economicCosts`. **"Total profit" in the UI.**
- Chain totals are sums across the stages. Internal transfers cancel out, so chain profit ≈ retail sales + packer byproduct + ending inventory − all direct costs and overhead.
- **Monthly series:** each stage's *total economic profit* is spread across months **in proportion to that stage's sales in each month**. It isn't a true monthly P&L; it's an allocation.

#### Worked example (2025 defaults, one animal that completes every stage, no shocks or variation)

| Stage | Exit wt | Money in | Cattle bought | Direct costs | Overhead | **Total profit** |
|---|---|---|---|---|---|---|
| Cow-calf | 574 lb | $2,345 | $0 | $950 | $325 | **+$1,070** |
| Stocker | 799 lb | $2,573 | $2,345 | $203 ($60 + 150 d × $0.95) | $80 | **−$55** |
| Feedlot | 1,393 lb | $3,122 | $2,573 | $829 ($150 + $99 yardage + $580 feed) | $70 | **−$350** |
| Packer | 571 retail lb | $3,278 ($3,113 wholesale + $165 byproduct) | $3,122 | $475 | $220 | **−$538** |
| Retail | — | $5,047 | $3,113 | $885 ($1.55 × 571 lb) | $0 | **+$1,048** |
| **Chain** | | | | | | **≈ +$1,176 / head** |

The whole chain takes 570 days, about 18.7 months. With the default 24-month horizon and even entry, calves that enter after about month 5 don't finish, so they show up as "Still in chain" (ending inventory).

### 4.7 `aggregate` (line 471): turning trials into one summary

The trials are sorted by chain economic profit first.

- **Per stage:** each ledger line (revenue, terminal value, acquisition, direct, economic, head counts, exit weight) is the **median of that line on its own**. Operating and economic profit are then *recomputed* from those medians, so the ledger always adds up, even though it doesn't correspond to any single trial. P10, P90, and `probabilityOfLoss` come from the per-trial stage economic profit.
  - `economicProfitPerStartedHead = stage profit / totalHead`, i.e. per calf **entering the chain**, not per head entering that stage. The Sectors "Per head" column uses this value.
  - `economicProfitPerExitedHead` and `margin` use `base`, the **median-by-chain-profit trial**, for their denominators.
- **Chain:** `chainEconomicProfit` = sum of the stage medians. `chainP10/P90/ProbabilityOfLoss` come from the per-trial chain profit.
- **Heads:** `completedHead` and `mortalityHead` are medians. `endingInventoryHead = totalHead − completed − mortality` is **derived**, so `reconciliationDifference` is 0 by construction.
- **Break-evens:**
  - `breakEvenRetailPricePerLb = retailPrice − chainProfit / retailPounds`
  - `breakEvenFedPricePerCwt = fedPrice − feedlotProfit / fedLiveCwtSold`
- `monthly` holds the per-month medians of each stage.

### 4.8 `buildSensitivity` (line 640)

For 7 drivers (retail, wholesale, fed, feeder, and calf prices, plus feed cost and saleable yield), the model runs **one deterministic trial** at ×0.9 and ×1.1 and records `swing = |high − low| / 2`. The list is sorted by swing. `sensitivityBase` is the same deterministic run with no change.

"Deterministic" (`simulateTrial(..., true)`) means no price shocks, no biological noise, and **no mortality**, because the mortality check is skipped. That's why the sensitivity base won't match the headline median.

---

## 5. Running the engine in the browser

### 5.1 `workers/simulation.worker.ts`

Receives `{ requestId, scenario }`, calls `runSimulation`, and posts back `{type:'progress'}` every 10 trials, then `{type:'result'}` or `{type:'error'}`.

### 5.2 `lib/model/use-simulation.ts` → `useSimulation()`

State: `scenario` (the draft the user is editing), `result` (the last *completed* run), `isRunning`, and `error`.

- On mount, it creates the worker and immediately runs `cloneDefaultScenario()`. That's why the results skeleton only flashes briefly.
- **`runScenario(next)`**: bumps `requestRef`, sets the scenario, posts to the worker, and returns a Promise tracked in `pendingRef`. When a response comes back, only the **latest** `requestId` updates `result`/`isRunning`, so stale responses from earlier clicks are ignored. Older promises still resolve.
- `isStale` compares `JSON.stringify(scenario)` with `JSON.stringify(result.scenario)`. The Run button gets `data-stale` so it can be styled as "you have unrun edits".
- `restoreDefaults()` runs the default scenario again (the "Reset" button).
- Progress messages from the worker are **ignored** because there's no progress UI.
- **WebMCP tool:** if the browser exposes `document.modelContext.registerTool` (see `types/webmcp.d.ts`), the hook registers `run_beef_supply_chain_scenario`. An external AI agent can call it with `totalHead`, `horizonYears`, and optional prices, year, cadence, and seed. The tool mutates the current scenario, runs it (updating the visible dashboard), and returns headline numbers. This is separate from the built-in chat assistant.

---

## 6. Simulator UI (`/simulator`)

`app/simulator/page.tsx` → `components/simulator/simulator-page.tsx`

`SimulatorPage` wires everything together:
- `useSimulation()` state goes to `ScenarioPanel` (left rail) and `ResultsDashboard` (right).
- It owns `activeResultsPage` and `openScenarioSections` so the assistant snapshot can report which tab and sections are open.
- `getSnapshot()` builds a `DashboardSnapshot` (draft scenario, displayed result, stale/running flags, open tab and sections) for the assistant.
- It lazy-loads `AssistantWidget`.
- Navigation uses plain `<a>` tags on purpose, because the static export has no working client router.

### 6.1 `scenario-panel.tsx`: inputs

- **Calves entering:** a number input plus a **log-scale slider** (`headToSlider` / `sliderToHead`, 0–100 ↔ 1–30M).
- Time period (1–10 years → `horizonMonths`), cadence, and a 12-box monthly grid when the cadence is `custom`.
- Accordion sections, whose `value`s double as assistant `ScenarioSection` IDs: `prices`, `biology` ("Herd & costs", with a per-phase fieldset), `yield` ("Yields & trends"), `risk` ("Price swings"), `run` ("Simulation settings": reference year, runs, seed), and `sources`.
- **Changing the Reference year** calls `applyHistoricalYear` on the draft. Nothing reruns until you press **Run Simulation**.
- Edits only change the draft (`setScenario`). The model runs only on the button click.
- See **§7** for what every control does to the model.

`fields.tsx`:
- `NumberField` clamps to `[min, max]` (the default `min` is 0).
- `PercentField` stores a 0–1 fraction but edits whole percents.
- `SelectField` wraps Base UI Select, which needs `items` to render labels.

### 6.2 `results.tsx` and `results/*`: four tabs

| Tab (`ResultsPage` id) | Component | Shows |
|---|---|---|
| Total profit (`profit`) | `headline.tsx` | `chainEconomicProfit` (big number), P10–P90 `RangeBar`, cash profit, cattle finished (and % of calves), retail lbs, chance of loss |
| Profit by sector (`sectors`) | `sectors.tsx` | Diverging bar summary sorted by profit, plus a table: profit, per head (per *started* calf), margin, P10–P90 range bar on a shared domain, chance of loss |
| Cattle flow (`flow`) | `flow.tsx` | Stacked bar of completed / still in chain / mortality, then per-stage `exitedHead`, share, and avg exit weight, then died, still raised, and both break-even prices |
| Details (`details`) | `analysis.tsx` + `stage-economics.tsx` | Grouped bar chart (Recharts) and ledger table: money in (revenue + ending inventory), money out (acquisition + direct + overhead), cash profit, total profit. Then "Follow the money". |

`range-bar.tsx`:
- `domainAcross()` always includes 0 and pads 4%, so every bar shows its distance from break-even.
- `RangeBar` draws the band and the median tick.
- `RangeScale` labels P10, P90, and break-even, and hides the break-even label when it would collide.

`stage-economics.tsx` ("Follow the money") has a stage picker and:
- `STAGE_STORY`: static copy about what each stage earns and pays for.
- **Profit bridge:** money in → cattle purchased → operating → overhead → profit, per head **entering that stage** (`perHead()` divides by `enteredHead` and rounds values under $0.50 to 0).
- **Expense mix:** a stacked bar of acquisition, operating, and overhead.
- **Cost pressure:** a line chart of profit per head if direct and overhead costs move −20%…+20%. This is computed **in the component** (`profit − (direct + overhead) × change`), not by the engine.

`phases.ts` holds the shared `PHASE_ORDER` and `PHASE_META` colors. The trends page uses the same colors.

---

## 7. Every setting you can change

Every control in the Scenario panel, in the order it appears. For each one, this section gives its default, the range the UI allows, and exactly where it enters the math in `simulateTrial` (`lib/model/simulate.ts`).

**Who owns a setting.**
- **USDA** settings are overwritten whenever you change **Reference year** (`applyHistoricalYear`). Any manual edit to them is lost.
- **User** settings survive a year change.

Defaults are the 2025 profile plus `BASE_SCENARIO` (`lib/model/defaults.ts`). All number fields clamp at a minimum of 0 (`NumberField` in `fields.tsx`). Percent fields are typed as whole percents and stored as fractions.

Nothing reruns while you edit. Changes only update the draft scenario, and the Run button turns "stale" until you press it. **Reset** (top of the panel) restores every default and runs immediately.

### 7.1 Top of the panel: scale and timing

| Setting (code field) | Default | UI range | Owner | What it does |
|---|---|---|---|---|
| **Calves entering** (`totalHead`) | 100,000 | 1–30,000,000 (number box + log slider) | User | Total calves started. The model simulates `min(head, 2500)` sample animals and each represents `head / agents` real head, so totals scale linearly. Every per-stage total and the chain total scale with this value. |
| **Time period** (`horizonMonths`) | 2 years (24 mo) | 1–10 years | User | Hard stop for the simulation. A stage that can't finish before the end is prorated (costs × `completionRatio`) and the animal becomes **ending inventory**, valued at that stage's sale price. The full chain takes about 570 days (~18.7 months) by default, so short periods leave many cattle "Still in chain". |
| **When calves enter** (`cadence`) | Even monthly | Even / All upfront / Spring / Fall / Custom | User | Monthly entry weights (`cadenceWeights`). The 12-month pattern **repeats across the whole time period**, except All upfront, which puts every calf in month 0. Later entrants have less time left, so a back-loaded pattern means more unfinished inventory. |
| **Monthly weights** (`customCadence[12]`) | all 1 | ≥ 0, step 0.1; only shown when Custom is selected | User | Relative entry weights for Jan–Dec. They're normalized, so only the ratios matter. At least one must be > 0. |

### 7.2 Prices

All of these are **USDA**-owned: they're overwritten whenever the Reference year changes. Prices are multiplied by their trend (§7.4) and their random shock (§7.5) at the moment of sale.

| Setting (code field) | 2025 default | Used at | Formula |
|---|---|---|---|
| **Weaned calf** $/cwt (`calfPricePerCwt`) | 408.40 | Cow-calf sale = stocker purchase | `exitWeight/100 × price` |
| **Feeder cattle** $/cwt (`feederPricePerCwt`) | 321.86 | Stocker sale = feedlot purchase | `exitWeight/100 × price` |
| **Fed cattle** $/cwt (`fedPricePerCwt`) | 224.05 | Feedlot sale = packer purchase. Also the break-even cattle price. | `exitWeight/100 × price` |
| **Wholesale beef** $/lb (`wholesalePricePerLb`) | 5.455 | Packer sale = retail purchase | `retailLbs × price`, where `retailLbs = liveWt × dressing × saleable` |
| **Retail beef** $/lb (`retailPricePerLb`) | 8.842 | Retail sale. Also the break-even beef price. | `retailLbs × price` |
| **Feed** $/ton (`feedCostPerTon`) | 230 | **Feedlot only** | `feedIntake × daysOnFeed × price / 2000` |
| **Byproduct** $/head (`byproductCreditPerHead`) | 165 | Packer revenue only (the retailer doesn't pay for it) | Flat add-on per head. It **has no trend and no shock**. |

In the sensitivity analysis the assistant receives (not shown in the UI), all of these except the byproduct are flexed ±10%.

### 7.3 Herd & costs

| Setting (code field) | Default | UI range | Owner | What it does |
|---|---|---|---|---|
| **Start weight** lb (`startWeight`) | 85 | ≥ 0 | User | Calf weight entering cow-calf. Each animal's start weight gets a random factor (see Animal variation). |
| **Animal variation** % (`biologicalVariation`) | 7% | 0–100% | User | Size of the per-animal random noise. Start weight gets `1 + N·v·0.85` (clamped 0.80–1.20), each stage's **duration** gets `1 + N·v` (clamped 0.78–1.22), and each stage's **daily gain** gets `1 + N·v·0.7` (clamped 0.82–1.18). Because of the clamps, values above ~30% barely add more spread. At 0, every animal is identical. |

Then one fieldset per stage (Cow-calf, Stocker, Feedlot, Packer, Retail), each with the same six fields:

| Field (code field) | Owner | What it does |
|---|---|---|
| **Days** (`durationDays`) | User | Time in the stage (÷ 30.4375 for months). This sets when the sale happens, and therefore which trend month applies, how much of the time period is used, the daily-cost days, and the feedlot's days on feed. |
| **Daily gain** lb (`averageDailyGain`) | User | `exitWeight = weight + gain × days × gainFactor`. Weight drives every $/cwt sale and, through retail lbs, packer and retail revenue. |
| **Mortality** % (`mortalityRate`) | User | Chance an animal dies **at the end** of the stage, after that stage's costs are paid. A dead animal stops earning. |
| **Direct cost** $/head (`directCostPerHead`) | USDA | One-time cost, × `completionRatio` if the stage is cut short. Counts toward cash profit. |
| **Daily cost** $/head (`dailyCostPerHead`) | USDA | × days actually spent in the stage (yardage, pasture). Counts toward cash profit. |
| **Overhead** $/head (`economicCostPerHead`) | USDA | × `completionRatio`. It's subtracted **after** cash profit, so it separates "Cash profit" from "Total profit". |

Stage defaults (2025):

| Stage | Days | Daily gain | Mortality | Direct | Daily | Overhead |
|---|---|---|---|---|---|---|
| Cow-calf | 210 | 2.33 | 1.5% | $950 | $0 | $325 |
| Stocker | 150 | 1.5 | 0.8% | $60 | $0.95 | $80 |
| Feedlot | 180 | 3.3 | 1.2% | $150 | $0.55 | $70 |
| Packer | 7 | 0 | 0% | $475 | $0 | $220 |
| Retail | 23 | 0 | 0% | $0 | $0 | $0 |

Notes:
- Retail's real cost is the **hard-coded $1.55 per retail lb** added in code. It isn't one of these fields.
- Packer and retail "days" only affect timing.
- You *can* give packer or retail a daily gain or mortality, and the engine will apply it, even though that isn't physically meaningful.

### 7.4 Yields & trends

| Setting (code field) | Default | UI range | Owner | What it does |
|---|---|---|---|---|
| **Dressing yield** % (`dressingPercentage`) | 61.14% | 0–100% | USDA | Carcass ÷ live weight. It's part of `retailLbs = liveWt × dressing × saleable`, which sets packer revenue, retail revenue, retail's $1.55/lb cost, and "Beef produced". |
| **Saleable yield** % (`saleableYield`) | 67% | 0–100% | User | Share of the carcass sold as retail beef. It's the second factor in `retailLbs`. It's not in the USDA profile. It's a sensitivity driver (clamped to 40–85% there). |
| **Feed intake** lb/day (`feedDryMatterLbPerDay`) | 28 | ≥ 0 | User | Dry-matter ration per feedlot day. Used **only** in the feedlot feed cost. |
| **Cattle price trend** %/yr (`annualCattlePriceTrend`) | 0% | 0–50% | User | Compounding drift `price × (1+r)^(month/12)`, applied to the calf, feeder, **and** fed prices together at the month of each sale. |
| **Wholesale price trend** %/yr (`annualWholesalePriceTrend`) | 0% | 0–50% | User | Same drift, on the wholesale price at the packer sale. |
| **Retail price trend** %/yr (`annualRetailPriceTrend`) | 0% | 0–50% | User | Same drift, on the retail price at the retail sale. |
| **Feed cost trend** %/yr (`annualFeedCostTrend`) | 0% | 0–50% | User | Same drift, on the feed price. It uses the month the animal **enters** the feedlot, not the exit month. |

How trends work in practice:
- "Month" means months since the simulation started (month 0), not a calendar month.
- Trends apply only to **sales**. Ending inventory is valued at the *untrended* price (Gotcha 7).
- The UI clamps trends at 0%, so you can't model falling prices (Gotcha 2), even though the engine supports negative rates.

### 7.5 Price swings (market risk)

All are **User**-owned and apply only to the Monte Carlo runs. Each price gets **one** random multiplier per run: `exp(σ·z − σ²/2)`, which averages 1. The shock doesn't change month to month, and a 10-year run gets the same size of shock as a 1-year run.

| Setting (code field) | Default | What it does |
|---|---|---|
| **Calf price swing** (`calfVolatility`) | 12% | σ for the calf price shock |
| **Feeder price swing** (`feederVolatility`) | 10% | σ for the feeder price |
| **Fed price swing** (`fedVolatility`) | 8% | σ for the fed price |
| **Wholesale price swing** (`wholesaleVolatility`) | 6% | σ for the wholesale price |
| **Retail price swing** (`retailVolatility`) | 4% | σ for the retail price |
| **Feed cost swing** (`feedVolatility`) | 12% | σ for the feed price |
| **Correlation** (`commonMarketCorrelation`) | 0.65 | 0–1 in the UI (step 0.05), capped at 0.95 in code. It sets how much the five **price** shocks share one common "market" factor: `ρ·common + √(1−ρ²)·own`. Higher values make the prices move together, so the buy/sell spreads between adjacent stages vary less from run to run. |

Feed is always loaded **−0.2** on the common factor, regardless of the Correlation setting, so feed tends to get cheaper when cattle prices rise. Setting every swing to 0 makes P10 = median = P90 (there's a test for this).

### 7.6 Simulation settings

| Setting (code field) | Default | UI options | Owner | What it does |
|---|---|---|---|---|
| **Reference year** (`referenceYear`) | 2025 | 2015–2025 | — | Calls `applyHistoricalYear`, which overwrites **every USDA-owned field above**: 5 prices, feed, byproduct, dressing yield, and each stage's direct, daily, and overhead cost. Manual edits to those fields are lost. User-owned fields are untouched. |
| **Runs** (`trials`) | 250 | 100 / 250 / 500 / 1,000 | User | Number of Monte Carlo runs. More runs give stabler medians, P10/P90, and "Chance of a loss", and runtime grows linearly. **1,000 fails validation** (the maximum is 500, see Gotcha 1). |
| **Random seed** (`seed`) | 2025 | any integer (rounded) | User | Run *t* uses the PRNG seed `seed + t × 7919`. The same seed and inputs always give identical results, and a different seed gives a different draw of shocks and noise. |

### 7.7 Hard-coded constants you can't change in the UI

These are in `simulate.ts`:
- 2,500 sample animals maximum.
- 30.4375 days per month.
- **$1.55/lb retail handling cost**.
- Feed's −0.2 link to the common market factor.
- The noise multipliers and clamps listed above.
- Correlation capped at 0.95.
- Sensitivity uses ±10%.
- Mortality is applied at the end of a stage.

The last hard-coded value is in `scripts/data/refresh-historical-data.mjs`: the `BASE_2025` cost, feed, and byproduct values that every year's profile is indexed from.

---

## 8. Public pages (`/` and `/trends`)

These are server-rendered or static components with no simulation.

- `lib/trends/series.ts` is all the logic:
  - `SERIES` metadata (stage, product, unit, decimals, color) for the 5 chain prices plus feed.
  - `ROWS` is one row per year from the JSON.
  - `SERIES_SUMMARY` is computed once at module load: the latest value, the first-to-last `% change`, and an SVG `sparklinePath()`.
  - `formatValue`, `percentChange`, and `formatChange` (uses a real minus sign).
- `app/page.tsx` (home): hero, `ChainLedger` (5 `LedgerCell`s: latest price, sparkline, and 2015→latest change), and capability blurbs.
- `app/trends/page.tsx` → `TrendsDashboard` (client):
  - The selected series comes from `SeriesPicker`, which is the ledger as radio buttons with feed added as a 6th option.
  - From/through year selects are constrained so the window is always at least 2 years.
  - It computes first, last, change, high, and low within the window, then renders `TrendChart` (Recharts line, linear segments on purpose) and `SeriesTable`, where out-of-window rows are dimmed.
- `SiteHeader` / `SiteFooter`: nav and USDA source links (from `historicalData.sources`).
- `lib/site-fonts.ts`: the IBM Plex fonts load only on the public pages. The simulator uses Inter from `app/layout.tsx`.

---

## 9. The chat assistant

It's optional and BYOK ("bring your own key"). It has **no tools**. It answers from a big prompt plus a text dump of the screen. `docs/assistant.md` covers setup and deploy, and this section covers the logic.

### 9.1 Client: `components/assistant/assistant-widget.tsx`

- **Connect flow:** pick a provider, paste a key, then `validateConnection()` POSTs `/v1/validate`. The Worker makes a tiny "Reply OK" call to prove the key works. If it succeeds, `connected = true`.
- **Session state** (`lib/assistant/storage.ts`): the provider, key, messages, summary, and counts are saved to **`sessionStorage`** under `beef-dashboard-assistant-v2`. The key disappears when the tab closes.
- **Sending** (`submit`):
  1. It captures `getSnapshot()` into `snapshotRef`. `snapshotForPrompt()` blanks the `monthly` array because it isn't shown on screen.
  2. After 40 user messages, the next send starts a fresh chat (`resetChat`).
  3. `useChat` (AI SDK) with `DefaultChatTransport` POSTs to `/v1/chat`. `prepareSendMessagesRequest` adds `Authorization: Bearer <key>` and a body of `{provider, model, messages, snapshot, summary}`.
- **Compaction:** after each reply, if 12 or more user messages have been sent since the last compaction, **or** the estimated tokens (`JSON.length / 4`) reach 8,000 or more, it POSTs `/v1/compact`. It stores the returned summary and keeps only the last 12 messages (6 turns). If compaction fails, the full history is kept.
- **Rendering:** assistant markdown goes through `react-markdown` + GFM.
  - `resolveSourceTokens()` turns `[source:livestock]` into a link from `SOURCE_REGISTRY` and adds source cards.
  - `safeLink()` drops any URL that isn't a known USDA source, so the model can't inject arbitrary links.

### 9.2 Screen → text: `lib/assistant/context.ts`

- `describeDashboard(snapshot)` produces the "CURRENT DASHBOARD STATE" block:
  - **Status:** the open tab and sections, whether a run is in progress, and whether results are stale.
  - When results are stale, `describeScenarioDifferences()` diffs every labeled input (`INPUT_LABELS`) as `displayed → current`.
  - `describeScenario()`: every input, labeled exactly as the panel labels it.
  - `describeResults()`: every number on all four tabs, plus the engine's **sensitivity** table. That table isn't shown anywhere in the UI; the assistant is its only consumer.
- `hasStaleDisplayedResult()` is the same JSON comparison as `isStale` in the hook.

### 9.3 Prompt: `lib/assistant/prompt.ts` and `metrics.ts`

- `ASSISTANT_SYSTEM_PROMPT` is static and built once. It contains the scope rule plus the exact refusal string `DOMAIN_REFUSAL`, the UI layout, a prose description of the model mechanics, a **glossary** generated from `METRIC_REGISTRY` (`metrics.ts`), a table of **every USDA year's profile**, and the source list with `[source:ID]` tokens.
- `buildInstructions(snapshot, summary)` = system prompt + optional "SUMMARY OF EARLIER CONVERSATION" + `describeDashboard(snapshot)`.
- `metrics.ts`: `METRIC_REGISTRY` holds one entry per on-screen metric (label, unit, definition, kind, `historicalPath`, where it appears in the UI). `SOURCE_REGISTRY` covers the USDA sources plus a `model` pseudo-source. Tests check that every `historicalPath` resolves in every year.

### 9.4 Server: `workers/assistant-api.ts`

`fetch()` routing:
1. Rejects any origin that isn't localhost or in `ALLOWED_ORIGINS` (403).
2. Handles the `OPTIONS` preflight.
3. Accepts POST only on the three paths below.

| Endpoint | Does | Rate-limited? |
|---|---|---|
| `/v1/validate` | Zod `validateRequestSchema`, then `generateText("Reply with the single word OK")` | No |
| `/v1/compact` | `compactRequestSchema` (≤ 40 messages), then summarize in under 300 words, capped at 8,000 chars | No |
| `/v1/chat` | Rate limit → `assistantRequestSchema` (≤ 30 messages, strict snapshot shape) → `validateUIMessages` → `streamText` with `buildInstructions(...)` → UI message stream | **Yes** |

Shared guards:
- The body is capped at 512 KB (`readJson`).
- Each user message is capped at 8,000 chars (`hasOversizedUserMessage`).
- Answers are capped at 2,000 tokens.
- `redactedError()` maps provider HTTP codes (401/403, 429, 503/529) to fixed user-facing messages without leaking details.

`lib/assistant/`:
- `models.ts`: **one allowed model per provider** (`gpt-5-mini`, `gemini-2.5-flash`, `claude-sonnet-5`). Schemas reject any other provider/model pair.
- `provider.ts`: `createAssistantModel()` builds the AI SDK model with the user's key. `providerOptions()` keeps reasoning low: OpenAI `reasoningEffort: 'low'` with `store: false`, and a 512-token thinking budget for Gemini.
- `rate-limit.ts`:
  - `sha256(salt + ":ip:" + CF-Connecting-IP)` is the only identifier stored.
  - `consumeWindow()` does a fixed-window upsert into the D1 table `assistant_rate_windows`.
  - `consumeUserMessage()` allows **8 per minute and 80 per hour**.
- `migrations/0001` created the rate table plus a turn-lock table. `0002` dropped the turn-lock table, so rate windows are all that's left.

---

## 10. Build, deploy, and tooling

- **Build:** `vinext` (a Vite-based implementation of the Next.js app-router API) with `@cloudflare/vite-plugin` and `@openai/sites-vite-plugin`. `next.config.ts` sets `output: 'export'`, so the site is fully static in `dist/client`. `vite.config.ts` also wires placeholder D1/R2 bindings from `.openai/hosting.json` (both `null` currently).
- **Local dev:** `.claude/launch.json` defines `beef-chain-dev` (port 3000) and `assistant-api` (port 8788). The widget reads `VITE_ASSISTANT_API_URL` and defaults to `http://localhost:8787`.
- **CI:**
  - **PR** (`assistant-preview.yml`): test → typecheck → `configure-assistant-worker.mjs preview` → D1 migrate → deploy the preview Worker → set the salt secret → build with the preview API URL → Vercel preview deploy.
  - **Push to main** (`vercel-production.yml`): the same flow for production, then `vercel --prod`.
- `scripts/configure-assistant-worker.mjs`: strips JSONC comments and trailing commas, injects the real D1 ID and extra preview origin from env, rebases relative paths, and writes `.wrangler/assistant.generated.json`.
- `npm test` (Vitest, node env), `npm run typecheck`, `npm run lint` (oxlint), `npm run format` (oxfmt).

### Tests (`tests/`)

- `simulation.test.ts`:
  - Entry allocation is exact, and `upfront` puts everything in month 1.
  - Validation rejects bad inputs.
  - Historical overlay keeps the user's fields.
  - The engine is reproducible by seed.
  - Head counts reconcile and P10 ≤ median ≤ P90.
  - Ledgers add up and totals scale linearly with head count.
  - Packer and retail are kept separate.
  - Edge cases pass: 100% mortality, unfinished inventory, 30M head, 1 head, zero prices, and zero variance collapsing P10 = P90.
- `assistant.test.ts`: the metric registry is complete, the prompt includes every year and source, the dashboard description includes every value and flags stale inputs, and schemas accept only the curated models. The refusal string is checked verbatim.
- `assistant-rate-limit.test.ts`: the 9th message in a minute is blocked, the 81st in an hour is blocked, and the raw key is never stored (uses a fake D1).

---

## 11. Gotchas and mismatches worth knowing

These came up while tracing the code. None are fixed here.

1. **The "1,000 — most stable" Runs option always errors.** `TRIAL_OPTIONS` in `scenario-panel.tsx` offers 1000, but `validateScenario` caps trials at 500, so picking it shows "Trials must be between 1 and 500."
2. **Negative trends can't be entered.** The trend inputs are `PercentField`s, which clamp at `min = 0`, so the UI only allows flat or rising price and feed trends. The engine handles negative rates fine.
3. **"Saved baseline" comparison doesn't exist.** The README and the home page's capability copy both say results are compared against a locally saved baseline, but there's no baseline code (and no `localStorage` use) anywhere.
4. **The monthly profit series is computed but unused.** `SimulationSummary.monthly` isn't shown in the UI and is stripped from the assistant snapshot. The home page copy mentions "monthly profit".
5. **The assistant prompt misdescribes entry timing.** `prompt.ts` says calves enter "over the first 12 months". In fact `allocateEntryMonths` spreads entries over the **whole horizon** (repeating the 12-month pattern), except for `upfront`.
6. **The assistant may hit the 30-message schema cap after the first compaction.** Compaction keeps 12 messages and next triggers 12 user messages later. That's up to 12 + 24 messages, but `/v1/chat` rejects more than 30. Unless the 8,000-token size trigger fires first, about the 22nd user message returns "Invalid assistant request."
7. **Ending inventory is valued without the price trend.** Sales use `trend(price, …)`, but `terminalInventoryValue` uses the untrended base price. This only matters when trends are non-zero.
8. **The sensitivity base excludes mortality.** Deterministic runs skip the death draw, so `sensitivityBase` is a bit higher than a real run. It's only visible to the assistant.
9. **Per-head figures use different denominators.** The Sectors tab divides by *calves entering the chain*. The "Follow the money" bridge divides by *head entering that stage*. The same stage can show two different "per head" numbers.
10. **Retail handling cost is hard-coded** at $1.55 per retail lb in `simulateTrial`. It isn't an input and isn't in the USDA profile.
11. **Worker progress events are dropped.** The worker posts progress, but `useSimulation` has no handler for it.

---

## 12. Glossary: UI label ↔ code

| UI label | Code field |
|---|---|
| Total profit | `chainEconomicProfit` / `PhaseResult.economicProfit` |
| Cash profit | `chainOperatingContribution` / `operatingContribution` |
| Overhead | `economicCostPerHead` input → `economicCosts` |
| Direct cost / Daily cost | `directCostPerHead`, `dailyCostPerHead` → `directCosts` (+ feed at the feedlot, + $1.55/lb at retail) |
| Money in | `revenue + terminalInventoryValue` |
| Money out | `acquisitionCost + directCosts + economicCosts` |
| Still in chain / Still being raised | `endingInventoryHead` |
| Cattle finished | `completedHead` |
| Beef produced | `retailPounds` |
| Chance of a loss | `chainProbabilityOfLoss` / `probabilityOfLoss` |
| Range of outcomes / P10–P90 | `chainP10`, `chainP90` / `p10EconomicProfit`, `p90EconomicProfit` |
| Runs | `trials` |
| Animal variation | `biologicalVariation` |
| Price swings | `marketRisk.*Volatility`, `commonMarketCorrelation` |
| Reference year | `referenceYear` → `applyHistoricalYear()` |
