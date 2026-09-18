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
