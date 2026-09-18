# Beef Chain Simulator

A browser-based planning model for exploring the economics of moving cattle through the U.S. beef supply chain: cow-calf, stocker, feedlot, packer, and retail.

## What it does

- Simulates 1 to 30 million calves over 1 to 10 years with weighted representative agents.
- Reports operating contribution and full economic profit by sector.
- Models mortality, biological variation, work-in-process inventory, correlated market risk, and price trends.
- Loads year-specific USDA market and cost profiles for every year from 2015 through 2025 while preserving the user's herd size, timing, cadence, and risk settings.
- Compares a current scenario against a locally saved baseline.
- Shows monthly profit, sector ledgers, risk ranges, break-even prices, and sensitivity results.

The bundled national reference assumptions are editable and intended for scenario planning. Results are not USDA forecasts or financial advice.

## Local development

```bash
npm install
npm run dev
```

Validation commands:

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

## Refreshing historical data

Historical ingestion is a standalone build step:

```bash
npm run data:refresh
```

The updater discovers the latest machine-readable download links from the USDA ERS landing pages, downloads and validates the source files, and regenerates `lib/data/historical-scenarios.json`. It only publishes a year when the required annual cost series and monthly price/weight observations are available, so a complete future year will appear in the app without changing the year selector by hand.

The profiles use annual cattle and retail-beef prices directly. The app's 2025 ration, phase-cost, and byproduct assumptions are indexed backward using USDA corn prices, cow-calf operating/overhead costs, and Choice beef byproduct values. This keeps the existing model structure while making the comparison reproducible and source-backed; the profiles remain planning assumptions rather than reconstructed financial statements for a representative operation.

## Reference data

- [USDA ERS Commodity Costs and Returns](https://ers.usda.gov/data-products/commodity-costs-and-returns)
- [USDA ERS Livestock and Meat Domestic Data](https://ers.usda.gov/data-products/livestock-and-meat-domestic-data)
- [USDA ERS Meat Price Spreads](https://www.ers.usda.gov/data-products/meat-price-spreads)
- [USDA ERS Feed Grains Database](https://www.ers.usda.gov/data-products/feed-grains-database/feed-grains-yearbook-tables)
- [USDA NASS Cattle Inventory](https://data.nass.usda.gov/Surveys/Guide_to_NASS_Surveys/Cattle_Inventory/)
