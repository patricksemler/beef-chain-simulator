# Beef Chain Simulator: complete logic reference

This document covers all of the logic in the Beef Chain Simulator. It goes through every file that contains logic, every function in those files, and every setting and control available on the frontend. It's written in full sentences so it can be condensed into shorter prose. File paths are relative to the repository root, and line numbers point to where each function starts.

The only code it skips is the generic UI component library in `components/ui/*`, which is unmodified shadcn and Base UI building blocks (buttons, selects, tables, and so on), and the CSS in `app/globals.css`.

**Contents**

- Part 1: Overview of the system
- Part 2: Backend files and functions
  - 2A. Data pipeline and reference data
  - 2B. Simulation model
  - 2C. Running the model in the browser
  - 2D. Market trends data
  - 2E. Chat assistant (shared library)
  - 2F. Chat assistant (server)
  - 2G. Build, deployment, and configuration
  - 2H. Small utilities
- Part 3: Frontend logic (components that compute something)
- Part 4: Every setting and control on the frontend
- Part 5: What the tests guarantee
- Part 6: Reference numbers from a default run
- Part 7: Known issues and inconsistencies

---

# Part 1: Overview of the system

The Beef Chain Simulator models the economics of moving cattle through five stages of the U.S. beef supply chain: cow-calf, stocker, feedlot, packer, and retail. Each stage buys the animal (or its beef) from the previous stage, spends money raising or processing it, and sells it to the next stage. The model reports profit for each stage and for the chain as a whole. It uses Monte Carlo simulation, meaning it runs the scenario many times with random variation and reports the typical outcome and the range of outcomes.

The system has three parts:

1. **A data pipeline** (`scripts/data/refresh-historical-data.mjs`). A developer runs it by hand. It downloads USDA data and writes a JSON file of yearly price and cost profiles for 2015 through 2025.
2. **A static website** with three pages. The home page (`/`) and market trends page (`/trends`) display the USDA history. The simulator (`/simulator`) lets the user set up a scenario and run the model. The model runs entirely in the user's browser, in a background thread called a Web Worker, so no server does any calculation. The site is hosted on Vercel.
3. **An optional chat assistant.** It's a panel on the simulator page backed by a small Cloudflare Worker (a hosted serverless function). The Worker forwards questions to OpenAI, Google, or Anthropic using an API key the user supplies. The assistant can't change anything on the dashboard. It answers from a detailed text description of whatever is on screen.

The main flow of data is:

```
USDA websites → refresh script → historical-scenarios.json
    → historical.ts / defaults.ts (build scenarios)  → simulate.ts (run model) → results UI
    → series.ts (home and trends pages)
    → metrics.ts / prompt.ts (assistant knowledge)
```

---

# Part 2: Backend files and functions

## 2A. Data pipeline and reference data

### `lib/data/historical-scenarios.json`

This generated file holds all the reference data the app uses. Nobody should edit it by hand. It has these top-level fields:

- `generatedAt`: the date the file was produced.
- `availableYears`: the list of years with complete data (currently 2015 through 2025).
- `latestYear`: the most recent year (2025). It becomes the app's default year.
- `methodology`: five short text explanations of how each derived value was calculated (annual prices, feed cost, phase costs, byproduct credit, dressing percentage).
- `sources`: the four USDA sources, each with a label, organization, landing page, and the exact download URL used.
- `years`: one profile per year. Each profile contains:
  - Five prices: calf, feeder, and fed cattle in $/cwt, plus wholesale and retail beef in $/lb.
  - Feed cost ($/ton), byproduct credit ($/head), and dressing percentage.
  - For each of the five stages, a direct cost, a daily cost, and an overhead (economic) cost.
  - A `sourceMetrics` block with the raw USDA numbers the derived values came from: corn price, cow-calf operating and overhead cost per cow, and the Choice beef byproduct and wholesale values.

### `scripts/data/refresh-historical-data.mjs`

This Node.js script builds the JSON file above. It runs with `npm run data:refresh` and never runs inside the app.

**Constants.**
- `START_YEAR` (2015) is the first year to build.
- `OUTPUT_URL` is where the JSON is written.
- `SOURCES` lists the four USDA datasets. For each one it gives a label, a landing page, and a regular expression that matches the download link on that page:
  - `livestock`: Livestock and Meat Domestic Data (a ZIP file).
  - `priceSpreads`: Meat Price Spreads.
  - `cowCalf`: Commodity Costs and Returns, cow-calf.
  - `feedGrains`: Feed Grains Yearbook.
- `BASE_2025` holds the app's 2025 assumptions for feed cost ($230/ton), byproduct credit ($165/head), and every stage's three cost values. Every other year is derived by scaling these.
- `CATTLE_SERIES` maps each app price to the USDA series name it comes from:
  - Calf price is "Steers: medium and large #1 500-550 pounds".
  - Feeder price is "Steers: medium and large #1 750-800 pounds".
  - Fed price is "Steers 65-80 percent Choice".

**`fetchText(url)`** (line 82) downloads a web page as text, sending a custom user-agent header. It throws an error if the response isn't successful.

**`discoverDownload(source)`** (line 91) finds the current download link for a dataset. It loads the landing page, extracts every `href` link, and returns the first one that matches the source's regular expression, made into an absolute URL. The script does this instead of hard-coding the download URLs because USDA changes the version number in its download links whenever it updates a file.

**`download(url)`** (line 106) downloads a file as raw bytes and throws if the request fails.

**`csvRows(bytes)`** (line 115) decodes bytes as text and parses them as CSV into an array of objects, one per row, keyed by column name. It removes a byte-order mark, skips empty lines, and trims whitespace.

**`mean(values)`** (line 124) returns the arithmetic average of a list of numbers.

**`round(value, digits = 2)`** (line 128) rounds a number to a given number of decimal places. It adds a tiny epsilon to avoid floating-point rounding errors.

**`annualMonthlyMean(rows, yearKey, year, predicate, valueKey, minimumMonths = 12)`** (line 133) calculates a yearly average from monthly data:
1. It filters rows to the requested year, to months 1 through 12, and to rows that pass the `predicate` test (for example, "the series is fed steers").
2. It collects one value per month. The month number can appear in any of three column names, depending on the dataset.
3. If fewer than `minimumMonths` distinct months have a valid number, it returns `null`, meaning incomplete. Otherwise it returns the average of the monthly values.

**`annualCowCost(rows, year, item)`** (line 164) looks up one yearly value from the cow-calf cost file, such as "Total, operating costs" or "Total, allocated overhead", for the "U.S. total" region. It returns `null` if the value is missing.

**`annualCornPrice(rows, year)`** (line 175) looks up the annual "price received by farmers" for corn in dollars per bushel. It only returns a value if there's exactly one distinct number for that year, which guards against ambiguous data.

**`scaledPhaseCosts(operatingIndex, overheadIndex)`** (line 192) produces the three cost values for every stage in a given year:
- Each stage's direct cost and daily cost are the 2025 base values multiplied by the operating-cost index.
- Each stage's overhead is the 2025 base value multiplied by the overhead index.
- Both indexes come from the cow-calf cost series. So the stocker, feedlot, and packer costs are also scaled by how cow-calf costs changed, because USDA doesn't publish a comparable series for those stages.

**`fileFromZip(files, filename)`** (line 205) finds a file with the given name inside the unzipped livestock archive, and throws if it isn't there.

**`main()`** (line 214) runs the whole pipeline:
1. It discovers and downloads all four datasets in parallel.
2. It unzips the livestock archive and parses `LivestockPrices.csv`, `MeatStats.csv`, the price spreads file, the cow-calf file, and the feed grains file.
3. **It picks the reference year** (`latestCandidate`): the latest year that has a "U.S. total" row in the cow-calf file. It reads that year's operating cost, overhead, corn price, and byproduct value. These become the denominators of every index. If any are missing, the script stops with an error.
4. **For each year from 2015 to the reference year:**
   - **Prices.** Calf, feeder, and fed prices are yearly averages of monthly observations. The fed price accepts 11 months instead of 12, because USDA's January 2022 value is missing. Retail and wholesale beef come from the price spreads file in cents per pound, and the script divides them by 100.
   - **Dressing percentage** is average federally inspected dressed weight divided by average live weight.
   - **Feed cost** is $230 × (this year's corn price ÷ the reference year's corn price).
   - **Byproduct credit** is $165 × (this year's byproduct value ÷ the reference year's byproduct value).
   - **Stage costs** come from `scaledPhaseCosts`, using this year's cow-calf operating and overhead costs divided by the reference year's.
   - If any required input is missing, the year is skipped with a warning.
5. After the loop, it checks that every year from 2015 to the reference year was produced. If there's a gap, it stops with an error, so the app never ships with missing years.
6. It writes the JSON file, including the methodology text and the discovered download URLs.

## 2B. Simulation model

### `lib/model/types.ts`

This file defines the shape of everything the model reads and produces. It has no functions.

