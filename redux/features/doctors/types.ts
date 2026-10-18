import type { Schemas } from '@/lib/api/types';
import type { ClinicGetResponse } from '@redux/features/patients/types';

export type Doctor = Schemas['Doctor'];
export type DoctorInput = Schemas['CreateDoctor'];
export type DoctorUpdate = Schemas['UpdateDoctor'];
export interface DoctorOption {
  id: string;
  name: string;
  phone: string | null;
  consultationFee: string;
}

export type MyDoctorProfile = ClinicGetResponse<'/branch/doctors/me'>['data'];
export type DoctorSlots = ClinicGetResponse<'/branch/doctors/{id}/slots'>['data'];
export type DoctorStaffMembers = ClinicGetResponse<'/branch/staff'>['data'];
export type DoctorSignatureUrl = ClinicGetResponse<'/branch/doctors/{id}/signature-url'>['data'];

export interface DoctorSlotsArg {
  doctorId: string | null | undefined;
  date: string;
}

export interface DoctorSignatureUpload {
  id: string;
  file: File;
}
