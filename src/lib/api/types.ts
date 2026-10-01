import type { components, paths } from './schema';

export type Schemas = components['schemas'];
export type ApiPath = keyof paths;

export type Me = Schemas['Me'];
export type Role = Me['role'];

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sort?: string;
}