- **`PhaseKey`** is one of the five stage identifiers: `cowCalf`, `stocker`, `feedlot`, `packer`, `retail`.
- **`EntryCadence`** is one of `even`, `upfront`, `spring`, `fall`, `custom`. It sets when calves enter the chain.
- **`PhaseAssumptions`** holds the settings for one stage: a display label, `durationDays`, `averageDailyGain`, `mortalityRate`, `directCostPerHead`, `dailyCostPerHead`, and `economicCostPerHead` (the overhead).
- **`MarketRisk`** holds six price volatilities (calf, feeder, fed, wholesale, retail, feed) and `commonMarketCorrelation`.
- **`ScenarioInput`** is the complete set of inputs for one simulation: all top-level settings, the five `PhaseAssumptions`, and the `MarketRisk`. Part 4 describes every field.
- **`PhaseResult`** is the output for one stage:
  - Head counts: entered, exited, died, still in progress at the end.
  - Money: sales revenue, value of unsold animals (`terminalInventoryValue`), cost of buying animals (`acquisitionCost`), direct costs, overhead (`economicCosts`), cash profit (`operatingContribution`), and total profit (`economicProfit`).
  - Ratios: profit per started head, profit per exited head, and margin.
  - Uncertainty: P10 and P90 profit, and probability of loss.
  - Average exit weight.
- **`MonthlyResult`** holds one month's profit for each stage and for the whole chain.
- **`SensitivityResult`** records how chain profit changes when one input moves down or up 10%: the low result, the high result, and the swing.
- **`SimulationSummary`** is the complete output of a simulation:
  - The scenario that produced it and a data-vintage label.
  - All five `PhaseResult`s, the monthly series, the sensitivity list, and the sensitivity base case.
  - Chain-level totals: started, completed, died, and still-in-progress head; retail pounds; total and cash profit; P10 and P90; probability of loss.
  - Two break-even prices, a reconciliation check, and the runtime in milliseconds.
- **`SimulationProgress`** reports how many trials have finished out of the total.

### `lib/model/historical.ts`

This file connects the USDA JSON to the model.

**Constants.**
- `AVAILABLE_HISTORICAL_YEARS` and `LATEST_HISTORICAL_YEAR` are read directly from the JSON.
- `HISTORICAL_DATA_GENERATED_AT` and `HISTORICAL_METHODOLOGY` are also exported, but nothing currently uses them.
- The `HistoricalYear` type is built from the JSON's keys. TypeScript therefore knows exactly which years exist.

**`isHistoricalYear(year)`** (line 24) returns true if the year is one of the available profiles. TypeScript also treats it as a type check, so after a true result the year is known to be a valid `HistoricalYear`.

**`historicalDataVintage(year)`** (line 28) returns the label "Based on {year} USDA annual averages". It's stored on each result.

**`getHistoricalProfile(year)`** (line 32) returns the JSON profile for one year.

**`applyHistoricalYear(scenario, year)`** (line 42) loads a year's USDA data into a scenario:
1. It makes a deep copy of the scenario.
2. It sets the reference year.
3. It overwrites the data-backed fields: the five prices, feed cost, byproduct credit, dressing percentage, and each stage's direct, daily, and overhead costs.
4. It leaves everything else untouched: head count, time period, entry cadence, random seed, number of runs, animal variation, start weight, each stage's days, daily gain, and mortality, saleable yield, feed intake, trends, and price-swing settings.

The design is that USDA owns the market and cost data, and the user owns the herd, biology, timing, and risk assumptions.

### `lib/model/defaults.ts`

This file builds the default scenario.

- **`SOURCE_NOTES`** lists the five sources shown in the simulator's "Data sources" section: the four USDA ERS datasets plus the NASS cattle inventory survey.
- **`DATA_VINTAGE`** is the vintage label for the latest year. It's exported but unused.
- **`BASE_SCENARIO`** holds every default that doesn't come from USDA: 100,000 head, a 24-month period, even entry, seed 2025, 250 runs, 7% animal variation, an 85 lb start weight, 67% saleable yield, 28 lb/day feed intake, 0% trends, each stage's biology (days, gain, mortality), and the risk settings. It also contains price literals, such as a retail price of $8.17, but these are placeholders that get overwritten.
- **`DEFAULT_SCENARIO`** is `BASE_SCENARIO` with the latest USDA year applied by `applyHistoricalYear`. The effective default prices are therefore the 2025 USDA values (for example, retail $8.842/lb and calf $408.40/cwt), not the placeholders.
- **`cloneDefaultScenario()`** (line 125) returns a fresh deep copy of the default scenario. The Reset button and the first run on page load use it.

### `lib/model/simulate.ts`

This file is the simulation engine. Every result number in the app comes from here.

**Constants.**
- `PHASES` is the five stages in chain order.
- `MONTH_DAYS` (30.4375) is the average number of days in a month, used to convert stage durations from days to months.
- `Ledger` is an internal type for one stage's running totals before the uncertainty statistics are added.
- `TrialResult` is an internal type for the outcome of one run.

**`mulberry32(seed)`** (line 43) is a small, fast pseudo-random number generator. Given a seed, it returns a function that produces a repeatable sequence of numbers between 0 and 1. Because it's seeded, the same seed always produces the same results, which makes the whole simulation reproducible.

**`normal(random)`** (line 54) draws a random number from a standard normal (bell-curve) distribution using the Box–Muller method. It combines two uniform random numbers, and guards against taking the logarithm of zero.

**`percentile(values, quantile)`** (line 60) returns the value at a given percentile of a list, for example 0.1 for the 10th percentile or 0.5 for the median. It sorts a copy of the list and interpolates linearly between the two nearest values. It returns 0 for an empty list.

**`clamp(value, minimum, maximum)`** (line 70) limits a number to a range.

**`validateScenario(input)`** (line 74) checks a scenario and returns a list of error messages (empty if the scenario is valid). The rules:
- The reference year must be an available USDA year.
- Head count must be a whole number from 1 to 30,000,000.
- The time period must be a whole number of months from 12 to 120.
- Runs (trials) must be a whole number from 1 to 500.
- Animal variation must be between 0 and 1.
- The custom cadence must have exactly 12 non-negative values. If the cadence is custom, at least one of them must be above zero.
- Every stage's days and daily gain must be non-negative, and every mortality rate must be between 0 and 1.

**`cadenceWeights(cadence, custom)`** (line 127) returns 12 monthly weights for the entry pattern:
- `even` is twelve equal weights.
- `upfront` puts all the weight in the first month.
- `spring` and `fall` are hand-tuned seasonal curves peaking around April and October respectively.
- `custom` returns the user's own 12 numbers.

