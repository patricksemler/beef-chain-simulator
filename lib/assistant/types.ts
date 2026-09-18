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

/** Everything the dashboard is showing at the moment a question is sent. */
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
  resultPage?: ResultsPage;
  scenarioSection?: ScenarioSection;
}

export interface MetricDescriptor {
  id: string;
  label: string;
  unit: string;
  definition: string;
  kind: MetricKind;
  historicalPath?: string;
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

export type AssistantMessage = UIMessage;

export interface AssistantSessionState {
  provider: AssistantProvider;
  apiKey: string;
  sessionId: string;
  messages: AssistantMessage[];
  summary: string | null;
  userMessageCount: number;
}
