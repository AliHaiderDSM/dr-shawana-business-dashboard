import { baseApi, fromApi, toApi } from '@redux/api/baseApi';
import { api, unwrap } from '@/lib/api/client';
import type {
  BranchStaffSummary,
  RemoveStaffArgs,
  RemoveStaffResponse,
  ResetStaffPasswordArgs,
  ResetStaffPasswordResponse,
  SaveStaffArgs,
  SaveStaffResponse,
  StaffInput,
  StaffListResponse,
  StaffStatusArgs,
  StaffStatusResponse,
  StaffUpdate,
} from './types';

const inBranch = (branchId?: string | null) => (branchId ? { query: { branchId } } : {});

export const staffApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getStaffList: build.query<StaffListResponse, Record<string, unknown>>({
      queryFn: (query) =>
        fromApi<StaffListResponse>(() =>
          unwrap(api.GET('/branch/staff', { params: { query: query as never } })),
        ),
      providesTags: ['staff'],
    }),
    getBranchStaffSummary: build.query<BranchStaffSummary, string>({
      queryFn: (branchId) =>
        fromApi<BranchStaffSummary>(async () => {
          const [all, admins] = await Promise.all([
            unwrap(api.GET('/branch/staff', { params: { query: { branchId, pageSize: 1 } } })),
            unwrap(
              api.GET('/branch/staff', {
                params: { query: { branchId, role: 'branch_admin', pageSize: 10 } },
              }),
            ),
          ]);
          return { total: all.meta.total, admins: admins.data };
        }),
      providesTags: ['staff'],
    }),
    saveStaff: build.mutation<SaveStaffResponse, SaveStaffArgs>({
      queryFn: ({ id, body, branchId }) =>
        toApi<SaveStaffResponse>(() =>
          id
            ? unwrap(
                api.PATCH('/branch/staff/{id}', {
                  params: { path: { id }, ...inBranch(branchId) },
                  body: body as StaffUpdate,
                }),
              )
            : unwrap(api.POST('/branch/staff', { params: inBranch(branchId), body: body as StaffInput })),
        ),
      invalidatesTags: (_r, error) => (error ? [] : ['staff']),
    }),
    setStaffStatus: build.mutation<StaffStatusResponse, StaffStatusArgs>({
      queryFn: ({ id, active, branchId }) =>
        toApi<StaffStatusResponse>(() =>
          active
            ? unwrap(
                api.POST('/branch/staff/{id}/activate', { params: { path: { id }, ...inBranch(branchId) } }),
              )
            : unwrap(
                api.POST('/branch/staff/{id}/deactivate', {
                  params: { path: { id }, ...inBranch(branchId) },
                }),
              ),
        ),
      invalidatesTags: (_r, error) => (error ? [] : ['staff']),
    }),
    resetStaffPassword: build.mutation<ResetStaffPasswordResponse, ResetStaffPasswordArgs>({
      queryFn: ({ id, password, branchId }) =>
        toApi<ResetStaffPasswordResponse>(() =>
          unwrap(
            api.POST('/branch/staff/{id}/reset-password', {
              params: { path: { id }, ...inBranch(branchId) },
              body: { password },
            }),
          ),
        ),
      invalidatesTags: (_r, error) => (error ? [] : ['staff']),
    }),
    removeStaff: build.mutation<RemoveStaffResponse, RemoveStaffArgs>({
      queryFn: ({ id, branchId }) =>
        toApi<RemoveStaffResponse>(() =>
          unwrap(api.DELETE('/branch/staff/{id}', { params: { path: { id }, ...inBranch(branchId) } })),
        ),
      invalidatesTags: (_r, error) => (error ? [] : ['staff']),
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetStaffListQuery,
  useLazyGetStaffListQuery,
  useGetBranchStaffSummaryQuery,
  useSaveStaffMutation,
  useSetStaffStatusMutation,
  useResetStaffPasswordMutation,
  useRemoveStaffMutation,
} = staffApi;

export function useStaffList(query: Record<string, unknown>, enabled = true) {
  return useGetStaffListQuery(query, { skip: !enabled });
}

export function useBranchStaff(branchId: string) {
  return useGetBranchStaffSummaryQuery(branchId);
}