**`allocateEntryMonths(input)`** (line 137) decides exactly how many calves enter in each month of the time period:
1. It builds one weight per month of the whole period by repeating the 12-month pattern (month 13 uses January's weight, and so on). The exception is `upfront`, which gives the first month everything and every other month zero.
2. It scales the weights so they add up to the head count.
3. It rounds each month down to a whole number.
4. It gives the leftover head, one at a time, to the months with the largest fractional parts (the largest-remainder method).

The result always adds up exactly to the requested head count. Because the pattern repeats, calves keep entering throughout the whole period, not just in the first year.

**`emptyLedger(key, label)`** (line 164) creates a stage ledger with every total set to zero.

**`trend(base, annualRate, month)`** (line 183) applies a compounding annual trend to a price: `base × (1 + annualRate) ^ (month / 12)`. For example, a 5% annual trend at month 18 multiplies the price by about 1.076.

**`simulateTrial(input, trialIndex, deterministic = false)`** (line 187) runs the scenario once. This is the heart of the model.

*Setup.*
- It creates a random number generator seeded with `seed + trialIndex × 7919`, so each run is different but repeatable.
- It sets the number of simulated animals to the smaller of the head count and 2,500. Each simulated animal (an "agent") represents `head count ÷ agents` real animals. This weighting is what lets the model handle 30 million head as quickly as 2,500.
- It computes the monthly entry allocation and a running (cumulative) total of it, then creates empty ledgers for each stage and an empty monthly table.

*Market shocks.* Each run draws one random "market world" that stays fixed for the entire run:
- It draws one common market factor from a normal distribution.
- For each of the five cattle and beef prices, it creates a shock multiplier: `exp(σ × (ρ × common + √(1 − ρ²) × own) − σ²/2)`.
  - σ is that price's volatility setting.
  - ρ is the correlation setting, capped at 0.95.
  - "own" is a fresh random draw for that price alone.
- The shock follows a lognormal distribution with an average of 1. Correlation controls how much the prices share the common factor and therefore move together.
- Feed has its own shock with a fixed −0.2 link to the common factor. Feed therefore tends to get slightly cheaper when cattle and beef prices rise, whatever the correlation setting is.
- In deterministic mode, every shock is exactly 1.

*The agent loop.* For each simulated animal:
1. **Entry month.** The agent's weight is its share of the head count. The agent enters in the month where its midpoint position in the herd falls within the cumulative entry allocation.
2. **Start weight.** The start weight is the scenario's start weight times a random biological factor, `1 + normal × variation × 0.85`, clamped between 0.8 and 1.2. In deterministic mode the factor is 1.
3. **The stage loop.** The agent then goes through the five stages in order. For each stage:
   - **Stop check.** It stops if the time period is over, the animal has died, or it has already finished at retail.
   - **Entry.** It records the animal entering the stage and adds the purchase price to the stage's acquisition cost. The purchase price is what the previous stage sold it for, and it's zero at cow-calf because calves are born there, not bought.
   - **Duration.** It draws a random duration factor, `1 + normal × variation`, clamped between 0.78 and 1.22, and multiplies the stage's days by it.
   - **Completion ratio.** It computes how much of the stage fits in the time remaining: the months left divided by the stage's months, capped at 1. The days actually spent in the stage are the duration times this ratio.
   - **Weight gain.** It draws a random gain factor, `1 + normal × variation × 0.7`, clamped between 0.82 and 1.18. The exit weight is the current weight plus daily gain × days in the stage × gain factor.
   - **Costs.** All costs are prorated by the completion ratio:
     - Direct cost is the one-time cost times the completion ratio, plus the daily cost times the days in the stage.
     - At the feedlot only, feed cost is feed intake (lb/day) × days × the trended, shocked feed price ÷ 2,000 (the trend uses the month the animal entered the feedlot).
     - Overhead is the overhead cost times the completion ratio.
   - **Ending inventory.** If the stage can't be finished before the time period ends, the animal becomes ending inventory. It's valued at what it would sell for at that stage's price, using its current weight and the shocked price but no trend. The packer's valuation includes the byproduct credit. The retail valuation doesn't include the retail handling cost. The value is added to the stage's `terminalInventoryValue`, the animal is counted as still in the chain, and the agent stops.
   - **Mortality.** If the stage was finished, the model draws a random number. If it's below the stage's mortality rate, the animal dies: it's counted as a death and the agent stops. Deaths happen after the stage's costs are already spent. Deterministic mode never kills animals.
   - **Sale.** The current month advances by the stage's duration, the stage's exited head and exit weight are recorded, and the animal is sold. The sale price at each stage is:
     - **Cow-calf:** exit weight ÷ 100 × trended, shocked calf price. The stocker pays this amount.
     - **Stocker:** exit weight ÷ 100 × trended, shocked feeder price. The feedlot pays this.
     - **Feedlot:** exit weight ÷ 100 × trended, shocked fed price. The packer pays this. The model also keeps a running total of fed cattle weight sold (in hundredweight), which the break-even calculation needs.
     - **Packer:** retail pounds (exit weight × dressing percentage × saleable yield) × trended, shocked wholesale price, plus the byproduct credit. The retailer pays only the wholesale portion, because the byproducts are sold elsewhere.
     - **Retail:** the same retail pounds × trended, shocked retail price. The retailer also pays a fixed handling cost of $1.55 per retail pound, which is hard-coded, added to its direct costs. The animal counts as finished and its pounds are added to the chain's retail pounds.
   - **Monthly table.** The sale value is added to the monthly table in the month the sale happened.
4. **Stage totals.** After all agents finish, each stage's totals are calculated:
   - Cash profit (`operatingContribution`) = sales revenue + ending inventory value − acquisition cost − direct costs.
   - Total profit (`economicProfit`) = cash profit − overhead.
   - Average exit weight = total exit weight ÷ exited head.
5. **Chain totals.** Chain profit and chain cash profit are the sums across stages. Because each stage's purchase is the previous stage's sale, those transfers cancel out. Chain profit therefore works out to retail sales + packer byproduct credits + the value of all unsold animals − all direct costs and overhead.
6. **Monthly profit.** Each stage's total profit is spread across months in proportion to that stage's sales in each month. If a stage made no sales, all its profit goes in the last month. The chain's monthly figure is the sum of the stages. This is an allocation of profit over time, not a true monthly profit-and-loss statement.

*Return value.* The function returns the stage ledgers, the monthly table, finished head, deaths, ending inventory head, retail pounds, chain total and cash profit, and fed cattle weight sold.

**`aggregate(input, trials, runtimeMs)`** (line 471) combines all the runs into one summary. The trials arrive already sorted by chain profit.

- **The "base" trial.** It picks the middle trial (the median by chain profit).
- **Per-stage values:**
  - Every ledger line (revenue, ending inventory value, acquisition cost, direct costs, overhead, entered/exited/died/in-progress head, and exit weight) is replaced with **the median of that line across all trials, calculated separately for each line**.
  - Cash profit and total profit are then recalculated from those medians. The stage's ledger therefore always adds up, but it doesn't match any single trial.
  - Profit per started head = stage profit ÷ total head count. The denominator is every calf that entered the chain, not the head that entered this stage.
  - Profit per exited head and margin use the base trial for their denominators. Margin is profit ÷ (base trial's revenue + ending inventory value).
  - P10 and P90 profit are the 10th and 90th percentiles of that stage's profit across trials. Probability of loss is the share of trials in which that stage lost money.
- **Monthly series.** For each month and stage, it takes the median across trials, and the chain figure is the sum of those medians.
- **Chain values:**
  - Chain profit and cash profit are the sums of the stage medians.
  - P10, P90, and probability of loss come from each trial's own chain profit.
  - Finished head, deaths, and retail pounds are medians across trials.
  - Ending inventory head is **calculated** as head count − finished − deaths, so the reconciliation difference is always zero by construction.
- **Break-even prices:**
  - The **break-even beef price** is retail price − chain profit ÷ retail pounds, floored at zero. It's the retail price at which chain profit would be zero.
  - The **break-even cattle price** is fed price − feedlot profit ÷ fed cattle hundredweight sold, floored at zero. It's the fed price at which feedlot profit would be zero.
- **Sensitivity.** It calls `buildSensitivity` and runs one deterministic trial to get `sensitivityBase`.
- It records the scenario, the data vintage label, and the runtime.

**`buildSensitivity(input)`** (line 640) measures which inputs matter most. For each of seven drivers (retail beef price, wholesale beef price, fed cattle price, feeder cattle price, weaned calf price, feed cost, and saleable yield), it:
1. Makes two copies of the scenario, one with the driver lowered 10% and one raised 10%. Saleable yield is kept between 40% and 85%.
2. Runs one deterministic trial for each copy: no price shocks, no biological variation, and no deaths.
3. Records chain profit for both, and a swing equal to half the absolute difference.

The drivers are returned sorted from the largest swing to the smallest. This output isn't displayed anywhere on screen. Only the chat assistant receives it.

**`runSimulation(input, onProgress)`** (line 727) is the public entry point:
1. It validates the scenario and throws an error with every problem joined into one message if the scenario is invalid.
2. It runs one `simulateTrial` per requested run and calls the progress callback every 10 trials and on the last one.
3. It sorts the trials by chain profit and passes them to `aggregate` along with the elapsed time.

### `lib/model/format.ts`

This file contains number-formatting helpers built on the browser's `Intl.NumberFormat`, all in U.S. English:
- `compactCurrency` shows dollars in short form, for example "$76.5M".
- `currency` shows whole dollars, for example "$1,070".
- `compactNumber` shows short numbers, for example "13.2M".
- `whole` shows whole numbers with commas.
- `percent` shows a fraction as a percentage with up to one decimal place.

## 2C. Running the model in the browser

### `workers/simulation.worker.ts`

This file runs in a Web Worker, a background thread, so a long simulation doesn't freeze the page. When it receives a message containing a request ID and a scenario, it calls `runSimulation`:
- While the simulation runs, it posts a progress message every 10 trials.
- When it finishes, it posts a result message with the summary.
- If the simulation throws, it posts an error message with the error text.

Every message includes the request ID, so the page knows which request it belongs to.

### `lib/model/use-simulation.ts`

**`useSimulation()`** (line 19) is a React hook that owns all simulation state on the simulator page. It keeps:
- `scenario`: the draft the user is editing.
- `result`: the last completed summary.
- `isRunning`: true while a run is in progress. It starts as true, because a run begins automatically.
- `error`: the last error message.

Internally it also keeps a reference to the worker, a counter of request IDs, a map of requests still waiting for an answer, and a reference to the latest scenario.

- **`runScenario(nextScenario)`** (line 37):
  1. Rejects immediately if the worker hasn't started yet.
  2. Otherwise assigns the next request ID, stores the scenario as the current draft, sets running to true, and clears any error.
  3. Sends the scenario to the worker and returns a promise that resolves with the summary or rejects with an error.
- **Worker setup effect** (line 51). When the page loads, the hook:
  1. Creates the worker and listens for messages.
  2. When a result or error arrives, resolves or rejects the matching promise. It updates the displayed result, running flag, and error **only if the message belongs to the most recent request**. If the user clicks Run twice quickly, the older result can't overwrite the newer one.
  3. Ignores progress messages, because there's no progress bar.
  4. Immediately runs the default scenario.
  5. When the page unmounts, stops the worker and rejects any requests still waiting.
- **WebMCP tool effect** (line 85). WebMCP is an emerging browser standard that lets AI agents running in the browser call tools a page provides. If the browser supports it (`document.modelContext.registerTool`), the hook registers a tool called `run_beef_supply_chain_scenario`. This is separate from the chat assistant.
  - **Inputs:** a required head count (1 to 30,000,000) and time period in years (1 to 10). Optionally: reference year, cadence (any option except custom), any of the six prices, and a seed.
  - **What it does:**
    1. Starts from the current draft scenario.
    2. Checks the head count and years, and applies the reference year first if one was given.
    3. Overrides the cadence and any provided prices and seed.
    4. Runs the scenario, which updates the visible dashboard.
  - **Returns** the chain profit, cash profit, finished, died, and in-progress head, and P10 and P90.
- **`isStale`** (line 180) is true when a result is displayed, nothing is running, and the draft scenario differs from the scenario that produced the result. It compares the two as JSON text. It drives the Run button's "you have unsaved edits" styling.
- **`restoreDefaults()`** (line 185) runs a fresh copy of the default scenario. The Reset button uses it.

The hook returns the scenario and its setter, the result, the error, the running and stale flags, `runScenario`, and `restoreDefaults`.

## 2D. Market trends data

### `lib/trends/series.ts`

This file prepares USDA history for the home page and the trends page. It never runs the simulation.

- **`SERIES`** describes six price series: the five chain prices (weaned calf, feeder cattle, fed cattle, wholesale beef, retail beef) and the feed ration. For each one it gives the stage that sells at that price, the product, the unit, how many decimals to show, and the stage's color (matching the simulator's colors).
- **`CHAIN_SERIES`** is the five chain prices in chain order. **`ALL_SERIES`** adds feed at the end.
- **`YEARS`**, **`FIRST_YEAR`**, and **`LAST_YEAR`** come from the JSON's available years.
- **`ROWS`** is one row per year containing the six series values.
- **`DATA_SOURCES`** is the list of USDA sources from the JSON, used in the footer.
- **`formatValue(key, value)`** (line 107) formats a value as dollars with that series' number of decimals.
- **`percentChange(from, to)`** (line 111) returns the percentage change between two values.
- **`formatChange(change)`** (line 116) formats a percentage change with a plus sign or a real minus sign and one decimal, for example "+46.4%".
- **`sparklinePath(values, width, height)`** (line 126) builds an SVG line path through a list of values. It scales the values to fit a box of the given size with 2 pixels of padding, and returns an empty path if there are fewer than two values.
- **`SPARK_WIDTH`** (120) and **`SPARK_HEIGHT`** (32) are the sparkline box size.
- **`summarize(key)`** (line 160) returns a series' latest value, its percentage change from the first year to the last, and its sparkline path.
- **`SERIES_SUMMARY`** holds the summary for every series. It's calculated once when the module loads.

## 2E. Chat assistant (shared library)

These files are used by both the browser widget and the Cloudflare Worker.

### `lib/assistant/types.ts`

This file has type definitions only.
- **`AssistantProvider`**: `openai`, `google`, or `anthropic`.
- **`ResultsPage`**: the four results tab IDs, `profit`, `sectors`, `flow`, `details`.
- **`ScenarioSection`**: the six input panel sections, `prices`, `biology`, `yield`, `risk`, `run`, `sources`.
- **`DashboardSnapshot`**: a picture of the dashboard at the moment a question is asked. It holds a unique ID, a timestamp, the draft scenario, the displayed result (if any), whether results are stale, whether a run is in progress, the open results tab, and the expanded input sections.
- **`MetricKind`**: one of `usda_observation`, `derived_historical_assumption`, `scenario_input`, `simulation_output`.
- **`UiLocation`**: where a number appears, either a results tab or an input section.
- **`MetricDescriptor`**: describes one on-screen number: ID, label, unit, definition, kind, an optional path into the historical data, source IDs, optional methodology, and UI location.
- **`SourceCitation`**: a citable source with an ID, label, organization, and optional URL and methodology.
- **`AssistantSessionState`**: what's stored for a chat session. That's the provider, API key, session ID, messages, summary of older messages, and a count of user messages.

### `lib/assistant/models.ts`

- **`ASSISTANT_MODELS`** fixes exactly one model per provider, along with a display label and a key placeholder:
  - OpenAI: `gpt-5-mini`.
  - Google: `gemini-2.5-flash`.
  - Anthropic: `claude-sonnet-5`.
- **`ASSISTANT_PROVIDERS`** is the list of provider IDs.
- **`isAssistantProvider(value)`** (line 28) checks whether a value is a valid provider ID.
- **`isAllowedModel(provider, model)`** (line 37) checks whether a model is the approved one for a provider. It's exported but unused, because the schemas do this check themselves.

### `lib/assistant/provider.ts`

- **`createAssistantModel(provider, apiKey, model)`** (line 9) builds an AI SDK model object for the chosen provider, using the user's key:
  - OpenAI uses its Responses API; Google and Anthropic use their standard clients.
  - It throws if the model isn't the approved one for that provider.
- **`providerOptions(provider)`** (line 30) returns settings that keep answers fast:
  - OpenAI: low reasoning effort, with `store: false` so OpenAI doesn't keep the conversation.
  - Google: a 512-token thinking budget.
  - Anthropic: no special options.

### `lib/assistant/schemas.ts`

These are Zod validation schemas. Zod checks that incoming data has the right shape before the Worker uses it.

- **`providerSchema`** accepts only the three provider IDs.
- **`dashboardSnapshotSchema`** checks the snapshot's top-level shape:
  - An ID up to 100 characters, an ISO timestamp, booleans for stale and running, a valid tab ID, and a list of valid section IDs. It rejects unknown fields.
  - The draft scenario and displayed result are only checked as generic objects, not field by field.
- **`requireAllowedModel`** (line 21) is a shared rule that adds an error if the model isn't the approved one for the chosen provider.
- **`assistantRequestSchema`** checks a chat request: provider, model, 1 to 30 messages, a snapshot, and an optional summary up to 8,000 characters.
- **`validateRequestSchema`** checks a key-validation request, which has only provider and model.
- **`compactRequestSchema`** checks a compaction request: provider, model, 1 to 40 messages, and an optional previous summary up to 8,000 characters.

### `lib/assistant/rate-limit.ts`

- **`AssistantD1`** is a minimal interface for the Cloudflare D1 database (a hosted SQLite database), so tests can substitute a fake.
- **`sha256(value)`** (line 10) returns the SHA-256 hash of a string as hexadecimal text, using the Web Crypto API.
- **`consumeWindow(db, key, windowSeconds, limit, now)`** (line 18) implements a fixed-window counter:
  1. It works out the start of the current window by rounding the time down to a multiple of the window length.
  2. It inserts a row for this key and window with a count of 1, or adds 1 if the row already exists.
  3. It reads the count back.
  4. It returns whether the count is within the limit, and how many seconds remain until the window resets.
- **`consumeUserMessage(db, ipHash, now)`** (line 51) applies two limits for one hashed IP address: 8 chat messages per 60-second window and 80 per hour. It always counts the attempt against both windows. It returns the minute result if that's exceeded, otherwise the hour result if that's exceeded, otherwise an allowed result.

### `lib/assistant/storage.ts`

This file saves and loads the chat session in the browser's `sessionStorage`, which is cleared when the tab closes.

- **`STORAGE_KEY`** is `beef-dashboard-assistant-v2`.
- **`newSessionId()`** (line 7) creates a random unique ID.
- **`emptyAssistantSession(provider)`** (line 11) returns a blank session: no key, no messages, no summary, and a count of zero.
- **`loadAssistantSession()`** (line 24) reads the saved session. It checks each field's type and falls back to safe defaults. It returns a blank session if nothing is saved, the data is corrupt, the provider is invalid, or the code isn't running in a browser.
- **`saveAssistantSession(state)`** (line 52) writes the session to storage as JSON.
- **`estimatedConversationTokens(messages)`** (line 57) roughly estimates the size of a conversation in tokens: the length of the messages as JSON, divided by 4.

### `lib/assistant/metrics.ts`

This file defines the assistant's knowledge of on-screen numbers and sources.

- **`onPage(resultPage)`** (line 6) and **`inSection(section)`** (line 9) are small helpers that build a UI location.
- **`baseMetrics`** describes 20 numbers with their definitions and locations:
  - **Scenario inputs and USDA-derived values (10):** the five prices, feed cost, byproduct credit, dressing yield, saleable yield, and calves entering.
  - **Chain-level results (10):** total profit, cash profit, the P10–P90 range, chance of a loss, cattle finished, beef produced, deaths, still in chain, and the two break-even prices.
- **`PHASES`** lists the five stages, each with a key, a snake_case ID, and a label.
- **`phaseMetrics`** adds three entries for each stage: profit, margin, and direct cost. That's 15 more, for 35 in total.
- **`METRIC_REGISTRY`** is all 35 metrics. Every simulation output is automatically credited to the model plus all four USDA sources, because every result depends on all of them.
- **`METRIC_BY_ID`** is a lookup map from metric ID to metric. It's exported but unused.
- **`SOURCE_REGISTRY`** holds the citable sources: the four USDA sources from the JSON (`livestock`, `priceSpreads`, `cowCalf`, `feedGrains`) plus `model`, which represents the simulator itself.
- **`HISTORICAL_YEARS`** is a copy of the available years.

### `lib/assistant/context.ts`

This file turns the dashboard into text for the assistant.

- **`RESULT_PAGE_LABELS`** and **`SCENARIO_SECTION_LABELS`** map IDs to on-screen names (for example `biology` to "Herd & costs").
- **`CADENCE_LABELS`** and **`MONTHS`** are display names used in the text.
- **`hasStaleDisplayedResult(draft, result)`** (line 45) returns true if a result is displayed and the draft differs from the scenario that produced it. It uses the same JSON comparison as the hook.
- **Formatting helpers** (lines 55 to 62):
  - `money` shows short and full dollars.
  - `pct` shows percentages.
  - `perCwt`, `perLb`, and `perHead` add units.
  - `horizonLabel` turns months into years.
- **`describeScenario(scenario)`** (line 65) lists every input as a bulleted text block, using the same labels as the input panel:
  - Head count, time period, and cadence (including custom weights).
  - The prices.
  - Start weight and variation, then each stage's six values.
  - Yields, feed intake, and trends.
  - The price swings and correlation.
  - The simulation settings.
- **`INPUT_LABELS`** is a list of every labeled input, each paired with a function that reads its value as text.
- **`describeScenarioDifferences(draft, displayed)`** (line 142) compares every labeled input between the displayed scenario and the draft. It returns lines like "Retail beef price: $8.842/lb → $9.500/lb" for each one that changed.
- **`describeResults(result)`** (line 154) writes out every number on all four results tabs, tab by tab:
  - The headline values.
  - Each stage's profit, per-head profit, margin, range, and chance of loss.
  - The flow counts and break-evens.
  - The full money-in/money-out ledger.
  - The sensitivity table, which isn't on screen.
- **`describeDashboard(snapshot)`** (line 217) assembles the complete "CURRENT DASHBOARD STATE" block, in this order:
  1. A status section: open tab, expanded sections, whether a run is in progress, and whether results are stale. If they're stale, it adds a list of edited inputs.
  2. The scenario inputs, with a heading that says whether they produced the displayed results or are unrun edits.
  3. The results, or a note that none are displayed yet.

### `lib/assistant/prompt.ts`

This file builds the instructions sent to the language model.

- **`DOMAIN_REFUSAL`** is the exact sentence the assistant must use for off-topic questions.
- **`profile(year)`** (line 21) returns one year's USDA profile.
- **`locationText(metric)`** (line 27) describes where a metric appears, for example "Profit by sector" results tab, or Scenario panel › "Prices".
- **`glossary()`** (line 37) writes one line per metric in the registry: label, unit, definition, where it appears, and methodology if there is one.
- **`historicalTable()`** (line 46) writes two markdown tables covering every USDA year:
  - One of prices and yields: the five prices, feed, byproduct, dressing yield, and corn price.
  - One of stage costs (direct / daily / overhead for four stages, plus the USDA cow-calf cost per cow).
  - It also states the methodology and the generation date.
- **`sourceList()`** (line 76) lists every source with its citation token (for example `[source:livestock]`), organization, label, URL, and methodology.
- **`ASSISTANT_SYSTEM_PROMPT`** (line 87) is the fixed system prompt. It has seven sections:
  1. **Scope:** only answer about this dashboard, U.S. beef and cattle, and the USDA data, and use the refusal sentence otherwise.
  2. **Dashboard layout:** where every control and result lives, and that the assistant can't change anything itself.
  3. **How the model works:** a plain-English version of the mechanics described in Part 2B.
  4. **The glossary.**
  5. **The historical tables.**
  6. **The sources.**
  7. **How to answer:**
     - Treat the dashboard state as the only source of truth for current numbers.
     - Ask a clarifying question when a request is ambiguous.
     - Explain the reasons behind results using the actual numbers.
     - Say up front when results are stale.
     - Be concise and use the dashboard's units.
     - Cite sources with tokens.
     - Never claim to have changed anything.
- **`buildInstructions(snapshot, summary)`** (line 129) combines the system prompt, a summary of older conversation (if any), and the output of `describeDashboard`.

## 2F. Chat assistant (server)

### `workers/assistant-api.ts`

This is the Cloudflare Worker. It holds no API keys of its own; it only uses the key sent with each request.

**Environment.**
- `ASSISTANT_DB` is the D1 database.
- `IP_HASH_SALT` is a secret, at least 16 characters, mixed into IP hashes.
- `ALLOWED_ORIGINS` is a comma-separated list of sites allowed to call the Worker.

**Constants.** Requests are capped at 512,000 bytes, each user message at 8,000 characters, and each answer at 2,000 tokens.

**`allowedOrigin(origin, env)`** (line 36) allows any localhost or 127.0.0.1 address, on any port, plus any exact origin listed in `ALLOWED_ORIGINS`.

**`corsHeaders(origin)`** (line 44) returns the headers that allow the browser to call the Worker from that origin. They allow the Authorization and Content-Type headers and the POST and OPTIONS methods, and cache the permission for a day.

**`json(origin, body, status, headers)`** (line 54) builds a JSON response that includes the CORS headers and any extra headers.

**`redactedError(error)`** (line 68) turns a provider error into a safe message without exposing details. It looks for a status code, including inside a retry wrapper, and maps it:
- 401 or 403 becomes "The provider rejected this API key."
- 429 becomes a rate-limit or quota message.
- 503 or 529 becomes a high-demand message.
- Anything else becomes a generic failure message.

**`bearerKey(request)`** (line 86) extracts the API key from an `Authorization: Bearer ...` header.

**`readJson(request)`** (line 92) reads the request body. It rejects the body if either the declared size or the actual size is over 512,000 bytes, then parses it as JSON.

**`hasOversizedUserMessage(messages)`** (line 102) adds up the text length of each user message and returns true if any is over 8,000 characters.

**`handleValidate(request, origin)`** (line 120) checks that a key works:
1. It requires a key and a valid provider/model pair.
2. It makes a tiny request asking the model to reply "OK", limited to 64 tokens.
3. It returns success, or a redacted error.

This endpoint isn't rate-limited.

**`handleCompact(request, origin)`** (line 139) summarizes a long conversation:
1. It requires a key and a valid request with no oversized messages.
2. It asks the model for a summary under 300 words that keeps the questions asked, the dashboard values discussed, the conclusions, and the user's plans. It passes in the previous summary as well.
3. It limits the output to 800 tokens, cuts the text to 8,000 characters, and returns it.

This endpoint isn't rate-limited.

**`handleChat(request, env, origin)`** (line 160) answers a question:
1. It requires a key, and a salt of at least 16 characters (otherwise it returns "not configured").
2. It hashes the salt together with the caller's IP address (from Cloudflare's `CF-Connecting-IP` header) and applies the rate limit. If the limit is exceeded, it returns 429 with a `Retry-After` header.
3. It reads and validates the request, rejecting it if it's invalid or has an oversized message.
4. It validates the chat messages with the AI SDK and builds the instructions with `buildInstructions`.
5. It streams the model's answer back, with the answer limit, one retry, and the provider options. Errors during streaming are redacted.

