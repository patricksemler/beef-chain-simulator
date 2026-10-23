/**
 * # Phases
 *
 * ## What this file is for
 * The one place that lists the five stages of the beef chain in order, with
 * the label and colour each stage is shown with.
 *
 * ## Main pieces in this file
 * - `PHASE_ORDER`: stage keys in the order cattle move through the chain.
 * - `PHASE_META`: display label and chart colour per stage.
 *
 * ## How it fits into the app
 * The engine (`simulate.ts`), `historical.ts`, the scenario panel, the results
 * views, the trends series colours, and the assistant's stage list all read
 * from here, so the order and colours cannot drift apart.
 */
import type { PhaseKey } from './types';

export const PHASE_ORDER: readonly PhaseKey[] = [
  'cowCalf',
  'stocker',
  'feedlot',
  'packer',
  'retail',
];

export const PHASE_META: Record<PhaseKey, { color: string; label: string }> = {
  cowCalf: { color: '#688a9a', label: 'Cow-calf' },
  stocker: { color: '#78927b', label: 'Stocker' },
  feedlot: { color: '#b68670', label: 'Feedlot' },
  packer: { color: '#ad9656', label: 'Packer' },
  retail: { color: '#8f7157', label: 'Retail' },
};
