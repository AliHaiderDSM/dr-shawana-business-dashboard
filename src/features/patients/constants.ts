import type { BhrtStatus } from '@redux/features/patients/types';

export const BHRT_LABELS: Record<BhrtStatus, string> = {
  none: 'None',
  on: 'On BHRT',
  off: 'Off BHRT',
  recommended: 'Recommended',
};
