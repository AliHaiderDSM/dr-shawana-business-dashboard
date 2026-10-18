import type { ClientPathsWithMethod, MethodResponse } from 'openapi-fetch';
import type { api } from '@/lib/api/client';
import type { Schemas } from '@/lib/api/types';

type Client = typeof api;

export type ClinicGetResponse<P extends ClientPathsWithMethod<Client, 'get'>> = MethodResponse<
  Client,
  'get',
  P
>;
export type ClinicPostResponse<P extends ClientPathsWithMethod<Client, 'post'>> = MethodResponse<
  Client,
  'post',
  P
>;
export type ClinicPutResponse<P extends ClientPathsWithMethod<Client, 'put'>> = MethodResponse<
  Client,
  'put',
  P
>;
export type ClinicPatchResponse<P extends ClientPathsWithMethod<Client, 'patch'>> = MethodResponse<
  Client,
  'patch',
  P
>;

export type Patient = Schemas['Patient'];
export type PatientInput = Schemas['CreatePatient'];
export type PatientUpdate = Schemas['UpdatePatient'];
export type PatientSummary = Schemas['PatientSummary'];
export type BhrtStatus = Patient['bhrtStatus'];
export interface PatientOption {
  id: string;
  name: string;
  phone: string;
  city: string;
}

export type PatientPhoneCheck = ClinicGetResponse<'/branch/patients/check-phone'>['data'];
export type PatientCity = ClinicGetResponse<'/branch/patients/cities'>['data'];
export type PatientRecordFileUrl =
  ClinicGetResponse<'/branch/patients/{id}/medical-records/files/{fileId}/url'>['data'];

export interface PatientPhoneCheckArg {
  phone: string;
  excludeId?: string;
}

export interface PatientRecordFileArg {
  patientId: string;
  fileId: string;
}
