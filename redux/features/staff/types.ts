import type { paths } from '@/lib/api/schema';
import type { Schemas } from '@/lib/api/types';

type JsonOk<R> = R extends { 200: { content: { 'application/json': infer B } } }
  ? B
  : R extends { 201: { content: { 'application/json': infer B } } }
    ? B
    : unknown;

type Method = 'get' | 'post' | 'patch' | 'put' | 'delete';

export type StaffApiResponse<P extends keyof paths, M extends Method> =
  paths[P] extends Record<M, { responses: infer R }> ? JsonOk<R> : never;

export type Staff = Schemas['Staff'];
export type StaffInput = Schemas['CreateStaff'];
export type StaffUpdate = Schemas['UpdateStaff'];
export type BranchRole = StaffInput['role'];

export type StaffListResponse = StaffApiResponse<'/branch/staff', 'get'>;

export interface BranchStaffSummary {
  total: StaffListResponse['meta']['total'];
  admins: StaffListResponse['data'];
}

export type SaveStaffResponse =
  StaffApiResponse<'/branch/staff/{id}', 'patch'> | StaffApiResponse<'/branch/staff', 'post'>;

export type StaffStatusResponse =
  | StaffApiResponse<'/branch/staff/{id}/activate', 'post'>
  | StaffApiResponse<'/branch/staff/{id}/deactivate', 'post'>;

export type ResetStaffPasswordResponse = StaffApiResponse<'/branch/staff/{id}/reset-password', 'post'>;

export type RemoveStaffResponse = StaffApiResponse<'/branch/staff/{id}', 'delete'>;

export interface SaveStaffArgs {
  id?: string;
  body: StaffInput | StaffUpdate;
  branchId?: string | null;
}

export interface StaffStatusArgs {
  id: string;
  active: boolean;
  branchId?: string | null;
}

export interface ResetStaffPasswordArgs {
  id: string;
  password: string;
  branchId?: string | null;
}

export interface RemoveStaffArgs {
  id: string;
  branchId?: string | null;
}
