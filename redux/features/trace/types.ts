import type { Schemas } from '@/lib/api/types';
import type { ClinicGetResponse } from '@redux/features/patients/types';

export type Trace = Schemas['Trace'];
export type TraceResponse = ClinicGetResponse<'/branch/trace/{number}'>['data'];