**`assistantWorker.fetch(request, env)`** (line 212) is the entry point for every request:
1. It rejects requests from origins that aren't allowed, with a 403.
2. It answers the browser's OPTIONS pre-check.
3. It rejects anything other than POST.
4. It routes `/v1/validate`, `/v1/chat`, and `/v1/compact` to the handlers above, and returns 404 for anything else.
5. An oversized body returns 413, and any other parsing failure returns 400.

### `migrations/0001_assistant_limits.sql` and `0002_drop_turn_locks.sql`

The first migration created two tables:
- `assistant_rate_windows` holds a hashed key, window length, window start, and request count, with an index on window start.
- `assistant_turn_locks` was for an earlier design that locked conversations during a turn.

The second migration deleted the lock table. The only stored data is now hashed IP addresses, window times, and counts. No messages, keys, or raw IP addresses are ever stored.

## 2G. Build, deployment, and configuration

### `scripts/configure-assistant-worker.mjs`

This script runs in CI as `node scripts/configure-assistant-worker.mjs preview|production`:
1. It reads the environment's database ID from an environment variable.
2. It reads `wrangler.assistant.jsonc` and removes comments and trailing commas so it can be parsed as JSON.
3. It inserts the real database ID. For preview, it also adds an extra allowed origin if one is provided.
4. It rewrites relative file paths so they still work from the new location.
5. It writes the result to `.wrangler/assistant.generated.json`.

