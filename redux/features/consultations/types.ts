import type { Schemas } from '@/lib/api/types';
import type {
  ClinicGetResponse,
  ClinicPostResponse,
  ClinicPutResponse,
} from '@redux/features/patients/types';

export type Consultation = Schemas['Consultation'];
export type SectionKey = Consultation['availableSections'][number];
export type SectionState = NonNullable<Consultation['sections'][SectionKey]>;
export type MrsScores = NonNullable<SectionState['scores']>;
export interface ConsultationSummary {
  id: string;
  status: Consultation['status'];
  appointmentId: string;
  appointment: Consultation['appointment'];
  patientId: string;
  patient: Consultation['patient'];
  doctorId: string;
  doctor: Consultation['doctor'];
  createdAt: string;
  updatedAt: string;
}
export type ConsultationHistory = Schemas['ConsultationHistory'];

export type AppointmentConsultation = ClinicGetResponse<'/branch/appointments/{id}/consultation'>['data'];
export type ConsultationListPage = ClinicGetResponse<'/branch/consultations'>;
export type ConsultationDetail = ClinicGetResponse<'/branch/consultations/{id}'>['data'];
export type MrsHistory = ClinicGetResponse<'/branch/patients/{id}/mrs-history'>['data'];
export type ReferralLetter = ClinicGetResponse<'/branch/consultations/{id}/referral-letter'>['data'];
export type ConsultationHistoryResponse = ClinicGetResponse<'/branch/consultations/{id}/history'>['data'];
export type ConsultationPreviousResponse = ClinicGetResponse<'/branch/consultations/{id}/previous'>['data'];

export interface SaveConsultationSectionArg {
  consultation: Pick<Consultation, 'id' | 'appointmentId' | 'patientId'>;
  key: SectionKey;
  data: Record<string, unknown>;
}

export interface SetConsultationStatusArg {
  consultation: Pick<Consultation, 'id' | 'appointmentId'>;
  status: Consultation['status'];
}

export type StartedConsultation = ClinicPostResponse<'/branch/appointments/{id}/consultation'>['data'];
export type SavedConsultationSection = ClinicPutResponse<'/branch/consultations/{id}/sections/{key}'>['data'];
export type ChangedConsultationStatus = ClinicPostResponse<'/branch/consultations/{id}/status'>['data'];
