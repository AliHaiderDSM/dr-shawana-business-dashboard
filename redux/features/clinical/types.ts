import type { Schemas } from '@/lib/api/types';
import type { ConsultationSummary, SectionKey, SectionState } from '@redux/features/consultations/types';
import type { ClinicGetResponse, Patient } from '@redux/features/patients/types';
import type { Prescription } from '@redux/features/prescriptions/types';

export type BloodWorkResult = Schemas['BloodWork']['results'][number];
export type BloodTest = BloodWorkResult['test'];
export type BhrtEntry = Schemas['BhrtStatusEntry'];
export type MedicalRecord = Schemas['MedicalRecord'];
export type MedicalRecordType = MedicalRecord['type'];

export interface TimelineConsultation extends ConsultationSummary {
  sections: Partial<Record<SectionKey, SectionState | null>>;
}

export interface PatientTimeline {
  patient: Patient;
  scope: 'branch' | 'all_branches';
  consultations: TimelineConsultation[];
  prescriptions: Prescription[];
  bloodWork: (BloodWorkResult & { branchId: string })[];
  bhrt: (BhrtEntry & { branchId: string })[];
  medicalRecords: (MedicalRecord & { branchId: string })[];
}

export type ReadBloodReport = Schemas['ReadBloodReport'];
export type LabReportSummary = Schemas['LabReportSummary'];

export type BloodWorkResponse = ClinicGetResponse<'/branch/patients/{id}/blood-work'>['data'];
export type BhrtLog = ClinicGetResponse<'/branch/patients/{id}/bhrt'>['data'];
export type MedicalRecordList = ClinicGetResponse<'/branch/patients/{id}/medical-records'>['data'];
export type ReportSummaries = ClinicGetResponse<'/branch/patients/{id}/report-summaries'>['data'];
export type ReportSummaryFileUrl =
  ClinicGetResponse<'/branch/patients/{id}/report-summaries/{summaryId}/files/{index}/url'>['data'];

export interface AddBloodWorkArg {
  patientId: string;
  body: Schemas['AddBloodWork'];
}

export interface UpdateBloodWorkArg {
  patientId: string;
  resultId: string;
  body: Schemas['UpdateBloodWork'];
}

export interface RemoveBloodWorkArg {
  patientId: string;
  resultId: string;
}

export interface AddBhrtArg {
  patientId: string;
  body: Schemas['AddBhrtStatus'];
}

export interface MedicalRecordsArg {
  patientId: string;
  type?: MedicalRecordType;
}

export interface CreateMedicalRecordArg {
  patientId: string;
  body: Schemas['CreateMedicalRecord'];
  files: File[];
}

export interface RemoveMedicalRecordArg {
  patientId: string;
  recordId: string;
}

export interface AddMedicalRecordFilesArg {
  patientId: string;
  recordId: string;
  files: File[];
}

export interface RemoveMedicalRecordFileArg {
  patientId: string;
  recordId: string;
  fileId: string;
}

export interface ReadBloodReportArg {
  patientId: string;
  files: File[];
  recordFileIds: string[];
}

export interface ReportSummaryFileArg {
  patientId: string;
  summaryId: string;
  index: number;
}

export interface RemoveReportSummaryArg {
  patientId: string;
  summaryId: string;
}
