import { baseApi, fromApi, toApi } from '@redux/api/baseApi';
import { api, unwrap } from '@/lib/api/client';
import type {
  BranchDetail,
  BranchListResponse,
  BranchOption,
  BranchStatusArgs,
  BranchStatusResponse,
  CreateBranchAdminArgs,
  CreateBranchAdminResponse,
  SaveBranchArgs,
  SaveBranchResponse,
} from './types';

export const BRANCH_OPTIONS_STALE_SECONDS = 5 * 60;

export const branchesApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getBranchOptions: build.query<BranchOption[], void>({
      queryFn: () =>
        fromApi<BranchOption[]>(() => unwrap(api.GET('/admin/branches/options')).then((r) => r.data)),
      providesTags: ['branches'],
    }),
    getBranches: build.query<BranchListResponse, Record<string, unknown>>({
      queryFn: (query) =>
        fromApi<BranchListResponse>(() =>
          unwrap(api.GET('/admin/branches', { params: { query: query as never } })),
        ),
      providesTags: ['branches'],
    }),
    getBranch: build.query<BranchDetail, string>({
      queryFn: (id) =>
        fromApi<BranchDetail>(() =>
          unwrap(api.GET('/admin/branches/{id}', { params: { path: { id } } })).then((r) => r.data),
        ),
      providesTags: ['branches'],
    }),
    saveBranch: build.mutation<SaveBranchResponse, SaveBranchArgs>({
      queryFn: ({ id, body }) =>
        toApi<SaveBranchResponse>(() => {
          const { kind, ...fields } = body;
          return id
            ? unwrap(api.PATCH('/admin/branches/{id}', { params: { path: { id } }, body: fields }))
            : unwrap(api.POST('/admin/branches', { body: { ...fields, kind } }));
        }),
      invalidatesTags: (_r, error) => (error ? [] : ['branches']),
    }),
    setBranchStatus: build.mutation<BranchStatusResponse, BranchStatusArgs>({
      queryFn: ({ id, active }) =>
        toApi<BranchStatusResponse>(() =>
          active
            ? unwrap(api.POST('/admin/branches/{id}/activate', { params: { path: { id } } }))
            : unwrap(api.POST('/admin/branches/{id}/deactivate', { params: { path: { id } } })),
        ),
      invalidatesTags: (_r, error) => (error ? [] : ['branches']),
    }),
    createBranchAdmin: build.mutation<CreateBranchAdminResponse, CreateBranchAdminArgs>({
      queryFn: ({ id, body }) =>
        toApi<CreateBranchAdminResponse>(() =>
          unwrap(api.POST('/admin/branches/{id}/admin', { params: { path: { id } }, body })).then(
            (r) => r.data,
          ),
        ),
      invalidatesTags: (_r, error) => (error ? [] : ['staff']),
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetBranchOptionsQuery,
  useLazyGetBranchOptionsQuery,
  useGetBranchesQuery,
  useGetBranchQuery,
  useSaveBranchMutation,
  useSetBranchStatusMutation,
  useCreateBranchAdminMutation,
} = branchesApi;

export function useBranchOptions(enabled = true) {
  return useGetBranchOptionsQuery(undefined, { skip: !enabled });
}

export function useBranches(query: Record<string, unknown>) {
  return useGetBranchesQuery(query);
}

export function useBranch(id: string) {
  return useGetBranchQuery(id);
}