### `wrangler.assistant.jsonc`

This is the Worker's configuration file.
- **Production:** the Worker is named `beef-dashboard-assistant`, uses the production database, and allows only `https://beef-chain-simulator.vercel.app`.
- **Preview:** the Worker is named `beef-dashboard-assistant-preview`, uses a separate database, and allows localhost ports 3000 and 5173 plus a Vercel preview URL.

### `.github/workflows/assistant-preview.yml` and `vercel-production.yml`

These are the CI workflows.
- **On every pull request**, the preview workflow:
  1. Installs dependencies, runs the tests, and type-checks.
  2. Configures, migrates, and deploys the preview Worker, and sets its salt secret.
  3. Builds the site pointing at the preview Worker and deploys a Vercel preview.
- **On every push to `main`**, the production workflow does the same against the production Worker and deploys the site to Vercel production.

### Other configuration files

- **`vite.config.ts`** sets up the build:
  - Tailwind CSS; `vinext` (a Vite-based implementation of Next.js); an OpenAI sites plugin; and the Cloudflare plugin with placeholder local database and storage bindings, taken from `.openai/hosting.json`, where both are currently empty.
  - It keeps Wrangler logs inside the project.
  - It switches file watching to polling when running inside a particular macOS sandbox.
- **`next.config.ts`** sets `output: 'export'`, so the site builds to static files in `dist/client`.
- **`vitest.config.ts`** runs tests in `tests/` in a Node environment and maps the `@` import alias to the repository root.
- **`.claude/launch.json`** defines two local dev servers: the site on port 3000 and the assistant Worker on port 8788.
- **`.dev.vars.example`** is a template for the local Worker's salt secret.
- **`types/webmcp.d.ts`** declares the TypeScript types for the WebMCP browser API.
- **`types/vite-env.d.ts`** declares Vite's environment variable types.
- **The `VITE_ASSISTANT_API_URL` environment variable**, set at build time, tells the widget where the Worker is. It defaults to `http://localhost:8787`.

