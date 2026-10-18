import type { Schemas } from '@/lib/api/types';

export type PublicPatientHistory = Schemas['PublicPatientHistory'];

export interface SavePublicIntakeSectionArg {
  token: string;
  key: string;
  data: unknown;
}

export interface UploadPublicMedicalRecordsArg {
  token: string;
  type: 'medical_record' | 'imaging';
  note: string;
  files: File[];
}
