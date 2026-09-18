import type { PhaseKey } from '@/lib/model/types';

export const PHASE_ORDER: readonly PhaseKey[] = [
  'cowCalf',
  'stocker',
  'feedlot',
  'packer',
  'retail',
] as const;

export const PHASE_META: Record<PhaseKey, { color: string; label: string }> = {
  cowCalf: { color: '#688a9a', label: 'Cow-calf' },
  stocker: { color: '#78927b', label: 'Stocker' },
  feedlot: { color: '#b68670', label: 'Feedlot' },
  packer: { color: '#ad9656', label: 'Packer' },
  retail: { color: '#8f7157', label: 'Retail' },
};