## 2H. Small utilities

- **`lib/utils.ts` → `cn(...inputs)`** merges CSS class names and resolves conflicting Tailwind classes.
- **`hooks/use-mobile.ts` → `useIsMobile()`** returns true when the window is narrower than 768 pixels, and updates when the window resizes. Only the stock sidebar component uses it.
- **`lib/site-fonts.ts`** loads the IBM Plex Serif and Mono fonts for the public pages only. The simulator uses the Inter font loaded in `app/layout.tsx`.

---

# Part 3: Frontend logic (components that compute something)

These components contain calculations or state logic, not just layout.

### `components/simulator/simulator-page.tsx` → `SimulatorPage`

This is the top-level simulator component.
- It calls `useSimulation()`.
- It tracks which results tab is open (default "Total profit") and which input sections are expanded (default "Prices").
- It passes state down to the input panel and the results.
- **`getSnapshot()`** builds a `DashboardSnapshot` for the assistant from the current draft, the displayed result, the stale and running flags, and the open tab and sections.
- It loads the assistant widget only when needed.
- Navigation uses plain links, because the static build has no working client-side router.

### `components/simulator/scenario-panel.tsx` → `ScenarioPanel`

This is the input panel.
- **`headToSlider(head)`** and **`sliderToHead(position)`** (lines 80 and 83) convert between head count and slider position on a logarithmic scale: position 0 is 1 head and position 100 is 30,000,000.
- **`tickLabel(value)`** (line 90) formats slider tick labels as "1", "100", "10K", "1M", "30M".
- **`updateNumber`**, **`updatePhase`**, and **`updateRisk`** (lines 119 to 139) update one field of the draft scenario, a stage's settings, or the risk settings.
- Changing the reference year calls `applyHistoricalYear` on the draft.
- The Run button calls `runScenario` with the draft, is disabled while a run is in progress, and is styled as stale when there are unrun edits.
- **`Section`** (line 657) is a helper that renders one collapsible section.

### `components/simulator/fields.tsx`

- **`NumberField`** (line 69) is a labeled number input. It ignores input that isn't a number and clamps the value between a minimum (0 by default) and an optional maximum.
- **`PercentField`** (line 117) shows a stored fraction as a percentage (0.07 as 7) and converts back when edited. Its maximum defaults to 100.
- **`SelectField`** (line 24) is a labeled dropdown.
- **`clamp`** and **`round`** (lines 146 and 151) are helpers.

### `components/simulator/results.tsx`

- **`RESULT_PAGES`** lists the four tabs.
- **`ResultsDashboard`** (line 17) shows a loading skeleton until the first result arrives, then **`ResultsPages`** (line 37), which shows the tab bar, the reference year, and the active tab's content.

### `components/simulator/results/headline.tsx` → `Headline`

The "Total profit" tab. It shows:
- Chain profit, in red if negative, with a P10–P90 range bar.
- Four statistics: cash profit, cattle finished (with its share of calves), beef produced, and chance of a loss. The chance of a loss is shown in red above 25%.

### `components/simulator/results/sectors.tsx` → `Sectors`

The "Profit by sector" tab.
- It sorts the stages from most to least profitable.
- It draws a summary bar chart where profit extends right and loss extends left from a center line, scaled to the largest absolute profit.
- It shows a table of each stage's profit, profit per started head, margin, a P10–P90 range bar on a shared scale, and chance of loss (in red above 50%).

### `components/simulator/results/flow.tsx` → `Flow`

The "Cattle flow" tab.
- A stacked bar splits all calves into finished, still in the chain, and died, as percentages.
- A row shows each stage's exited head, its share of all calves, and its average exit weight.
- A strip shows deaths, animals still being raised, and the two break-even prices.

### `components/simulator/results/analysis.tsx` → `Analysis`

The "Details" tab.
- It builds a ledger for each stage:
  - **Money in** = revenue + ending inventory value.
  - **Money out** = acquisition + direct costs + overhead.
  - **Cash profit** and **total profit**.
- It draws the ledger as a grouped bar chart, then shows it as a table.
- Below the table it renders `StageEconomics`.
- **`formatBarLabel`** formats chart labels. **`ChartKey`** draws a fixed legend.

### `components/simulator/results/stage-economics.tsx` → `StageEconomics`

This is the "Follow the money" section of the Details tab. The user picks a stage (default cow-calf).
- **`STAGE_STORY`** is fixed text describing where each stage's money comes from, what it pays for, and what it passes on.
- **`perHead(value, phase)`** (line 63) divides by **head entering that stage** (not all calves) and shows values under $0.50 as zero.
- **The profit bridge** shows, per head, money in, then cattle purchased, operating expenses, and overhead, ending with total profit.
- **The expense mix** shows each cost as a share of total costs.
- **Cost pressure** shows profit per head if direct and overhead costs all change by −20%, −10%, 0%, +10%, or +20%. It's calculated in the component as `profit − (direct + overhead) × change`, with revenue and purchase price held constant.

### `components/simulator/results/range-bar.tsx`

- **`domainAcross(values)`** (line 9) builds a chart scale that always includes zero and adds 4% padding. It returns −1 to 1 if all values are equal.
- **`position(value, domain)`** (line 22) converts a value to a percentage position on that scale.
- **`RangeBar`** (line 30) draws the P10–P90 band, a median marker, and a zero line, with a text description for screen readers.
- **`RangeScale`** (line 82) labels P10, P90, and "Break-even $0". It hides the break-even label when it would overlap the others.
- **`ScaleMark`** (line 108) keeps labels near the edges inside the bar.

### `components/simulator/results/phases.ts`

This file holds the stage order and the colors and labels used across all charts.

### `components/assistant/assistant-widget.tsx` → `AssistantWidget`

This is the chat panel.

Helpers:
- **`API_URL`** is the Worker address from the build variable.
- **`messageText(message)`** (line 36) joins a message's text parts.
- **`resolveSourceTokens(text)`** (line 43) replaces `[source:ID]` tokens with links to known sources and collects the IDs for source cards. Unknown IDs are removed.
- **`safeLink(url)`** (line 59) allows a link only if it's HTTPS and exactly matches a known source URL. This stops the model from inserting arbitrary links.
- **`snapshotForPrompt(snapshot)`** (line 67) empties the monthly series before sending, because it's not shown on screen.

The widget itself:
- **Session state.** It loads the saved session on start and saves it whenever anything changes.
- **Transport.** It sends each chat request with the key as a Bearer header, plus the provider, model, messages, snapshot, and summary.
- **Scrolling and keyboard.** It keeps the newest message in view, focuses the right field when the panel opens, and closes the panel on Escape.
- **`compact()`** (line 171):
  1. If connected and there are at least 12 messages, it calls `/v1/compact`.
  2. It stores the summary and keeps only the last 12 messages (6 exchanges).
  3. If compaction fails, it keeps the full history.
- **The compaction trigger** (line 210) runs `compact()` after an answer finishes, if either:
  - 12 or more user messages have been sent since the last compaction, or
  - the estimated conversation size is at least 8,000 tokens.
- **`resetChat()`** (line 219) starts a new session with the same provider and key.
- **`validateConnection()`** (line 231) calls `/v1/validate` with the trimmed key and marks the widget connected if it succeeds, or shows the error.
- **`disconnect()`** (line 261) clears the key and returns to the connect screen.
- **`submit()`** (line 271):
  1. Ignores empty messages, and ignores submits while busy or disconnected.
  2. Clears any previous error.
  3. Starts a new chat if 40 user messages have already been sent.
  4. Captures a fresh dashboard snapshot, then sends the message.
- **`ThinkingIndicator`** and **`AssistantMessageView`** render the "Thinking…" dots and each message. Assistant messages are rendered as markdown with the safe link rules and source cards.

### `components/trends/*` and `components/site/*`

- **`ChainLedger`** shows the five chain prices as a row of cells.
- **`LedgerCell`** shows one series' latest price, sparkline, and change since 2015.
- **`SeriesPicker`** is the same ledger with feed added, where each cell is a radio button.
- **`TrendsDashboard`**:
  - Tracks the selected series (default retail beef) and a year window (default the full range).
  - Restricts "From" to years before "Through" and vice versa, so the window always spans at least two years.
  - Filters the rows to the window and finds the first, last, highest, and lowest values and the percentage change.
- **`YearSelect`** is the year dropdown.
- **`TrendChart`** draws the selected series as a line chart with straight segments, because the data is yearly and a curve would suggest values that were never observed. **`ChartTip`** is its tooltip.
- **`SeriesTable`** shows every year and series, highlights the selected column, and dims years outside the window.
- **`SiteHeader`** and **`SiteFooter`** show navigation, the disclaimer, and source links.

### `app/*`

- **`app/layout.tsx`** sets the page title, description, icon, and default font.
- **`app/page.tsx`** is the home page: headline, introduction, links to the simulator and trends page, the chain ledger, and three capability descriptions.
- **`app/trends/page.tsx`** wraps the trends dashboard.
- **`app/simulator/page.tsx`** renders the simulator.

---

# Part 4: Every setting and control on the frontend

## 4.1 How settings behave

