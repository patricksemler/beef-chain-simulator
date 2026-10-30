/**
 * # Assistant.Test
 *
 * ## What this file is for
 * This file helps run the simulator experience and shows the controls and results people use to test scenarios.
 *
 * ## What it does
 * - Helps the app show the right page, section, or feature.
 * - Accepts or sends data needed by the rest of the app.
 * - Keeps the code organized so it is easier to understand and update.
 *
 * ## Main pieces in this file
 * - `main logic`: the main thing this file provides to the app.
 * - Other small helper functions or values support that main work.
 *
 * ## Important tools and connections
 * - Uses project code and libraries that help the app run smoothly.
 * - Works with the rest of the simulator, dashboard, or UI layers.
 *
 * ## How data moves through it
 * Data usually comes in from a user action or from another part of the app. This file reads that information, applies the needed logic, and then sends it on or displays it on screen.
 *
 * ## Errors and edge cases
 * The code checks for missing, unusual, or invalid values and tries to handle them safely. If something is not valid, it usually falls back to a safe default or prevents the bad input from continuing.
 *
 * ## How it fits into the app
 * This file is one small part of the larger system. It connects to other sections so the app feels like one working tool instead of separate pieces.
 *
 * ## Helpful notes
 * The goal here is to keep the code simple, clear, and easy to maintain without changing how the app behaves.
 */
import { describe, expect, it } from 'vitest';
import historicalData from '../lib/data/historical-scenarios.json';
import {
  describeDashboard,
  describeScenarioDifferences,
} from '../lib/assistant/context';
import { hasStaleDisplayedResult } from '../lib/dashboard';
import {
  HISTORICAL_YEARS,
  METRIC_REGISTRY,
  SOURCE_REGISTRY,
} from '../lib/assistant/metrics';
import { ASSISTANT_MODELS } from '../lib/assistant/models';
import {
  ASSISTANT_SYSTEM_PROMPT,
  buildInstructions,
  DOMAIN_REFUSAL,
} from '../lib/assistant/prompt';
import {
  assistantRequestSchema,
  validateRequestSchema,
} from '../lib/assistant/schemas';
import type { DashboardSnapshot } from '../lib/assistant/types';
import { cloneDefaultScenario } from '../lib/model/defaults';
import { compactCurrency, currency } from '../lib/model/format';
import { runSimulation } from '../lib/model/simulate';

function readPath(value: unknown, path: string) {
  return path.split('.').reduce<unknown>((current, key) => {
    if (current === null || typeof current !== 'object') return undefined;
    return (current as Record<string, unknown>)[key];
  }, value);
}

function snapshot(): DashboardSnapshot {
  const scenario = cloneDefaultScenario();
  scenario.totalHead = 2_000;
  scenario.trials = 2;
  const result = runSimulation(scenario);
  return {
    id: 'snapshot-test',
    capturedAt: '2026-09-18T12:00:00.000Z',
    draftScenario: structuredClone(scenario),
    displayedResult: result,
    isStale: false,
    isRunning: false,
    activeResultsPage: 'profit',
    openScenarioSections: ['prices'],
  };
}

