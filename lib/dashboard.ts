/**
 * # Dashboard
 *
 * ## What this file is for
 * Shared vocabulary for the simulator dashboard: the IDs and labels of the
 * results tabs and scenario sections, the labels for entry cadence, months and
 * time periods, and the check for results that no longer match the inputs.
 *
 * ## Main pieces in this file
 * - `RESULTS_PAGES` / `RESULT_PAGE_LABELS`: results tab IDs and titles.
 * - `SCENARIO_SECTIONS` / `SCENARIO_SECTION_LABELS`: scenario accordion IDs and titles.
 * - `CADENCE_LABELS`, `MONTH_LABELS`, `horizonLabel`: input option labels.
 * - `hasStaleDisplayedResult`: true when the draft inputs differ from the run shown.
 *
 * ## How it fits into the app
 * The simulator UI renders these labels and the assistant describes the screen
 * with them (`lib/assistant/context.ts`, `prompt.ts`), so both say the same
 * thing. The Worker's request schema builds its enums from the ID arrays. It
 * has no browser or React code, because the Cloudflare Worker imports it too.
 */
import type {
  EntryCadence,
  ScenarioInput,
  SimulationSummary,
} from '@/lib/model/types';

export const RESULTS_PAGES = ['profit', 'flow', 'details'] as const;
export type ResultsPage = (typeof RESULTS_PAGES)[number];

export const RESULT_PAGE_LABELS: Record<ResultsPage, string> = {
  profit: 'Profit',
  flow: 'Cattle flow',
  details: 'Stage details',
};

export const SCENARIO_SECTIONS = [
  'prices',
  'biology',
  'yield',
  'risk',
  'run',
  'sources',
] as const;
export type ScenarioSection = (typeof SCENARIO_SECTIONS)[number];

export const SCENARIO_SECTION_LABELS: Record<ScenarioSection, string> = {
  prices: 'Prices',
  biology: 'Herd & costs',
  yield: 'Yields & trends',
  risk: 'Price swings',
  run: 'Simulation settings',
  sources: 'Data sources',
};

export const CADENCE_LABELS: Record<EntryCadence, string> = {
  even: 'Even monthly',
  upfront: 'All upfront',
  spring: 'Spring weighted',
  fall: 'Fall weighted',
  custom: 'Custom weights',
};

export const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

export function horizonLabel(months: number) {
  return months === 12 ? '1 year' : `${months / 12} years`;
}

/** True when the draft inputs have moved on from the result on screen. */
export function hasStaleDisplayedResult(
  draftScenario: ScenarioInput,
  displayedResult: SimulationSummary | null,
) {
  return (
    displayedResult !== null &&
    JSON.stringify(draftScenario) !== JSON.stringify(displayedResult.scenario)
  );
}