- **USDA-owned settings** are replaced whenever the Reference year changes. Manual edits to them are lost at that point.
- **User-owned settings** are kept when the year changes.
- **Editing doesn't run anything.** Every edit changes only the draft scenario. The model runs only when the user clicks **Run Simulation**. Until then, the button is styled to show there are unrun edits.
- **Clamping and rounding.** All number fields ignore non-numeric input and clamp at a minimum of 0. Percentage fields are typed as whole percentages but stored as fractions.
- **Validation errors.** If a run fails validation, the error message appears above the Run button.

## 4.2 Top of the Scenario panel

**Calves entering** (`totalHead`). User-owned. Default 100,000. Range 1 to 30,000,000.
- You can set it with a number box (rounded and clamped) or a logarithmic slider with ticks at 1, 100, 10K, 1M, and 30M.
- It's the total number of calves started over the whole time period.
- The model simulates at most 2,500 representative animals, each standing in for an equal share of the herd. All totals scale in proportion to the head count, but per-head results don't change with it.

**Time period** (`horizonMonths`). User-owned. Default 2 years. Options 1 to 10 years (12 to 120 months).
- It's the length of the simulation.
- Calves keep entering throughout the whole period.
- A stage that can't finish before the end is charged only for the portion completed, and the animal is counted as "still in chain", valued at its current stage's price.
- The complete chain takes about 570 days (18.7 months) by default. Short periods therefore leave most animals unfinished, and their unsold value makes up much of the reported profit.

**When calves enter** (`cadence`). User-owned. Default "Even monthly". Options:
- **Even monthly:** equal numbers each month.
- **All upfront:** every calf in the first month.
- **Spring weighted:** peaks March to May.
- **Fall weighted:** peaks August to November.
- **Custom weights:** the user's own pattern.

The 12-month pattern repeats across the whole period, except for All upfront. Entry timing affects how many animals finish before the period ends.

**Monthly weights** (`customCadence`). User-owned. Only shown for Custom weights. Twelve boxes, January to December, each 0 or more in steps of 0.1. Default all 1.
- Only the ratios between the months matter.
- If every month is zero, the run fails validation.

## 4.3 Prices section (all USDA-owned)

Each price is multiplied at the moment of sale by its trend (section 4.5) and its random shock (section 4.6).

- **Weaned calf** ($/cwt, `calfPricePerCwt`). 2025 default: $408.40.
  - It's the price at which cow-calf sells calves and the stocker buys them.
  - Sale value = exit weight ÷ 100 × price.
- **Feeder cattle** ($/cwt, `feederPricePerCwt`). 2025 default: $321.86.
  - It's the price at which the stocker sells and the feedlot buys.
- **Fed cattle** ($/cwt, `fedPricePerCwt`). 2025 default: $224.05.
  - It's the price at which the feedlot sells and the packer buys.
  - It's also the starting point for the break-even cattle price.
- **Wholesale beef** ($/lb, `wholesalePricePerLb`). 2025 default: $5.455. Step 0.01.
  - It's the price at which the packer sells beef and the retailer buys it.
  - Value = retail pounds × price, where retail pounds = live weight × dressing yield × saleable yield.
  - Because the packer's gain is exactly the retailer's cost, this price has no effect on chain profit. It only moves profit between the packer and the retailer.
- **Retail beef** ($/lb, `retailPricePerLb`). 2025 default: $8.842. Step 0.01.
  - It's the final consumer price the retailer receives.
  - It's the most influential input on chain profit and the starting point for the break-even beef price.
- **Feed** ($/ton, `feedCostPerTon`). 2025 default: $230.
  - It's the feedlot ration price and the only feed cost in the model.
  - Feed cost = feed intake × days on feed × price ÷ 2,000.
- **Byproduct** ($/head, `byproductCreditPerHead`). 2025 default: $165.
  - It's extra revenue the packer earns per animal from hides, offal, and other byproducts.
  - It has no trend and no random shock, and the retailer doesn't pay for it.

## 4.4 Herd & costs section

**Start weight** (lb, `startWeight`). User-owned. Default 85.
- It's the calf's weight when it enters cow-calf.
- It's randomly varied per animal by Animal variation.

**Animal variation** (%, `biologicalVariation`). User-owned. Default 7%. Range 0 to 100%.
- It controls how much individual animals differ. It varies each animal's:
  - Start weight, by variation × 0.85, capped at ±20%.
  - Time in each stage, by the full variation, capped at ±22%.
  - Daily gain in each stage, by variation × 0.7, capped at ±18%.
- Because of the caps, values above about 30% add little extra spread.
- At 0%, every animal is identical.

**Per-stage settings.** For each of Cow-calf, Stocker, Feedlot, Packer, and Retail there are six fields:

- **Days** (`durationDays`). User-owned.
  - It's how long the animal spends in the stage.
  - It sets when the sale happens (and therefore which trend month applies), how much of the time period is used, how many days the daily cost is charged, and, at the feedlot, the days on feed.
- **Daily gain** (lb, `averageDailyGain`). User-owned. Step 0.01.
  - It's the weight added per day.
  - Exit weight = weight + daily gain × days × random gain factor.
  - Weight drives every per-hundredweight price and, through retail pounds, packer and retail revenue.
- **Mortality** (%, `mortalityRate`). User-owned.
  - It's the chance an animal dies at the end of the stage, after that stage's costs are paid.
  - Dead animals stop producing revenue.
- **Direct cost** ($/head, `directCostPerHead`). USDA-owned.
  - It's a one-time cost per animal, reduced in proportion if the stage is cut short.
  - It's part of cash profit.
- **Daily cost** ($/head, `dailyCostPerHead`). USDA-owned. Step 0.01.
  - It's a cost per animal per day actually spent in the stage, such as yardage or pasture.
  - It's part of cash profit.
- **Overhead** ($/head, `economicCostPerHead`). USDA-owned.
  - It's a per-animal charge for land, capital, and management, reduced in proportion if the stage is cut short.
  - It's subtracted after cash profit, so it's the difference between "Cash profit" and "Total profit".

2025 default values for each stage:

| Stage | Days | Daily gain | Mortality | Direct cost | Daily cost | Overhead |
|---|---|---|---|---|---|---|
| Cow-calf | 210 | 2.33 lb | 1.5% | $950 | $0 | $325 |
| Stocker | 150 | 1.5 lb | 0.8% | $60 | $0.95 | $80 |
| Feedlot | 180 | 3.3 lb | 1.2% | $150 | $0.55 | $70 |
| Packer | 7 | 0 | 0% | $475 | $0 | $220 |
| Retail | 23 | 0 | 0% | $0 | $0 | $0 |

Notes on these defaults:
- Retail's real cost is the hard-coded $1.55 per retail pound, which isn't one of these fields.
- For the packer and retail stages, days affect timing only.
- The model will apply gain or mortality to the packer and retail stages if the user enters them, even though that isn't physically meaningful.

## 4.5 Yields & trends section

**Dressing yield** (%, `dressingPercentage`). USDA-owned. 2025 default: 61.14%.
- It's carcass weight as a share of live weight.
- It's the first factor in retail pounds, which determine packer revenue, retail revenue, retail's handling cost, and "Beef produced".

**Saleable yield** (%, `saleableYield`). User-owned. Default 67%.
- It's the share of the carcass that becomes saleable retail beef.
- It's the second factor in retail pounds.
- It's the second most influential input on chain profit.

**Feed intake** (lb/day, `feedDryMatterLbPerDay`). User-owned. Default 28. Step 0.1.
- It's pounds of dry-matter feed per animal per day at the feedlot.
- It's used only in the feedlot feed cost.

**Cattle price trend** (%/yr, `annualCattlePriceTrend`). User-owned. Default 0%. Range 0 to 50%.
- It's a compounding annual change applied to the calf, feeder, and fed prices together, at each sale's month: price × (1 + rate) ^ (months since start ÷ 12).

**Wholesale price trend** (%/yr, `annualWholesalePriceTrend`). User-owned. Default 0%. Range 0 to 50%.
- The same kind of trend, applied to the wholesale price at the packer sale.

**Retail price trend** (%/yr, `annualRetailPriceTrend`). User-owned. Default 0%. Range 0 to 50%.
- The same kind of trend, applied to the retail price at the retail sale.

**Feed cost trend** (%/yr, `annualFeedCostTrend`). User-owned. Default 0%. Range 0 to 50%.
- The same kind of trend, applied to the feed price.
- It uses the month the animal enters the feedlot.

How trends work in practice:
- Months are counted from the start of the simulation, not the calendar.
- Trends apply only to sales. Unsold animals are valued at untrended prices.
- The interface doesn't allow negative trends, although the model supports them.

## 4.6 Price swings section (all user-owned)

These settings only affect the random runs. In each run, every price gets one random multiplier that averages 1 and lasts for the whole run. A 10-year run therefore gets the same size of price shock as a 1-year run.

- **Calf price swing** (`calfVolatility`). Default 12%.
- **Feeder price swing** (`feederVolatility`). Default 10%.
- **Fed price swing** (`fedVolatility`). Default 8%.
- **Wholesale price swing** (`wholesaleVolatility`). Default 6%.
- **Retail price swing** (`retailVolatility`). Default 4%.
- **Feed cost swing** (`feedVolatility`). Default 12%.
- **Correlation** (`commonMarketCorrelation`). Default 0.65. Range 0 to 1 in steps of 0.05, capped at 0.95 inside the model.
  - It controls how strongly the five cattle and beef prices move together.
  - At 0 they move independently; near 1 they move almost in lockstep.
  - Feed always has a small fixed tendency to move the opposite way, whatever this setting is.

