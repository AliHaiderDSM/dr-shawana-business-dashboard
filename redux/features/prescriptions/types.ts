import type { Schemas } from '@/lib/api/types';
import type { ClinicGetResponse } from '@redux/features/patients/types';

export type Prescription = Schemas['Prescription'];
export type PrescriptionInput = Schemas['CreatePrescription'];
export type PrescriptionUpdate = Schemas['UpdatePrescription'];
export type PrescriptionItem = Prescription['items'][number];
export type CatalogItem = Schemas['PrescriptionCatalogItem'];
export type CatalogCategory = CatalogItem['category'];
export type PrescriptionPrintData = Schemas['PrescriptionPrint'];
export type NoteKey = 'blood' | 'imaging' | 'supplements' | 'skinCare' | 'hairCare';

export type PrescriptionCatalog = ClinicGetResponse<'/branch/prescription-catalog'>['data'];
export type PrescriptionPrintResponse = ClinicGetResponse<'/branch/prescriptions/{id}/print'>['data'];
