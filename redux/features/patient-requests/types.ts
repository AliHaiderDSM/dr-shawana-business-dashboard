import type { Schemas } from '@/lib/api/types';
import type {
  ClinicGetResponse,
  ClinicPatchResponse,
  ClinicPostResponse,
} from '@redux/features/patients/types';

export type PatientRequest = Schemas['PatientRequest'];
export type PatientRequestStatus = PatientRequest['status'];
export type PatientRequestCategory = PatientRequest['category'];
export type AppAccess = Schemas['PatientAppAccess'];

export type PatientRequestFilter = PatientRequestStatus | 'open' | 'all';
export type PatientRequestList = ClinicGetResponse<'/branch/patient-requests'>['data'];
export type PatientRequestDetail = ClinicGetResponse<'/branch/patient-requests/{id}'>['data'];
export type UpdatedPatientRequest = ClinicPatchResponse<'/branch/patient-requests/{id}'>['data'];
export type PatientAppAccess = ClinicGetResponse<'/branch/patients/{id}/app-access'>['data'];
export type IssuedAppCode = ClinicPostResponse<'/branch/patients/{id}/app-access/code'>['data'];
export type DisabledAppAccess = ClinicPostResponse<'/branch/patients/{id}/app-access/disable'>['data'];

export interface UpdatePatientRequestArg {
  id: string;
  body: Schemas['UpdatePatientRequest'];
}
