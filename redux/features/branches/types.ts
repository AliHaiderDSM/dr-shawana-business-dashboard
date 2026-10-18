import type { paths } from '@/lib/api/schema';
import type { Schemas } from '@/lib/api/types';

type JsonOk<R> = R extends { 200: { content: { 'application/json': infer B } } }
  ? B
  : R extends { 201: { content: { 'application/json': infer B } } }
    ? B
    : unknown;

type Method = 'get' | 'post' | 'patch' | 'put' | 'delete';

export type BranchApiResponse<P extends keyof paths, M extends Method> =
  paths[P] extends Record<M, { responses: infer R }> ? JsonOk<R> : never;

export type Branch = Schemas['Branch'];
export type BranchInput = Schemas['CreateBranch'];
export type BranchAdminInput = Schemas['CreateBranchAdmin'];

export type BranchListResponse = BranchApiResponse<'/admin/branches', 'get'>;
export type BranchDetail = BranchApiResponse<'/admin/branches/{id}', 'get'>['data'];
export type BranchOption = BranchApiResponse<'/admin/branches/options', 'get'>['data'][number];

export type SaveBranchResponse =
  BranchApiResponse<'/admin/branches/{id}', 'patch'> | BranchApiResponse<'/admin/branches', 'post'>;

export type BranchStatusResponse =
  | BranchApiResponse<'/admin/branches/{id}/activate', 'post'>
  | BranchApiResponse<'/admin/branches/{id}/deactivate', 'post'>;

export type CreateBranchAdminResponse = BranchApiResponse<'/admin/branches/{id}/admin', 'post'>['data'];

export interface SaveBranchArgs {
  id?: string;
  body: BranchInput;
}

export interface BranchStatusArgs {
  id: string;
  active: boolean;
}

export interface CreateBranchAdminArgs {
  id: string;
  body: BranchAdminInput;
}