describe('assistant metric registry', () => {
  it('uses unique IDs and resolves every historical path for 2015–2025', () => {
    const ids = METRIC_REGISTRY.map((metric) => metric.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(HISTORICAL_YEARS).toEqual([
      2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025,
    ]);
    for (const metric of METRIC_REGISTRY) {
      if (!metric.historicalPath) continue;
      for (const year of HISTORICAL_YEARS) {
        const profile =
          historicalData.years[
            String(year) as keyof typeof historicalData.years
          ];
        expect(
          readPath(profile, metric.historicalPath),
          `${metric.id} in ${year}`,
        ).not.toBeUndefined();
      }
    }
  });

  it('has definitions, units, and verified sources', () => {
    for (const metric of METRIC_REGISTRY) {
      expect(metric.definition.length).toBeGreaterThan(10);
      expect(metric.unit.length).toBeGreaterThan(0);
      for (const sourceId of metric.sourceIds) {
        const source = SOURCE_REGISTRY[sourceId];
        expect(source).toBeDefined();
        if (source.url) expect(source.url.startsWith('https://')).toBe(true);
      }
    }
  });
});

describe('assistant system prompt', () => {
  it('includes the glossary, every USDA reference year, and the sources', () => {
    expect(ASSISTANT_SYSTEM_PROMPT).toContain(DOMAIN_REFUSAL);
    for (const metric of METRIC_REGISTRY) {
      expect(ASSISTANT_SYSTEM_PROMPT).toContain(`- ${metric.label} (`);
    }
    for (const year of HISTORICAL_YEARS) {
      const profile =
        historicalData.years[String(year) as keyof typeof historicalData.years];
      expect(ASSISTANT_SYSTEM_PROMPT).toContain(
        `| ${year} | ${profile.calfPricePerCwt.toFixed(2)} |`,
      );
    }
    for (const source of Object.values(SOURCE_REGISTRY)) {
      expect(ASSISTANT_SYSTEM_PROMPT).toContain(`[source:${source.id}]`);
    }
  });

  it('appends the summary and the current dashboard state', () => {
    const current = snapshot();
    const instructions = buildInstructions(
      current,
      'Earlier we discussed 2022.',
    );
    expect(instructions).toContain('SUMMARY OF EARLIER CONVERSATION');
    expect(instructions).toContain('Earlier we discussed 2022.');
    expect(instructions.endsWith(describeDashboard(current))).toBe(true);
  });
});

describe('dashboard state description', () => {
  it('lists every displayed headline, sector, flow, and ledger value', () => {
    const current = snapshot();
    const result = current.displayedResult!;
    const text = describeDashboard(current);
    expect(text).toContain('Results tab open: "Profit"');
    expect(text).toContain('Scenario sections expanded: "Prices"');
    expect(text).toContain('nothing is stale');
    expect(text).toContain('Calves entering: 2,000 head');
    expect(text).toContain(`Reference year ${result.scenario.referenceYear}`);
    expect(text).toContain(
      `Total profit (headline, median across runs): ${compactCurrency(result.chainEconomicProfit)} (${currency(result.chainEconomicProfit)})`,
    );
    expect(text).toContain(`P10 ${currency(result.chainP10)} to P90`);
    for (const phase of Object.values(result.phases)) {
      expect(text).toContain(
        `- ${phase.label}: Profit ${compactCurrency(phase.economicProfit)}`,
      );
      expect(text).toContain(
        `Operating profit ${currency(phase.operatingContribution)}`,
      );
      expect(text).toContain(
        `${phase.label}: ${Math.round(phase.exitedHead).toLocaleString('en-US')} head exited`,
      );
    }
    expect(text).toContain(
      `break-even $${result.breakEvenFedPricePerCwt.toFixed(2)}/cwt`,
    );
    expect(text).toContain(
      `break-even $${result.breakEvenRetailPricePerLb.toFixed(2)}/lb`,
    );
    for (const driver of result.sensitivity) {
      expect(text).toContain(`- ${driver.label}: 10% lower →`);
    }
    expect(text).toContain('"What happened at each stage" card');
  });

  it('flags stale results and names the edited inputs', () => {
    const current = snapshot();
    const displayed = current.displayedResult!.scenario;
    current.draftScenario.retailPricePerLb = displayed.retailPricePerLb + 1;
    current.draftScenario.phases.stocker.durationDays = 200;
    current.isStale = hasStaleDisplayedResult(
      current.draftScenario,
      current.displayedResult,
    );
    expect(current.isStale).toBe(true);
    const differences = describeScenarioDifferences(
      current.draftScenario,
      displayed,
    );
    expect(differences).toHaveLength(2);
    expect(differences[0]).toContain('Retail beef price');
    expect(differences[1]).toContain('Stocker days: 150 → 200');
    const text = describeDashboard(current);
    expect(text).toContain('STALE');
    expect(text).toContain('CURRENT SCENARIO INPUTS (as edited; not yet run)');
  });

  it('explains when no results are displayed yet', () => {
    const current = snapshot();
    current.displayedResult = null;
    current.isRunning = true;
    const text = describeDashboard(current);
    expect(text).toContain('A simulation is running right now');
    expect(text).toContain('No results are displayed yet');
  });
});

describe('request validation', () => {
  it('accepts only the curated model for each provider', () => {
    for (const [provider, config] of Object.entries(ASSISTANT_MODELS)) {
      expect(
        validateRequestSchema.safeParse({ provider, model: config.model })
          .success,
      ).toBe(true);
      expect(
        validateRequestSchema.safeParse({ provider, model: 'arbitrary-model' })
          .success,
      ).toBe(false);
    }
    expect(
      validateRequestSchema.safeParse({
        provider: 'unknown',
        model: 'gpt-5-mini',
      }).success,
    ).toBe(false);
  });

  it('accepts a chat request with a snapshot and a plain-text summary', () => {
    const request = {
      provider: 'google',
      model: ASSISTANT_MODELS.google.model,
      messages: [{ role: 'user', parts: [{ type: 'text', text: 'Why?' }] }],
      snapshot: snapshot(),
      summary: null,
    };
    expect(assistantRequestSchema.safeParse(request).success).toBe(true);
    expect(
      assistantRequestSchema.safeParse({ ...request, tools: [] }).success,
    ).toBe(false);
    expect(
      assistantRequestSchema.safeParse({ ...request, summary: { text: 'x' } })
        .success,
    ).toBe(false);
  });

  it('keeps the required domain refusal verbatim', () => {
    expect(DOMAIN_REFUSAL).toBe(
      'I’m limited to questions about this dashboard, U.S. beef and cattle supply chains, USDA data used here, and closely related agricultural economics.',
    );
  });
});
