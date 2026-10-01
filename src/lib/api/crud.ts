import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap, uploadForm } from './client';
import type { PageMeta } from './types';

interface Page<T> {
  data: T[];
  meta: PageMeta;
}

type AnyClient = {
  GET: (path: string, init?: unknown) => Promise<{ data?: unknown; error?: unknown; response: Response }>;
  POST: (path: string, init?: unknown) => Promise<{ data?: unknown; error?: unknown; response: Response }>;
  PATCH: (path: string, init?: unknown) => Promise<{ data?: unknown; error?: unknown; response: Response }>;
  DELETE: (path: string, init?: unknown) => Promise<{ data?: unknown; error?: unknown; response: Response }>;
};

const client = api as unknown as AnyClient;

export function createCrud<
  TItem,
  TCreate,
  TUpdate = Partial<TCreate>,
  TOption = { id: string; name: string },
>(key: string, path: string, options: { invalidates?: string[] } = {}) {
  const keys = {
    all: [key] as const,
    list: (query: object) => [key, 'list', query] as const,
    options: (query: object) => [key, 'options', query] as const,
    detail: (id: string) => [key, 'detail', id] as const,
  };

  function useInvalidate() {
    const queryClient = useQueryClient();
    return () =>
      Promise.all(
        [key, ...(options.invalidates ?? [])].map((k) => queryClient.invalidateQueries({ queryKey: [k] })),
      );
  }

  return {
    keys,
    useList(query: Record<string, unknown>, enabled = true) {
      return useQuery({
        queryKey: keys.list(query),
        queryFn: () => unwrap(client.GET(path, { params: { query } })) as Promise<Page<TItem>>,
        placeholderData: (previous) => previous,
        enabled,
      });
    },
    useOptions(query: Record<string, unknown> = {}, enabled = true) {
      return useQuery({
        queryKey: keys.options(query),
        queryFn: () =>
          (unwrap(client.GET(`${path}/options`, { params: { query } })) as Promise<{ data: TOption[] }>).then(
            (r) => r.data,
          ),
        staleTime: 60_000,
        enabled,
      });
    },
    useDetail(id: string | undefined) {
      return useQuery({
        queryKey: keys.detail(id ?? ''),
        queryFn: () =>
          (unwrap(client.GET(`${path}/{id}`, { params: { path: { id } } })) as Promise<{ data: TItem }>).then(
            (r) => r.data,
          ),
        enabled: Boolean(id),
      });
    },
    useSave() {
      const invalidate = useInvalidate();
      return useMutation({
        mutationFn: ({ id, body }: { id?: string; body: TCreate | TUpdate }) =>
          (id
            ? unwrap(client.PATCH(`${path}/{id}`, { params: { path: { id } }, body }))
            : unwrap(client.POST(path, { body }))) as Promise<{ data: TItem }>,
        onSuccess: invalidate,
      });
    },
    useRemove() {
      const invalidate = useInvalidate();
      return useMutation({
        mutationFn: (id: string) => unwrap(client.DELETE(`${path}/{id}`, { params: { path: { id } } })),
        onSuccess: invalidate,
      });
    },
    useUploadImage() {
      const invalidate = useInvalidate();
      return useMutation({
        mutationFn: ({ id, file }: { id: string; file: File }) => {
          const form = new FormData();
          form.append('image', file);
          return uploadForm<TItem>(`${path}/${id}/image`, form);
        },
        onSuccess: invalidate,
      });
    },
  };
}
