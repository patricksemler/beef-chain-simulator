# Beef Chain Simulator

A browser-based planning model for exploring the economics of moving cattle through the U.S. beef supply chain: cow-calf, stocker, feedlot, and combined packer/retail.

## What it does

- Simulates 1 to 30 million calves over 1 to 10 years with weighted representative agents.
- Reports operating contribution and full economic profit by sector.
- Models mortality, biological variation, work-in-process inventory, correlated market risk, and price trends.
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

## Reference data

- [USDA ERS Commodity Costs and Returns](https://ers.usda.gov/data-products/commodity-costs-and-returns)
- [USDA ERS Livestock and Meat Domestic Data](https://ers.usda.gov/data-products/livestock-and-meat-domestic-data)
- [USDA ERS Meat Price Spreads](https://www.ers.usda.gov/data-products/meat-price-spreads)
- [USDA NASS Cattle Inventory](https://data.nass.usda.gov/Surveys/Guide_to_NASS_Surveys/Cattle_Inventory/)
