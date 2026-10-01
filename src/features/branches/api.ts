import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api/client';
import type { Schemas } from '@/lib/api/types';

export type Branch = Schemas['Branch'];
export type BranchInput = Schemas['CreateBranch'];
export type BranchAdminInput = Schemas['CreateBranchAdmin'];

export const branchKeys = {
  all: ['branches'] as const,
  list: (query: object) => ['branches', 'list', query] as const,
  detail: (id: string) => ['branches', 'detail', id] as const,
};

export function useBranches(query: Record<string, unknown>) {
  return useQuery({
    queryKey: branchKeys.list(query),
    queryFn: () => unwrap(api.GET('/admin/branches', { params: { query: query as never } })),
    placeholderData: (previous) => previous,
  });
}

export function useBranch(id: string) {
  return useQuery({
    queryKey: branchKeys.detail(id),
    queryFn: () => unwrap(api.GET('/admin/branches/{id}', { params: { path: { id } } })).then((r) => r.data),
  });
}

export function useSaveBranch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: BranchInput }) =>
      id
        ? unwrap(api.PATCH('/admin/branches/{id}', { params: { path: { id } }, body }))
        : unwrap(api.POST('/admin/branches', { body })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: branchKeys.all }),
  });
}

export function useSetBranchStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      active
        ? unwrap(api.POST('/admin/branches/{id}/activate', { params: { path: { id } } }))
        : unwrap(api.POST('/admin/branches/{id}/deactivate', { params: { path: { id } } })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: branchKeys.all }),
  });
}

export function useCreateBranchAdmin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: BranchAdminInput }) =>
      unwrap(api.POST('/admin/branches/{id}/admin', { params: { path: { id } }, body })).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['staff'] }),
  });
}