Setting every swing to zero makes P10, the median, and P90 identical, apart from variation from animal biology and mortality.

## 4.7 Simulation settings section

**Reference year** (`referenceYear`). Default 2025. Options 2015 to 2025.
- It loads that year's USDA profile, replacing every USDA-owned setting: the seven prices, dressing yield, and each stage's direct, daily, and overhead costs.
- User-owned settings are unaffected.

**Runs** (`trials`). User-owned. Default 250. Options 100, 250, 500, and 1,000.
- It's the number of random runs.
- More runs give steadier medians, ranges, and loss probabilities, and runtime grows in proportion.
- The 1,000 option currently fails validation, because the maximum is 500.

**Random seed** (`seed`). User-owned. Default 2025. Any whole number (rounded).
- It's the starting point for the random number generator. Run number *t* uses seed + *t* × 7919.
- The same seed and settings always give identical results.

## 4.8 Data sources section

This section lists the five sources in `SOURCE_NOTES` as external links. It has no effect on the model.

## 4.9 Other controls on the simulator page

- **Run Simulation** runs the draft scenario. It's disabled while running and styled differently when there are unrun edits.
- **Reset** restores every setting to the default and runs immediately.
- **Results tabs** switch between Total profit, Profit by sector, Cattle flow, and Details.
- **Stage picker** (Details tab, "Follow the money") chooses which stage the profit bridge, expense mix, and cost pressure chart describe. The default is cow-calf.
- **Home** and **Market trends** links navigate away.
- **Skip to results** is a keyboard shortcut link to the results.

## 4.10 Chat assistant controls

- **Ask** (the launcher button) opens the chat panel.
- **Provider** chooses OpenAI (gpt-5-mini), Google Gemini (gemini-2.5-flash), or Anthropic Claude (claude-sonnet-5).
- **API key** is the user's own key. It's kept in the browser tab's session storage only.
- **Connect** checks the key with the Worker before enabling chat.
- **Message box:**
  - Enter sends and Shift+Enter adds a new line.
  - Messages are capped at 8,000 characters.
  - The placeholder suggests a question about the displayed reference year.
- **Send** or **Stop** sends the message, or stops an answer while it's being written.
- **New chat** (+) clears the conversation but keeps the key.
- **Change key** disconnects and returns to the key screen.
- **Close** (the X button, or Escape) hides the panel.

Automatic behavior:
- Older messages are condensed into a summary after 12 user messages or about 8,000 tokens.
- A new chat starts automatically after 40 user messages.
- Each IP address is limited to 8 messages per minute and 80 per hour.

## 4.11 Market trends page controls

- **Series picker**: six options (weaned calf, feeder cattle, fed cattle, wholesale beef, retail beef, feed ration). Default retail beef.
- **From** and **Through**: the year window, 2015 to 2025, constrained so it always spans at least two years. The chart, the summary figures (first, last, change, high, low), and the table's highlighting follow the window.

---

# Part 5: What the tests guarantee

The tests run with `npm test`, in CI before every deployment.

**`tests/simulation.test.ts`** checks that:
- Entry allocation adds up exactly to the head count, and "upfront" puts everyone in month one.
- Validation rejects bad head counts, time periods, custom cadences, and years without a USDA profile.
- Every year from 2015 to 2025 is present, loading a year keeps user-owned settings, and different years give different stage results.
- The same seed gives identical results.
- Head counts reconcile, P10 ≤ median ≤ P90, and every stage's ledger adds up.
- Totals scale in proportion to the head count.
- Packer and retail are accounted for separately.
- The model handles 100% mortality, unfinished animals, 30 million head (without creating one object per animal), a single animal, and zero prices with extreme costs without breaking.
- Removing all randomness collapses the range to a single value.

**`tests/assistant.test.ts`** checks that:
- Metric IDs are unique, every historical path resolves for every year, and every metric has a definition, unit, and valid source.
- The system prompt contains the glossary, every year, and every source.
- The instructions include the summary and dashboard state.
- The dashboard description includes every displayed value, flags stale results with the edited inputs, and handles the "no results yet" case.
- Only the approved model for each provider is accepted.
- A chat request with a snapshot and summary is accepted.
- The refusal sentence is exact.

**`tests/assistant-rate-limit.test.ts`** checks, using a fake database, that the ninth message in a minute is blocked, that the 81st in an hour is blocked, and that no raw key is ever stored.

---

# Part 6: Reference numbers from a default run

These are the actual results of the default scenario (2025 USDA year, 100,000 calves, 2 years, even entry, seed 2025, 250 runs). They're useful as concrete examples.

**Chain results:**
- Total profit is $76.5 million (P10 $60.6M, P90 $95.8M), and cash profit is $118.6M.
- The chance of a loss is 0%.

**Head counts:**
- 23,200 calves finish, 74,920 are still in the chain when the period ends, and 1,880 die.

**Beef and break-evens:**
- Beef produced is 13.2 million retail pounds.
- The break-even beef price is $3.04/lb and the break-even cattle price is $288.13/cwt.

**By stage:**

| Stage | Total profit | Chance of loss |
|---|---|---|
| Cow-calf | +$93.9M | 0% |
| Stocker | −$9.1M | 70% |
| Feedlot | −$24.2M | 97% |
| Packer | −$14.4M | 99% |
| Retail | +$30.3M | 0% |

**Sensitivity (swing in chain profit for a ±10% change):**

| Input | Swing |
|---|---|
| Retail beef price | $14.7M |
| Saleable yield | $12.5M |
| Fed cattle price | $6.0M |
| Feeder cattle price | $4.5M |
| Weaned calf price | $3.4M |
| Feed cost | $2.3M |
| Wholesale beef price | $0 |

**One animal through the chain** (2025 defaults, no randomness, finishing every stage):

| Stage | Exit weight | Money in | Paid for animal | Running costs | Overhead | Profit |
|---|---|---|---|---|---|---|
| Cow-calf | 574 lb | $2,345 | $0 | $950 | $325 | +$1,070 |
| Stocker | 799 lb | $2,573 | $2,345 | $203 | $80 | −$55 |
| Feedlot | 1,393 lb | $3,122 | $2,573 | $829 | $70 | −$350 |
| Packer | 571 retail lb | $3,278 | $3,122 | $475 | $220 | −$538 |
| Retail | — | $5,047 | $3,113 | $885 | $0 | +$1,048 |
| Chain | | | | | | about +$1,176 |

Why the stages come out this way:
- **Stocker:** heavier cattle sell for less per hundredweight.
- **Feedlot:** each pound gained is worth about $0.92 but costs about $1.51.
- **Packer:** its $157 margin can't cover $695 of processing and overhead.
- **Retail:** it keeps a wide price spread on every pound.

**Why the break-even beef price looks so low.** Most of the default run's profit comes from unsold animals valued at market price, but the formula divides chain profit only by beef actually sold. With a longer time period the figure becomes realistic.

---

# Part 7: Known issues and inconsistencies

1. **The "1,000 runs" option always fails.** The Runs dropdown offers it, but validation only allows up to 500.
2. **Negative trends can't be entered.** Percentage fields don't go below zero, so falling prices can't be modeled from the interface, even though the model supports them.
3. **The "saved baseline" comparison doesn't exist.** The README and home page both say results are compared against a saved baseline, but no such feature is implemented.
4. **The monthly profit series is never shown.** The model calculates it, but no part of the interface displays it, and the assistant snapshot removes it. The home page still mentions "monthly profit".
5. **The assistant's prompt describes entry timing incorrectly.** It says calves enter over the first 12 months, but the model spreads entries across the whole time period.
6. **Long chats may fail.** After the first compaction, the chat can grow past the Worker's 30-message limit (around the 22nd user message) unless the size-based compaction triggers first, at which point requests are rejected.
7. **Unsold animals are valued at untrended prices**, while sales use trended prices.
8. **The sensitivity base case ignores mortality**, because deterministic runs never kill animals.
9. **"Per head" means two different things.** The Profit by sector tab divides by all calves started. The "Follow the money" section divides by head entering that stage.
10. **The retail handling cost is hard-coded** at $1.55 per retail pound, and isn't a setting or USDA value.
11. **Worker progress messages are ignored**, because there's no progress indicator.
12. **The break-even beef price is misleading for short time periods**, as explained in Part 6.
13. **Rate limiting counts rejected requests.** Chat attempts count against the rate limit even if the request turns out to be invalid, and an attempt blocked by the per-minute limit still counts toward the hourly limit.
14. **Oversized chat requests get the wrong error.** An oversized body sent to `/v1/chat` gets a generic "provider request failed" message instead of the "request too large" message the other endpoints give.
15. **Some exports are unused:** `DATA_VINTAGE`, `HISTORICAL_DATA_GENERATED_AT`, `HISTORICAL_METHODOLOGY`, `METRIC_BY_ID`, and `isAllowedModel`.
16. **The refresh script's base values will drift.** `BASE_2025` is named for 2025, but it's always applied to the latest year USDA has published. When a newer year arrives, the base values will be treated as that year's values without anyone noticing.
