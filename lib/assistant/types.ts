/**
 * # Types
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
 * - `AssistantProvider`: the main thing this file provides to the app.
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
import type { UIMessage } from 'ai';
import type { ScenarioInput, SimulationSummary } from '@/lib/model/types';

export type AssistantProvider = 'openai' | 'google' | 'anthropic';

export type ResultsPage = 'profit' | 'sectors' | 'flow' | 'details';

export type ScenarioSection =
  | 'prices'
  | 'biology'
  | 'yield'
  | 'risk'
  | 'run'
  | 'sources';

export type DashboardSnapshotSection =
  | 'status'
  | 'inputs'
  | 'headline'
  | 'phases'
  | 'flow'
  | 'details'
  | 'monthly'
  | 'sensitivity';

export interface DashboardSnapshot {
  id: string;
  capturedAt: string;
  draftScenario: ScenarioInput;
  displayedResult: SimulationSummary | null;
  isStale: boolean;
  isRunning: boolean;
  activeResultsPage: ResultsPage;
  openScenarioSections: ScenarioSection[];
}

export type MetricKind =
  | 'usda_observation'
  | 'derived_historical_assumption'
  | 'scenario_input'
  | 'simulation_output';

export interface UiLocation {
  label: string;
  resultPage?: ResultsPage;
  scenarioSection?: ScenarioSection;
  elementId: string;
}

export interface MetricDescriptor {
  id: string;
  label: string;
  unit: string;
  definition: string;
  kind: MetricKind;
  historicalPath?: string;
  scenarioPath?: string;
  resultPath?: string;
  supportedYears: number[];
  sourceIds: string[];
  methodology?: string;
  uiLocation: UiLocation;
}

export interface SourceCitation {
  id: string;
  label: string;
  organization: string;
  url?: string;
  methodology?: string;
}

export interface ScenarioChange {
  path: string;
  value: number | string | number[];
}

export interface ScenarioVariantRequest {
  label: string;
  referenceYear: number | null;
  changes: ScenarioChange[];
}

export interface NavigateAction {
  type: 'navigate';
  label: string;
  target: UiLocation;
}

export interface ApplyScenarioAction {
  type: 'apply_scenario';
  label: string;
  base: 'draft' | 'displayed';
  changes: ScenarioChange[];
  runAfterApply: boolean;
}

export type AssistantAction = NavigateAction | ApplyScenarioAction;

export interface ConversationSummary {
  text: string;
  referencedMetricIds: string[];
  snapshotStatus: string;
  pendingActions: string[];
}

export type AssistantMessage = UIMessage;

export interface AssistantSessionState {
  provider: AssistantProvider;
  apiKey: string;
  sessionId: string;
  messages: AssistantMessage[];
  summary: ConversationSummary | null;
  userMessageCount: number;
}
