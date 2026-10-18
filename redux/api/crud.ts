import type { TypedUseMutation, TypedUseQuery } from '@reduxjs/toolkit/query/react';
import { api, unwrap, uploadForm } from '@/lib/api/client';
import type { PageMeta } from '@/lib/api/types';
import { baseApi, fromApi, toApi, type AppBaseQuery } from './baseApi';
import type { TagType } from './tagTypes';

export interface Page<T> {
  data: T[];
  meta: PageMeta;
}

type Result = Promise<{ data?: unknown; error?: unknown; response: Response }>;

type AnyClient = {
  GET: (path: string, init?: unknown) => Result;
  POST: (path: string, init?: unknown) => Result;
  PATCH: (path: string, init?: unknown) => Result;
  DELETE: (path: string, init?: unknown) => Result;
};

const client = api as unknown as AnyClient;

const OPTIONS_STALE_SECONDS = 60;

const camel = (value: string) => value.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

export function createCrud<
  TItem,
  TCreate,
  TUpdate = Partial<TCreate>,
  TOption = { id: string; name: string },
>(key: TagType, path: string, options: { invalidates?: TagType[] } = {}) {
  const tags: TagType[] = [key, ...(options.invalidates ?? [])];
  const name = camel(key);
  const ids = {
    list: `${name}List`,
    options: `${name}Options`,
    detail: `${name}Detail`,
    save: `${name}Save`,
    remove: `${name}Remove`,
    uploadImage: `${name}UploadImage`,
  };

  const injected = baseApi.injectEndpoints({
    endpoints: (build) => ({
      [ids.list]: build.query<Page<TItem>, Record<string, unknown>>({
        queryFn: (query) =>
          fromApi(() => unwrap(client.GET(path, { params: { query } })) as Promise<Page<TItem>>),
        providesTags: [key],
      }),
      [ids.options]: build.query<TOption[], Record<string, unknown>>({
        queryFn: (query) =>
          fromApi<TOption[]>(() =>
            (
              unwrap(client.GET(`${path}/options`, { params: { query } })) as Promise<{ data: TOption[] }>
            ).then((r) => r.data),
          ),
        providesTags: [key],
      }),
      [ids.detail]: build.query<TItem, string>({
        queryFn: (id) =>
          fromApi<TItem>(() =>
            (
              unwrap(client.GET(`${path}/{id}`, { params: { path: { id } } })) as Promise<{ data: TItem }>
            ).then((r) => r.data),
          ),
        providesTags: [key],
      }),
      [ids.save]: build.mutation<{ data: TItem }, { id?: string; body: TCreate | TUpdate }>({
        queryFn: ({ id, body }) =>
          toApi(
            () =>
              (id
                ? unwrap(client.PATCH(`${path}/{id}`, { params: { path: { id } }, body }))
                : unwrap(client.POST(path, { body }))) as Promise<{ data: TItem }>,
          ),
        invalidatesTags: (_result, error) => (error ? [] : tags),
      }),
      [ids.remove]: build.mutation<unknown, string>({
        queryFn: (id) => toApi(() => unwrap(client.DELETE(`${path}/{id}`, { params: { path: { id } } }))),
        invalidatesTags: (_result, error) => (error ? [] : tags),
      }),
      [ids.uploadImage]: build.mutation<TItem, { id: string; file: File }>({
        queryFn: ({ id, file }) =>
          toApi(() => {
            const form = new FormData();
            form.append('image', file);
            return uploadForm<TItem>(`${path}/${id}/image`, form);
          }),
        invalidatesTags: (_result, error) => (error ? [] : tags),
      }),
    }),
  });

  const endpoints = injected.endpoints as unknown as Record<
    string,
    { useQuery: unknown; useMutation: unknown }
  >;
  const useListQuery = endpoints[ids.list]!.useQuery as TypedUseQuery<
    Page<TItem>,
    Record<string, unknown>,
    AppBaseQuery
  >;
  const useOptionsQuery = endpoints[ids.options]!.useQuery as TypedUseQuery<
    TOption[],
    Record<string, unknown>,
    AppBaseQuery
  >;
  const useDetailQuery = endpoints[ids.detail]!.useQuery as TypedUseQuery<TItem, string, AppBaseQuery>;

  return {
    tag: key,
    useList: (query: Record<string, unknown>, enabled = true) => useListQuery(query, { skip: !enabled }),
    useOptions: (query: Record<string, unknown> = {}, enabled = true) =>
      useOptionsQuery(query, { skip: !enabled, refetchOnMountOrArgChange: OPTIONS_STALE_SECONDS }),
    useDetail: (id: string | undefined) => useDetailQuery(id ?? '', { skip: !id }),
    useSave: endpoints[ids.save]!.useMutation as TypedUseMutation<
      { data: TItem },
      { id?: string; body: TCreate | TUpdate },
      AppBaseQuery
    >,
    useRemove: endpoints[ids.remove]!.useMutation as TypedUseMutation<unknown, string, AppBaseQuery>,
    useUploadImage: endpoints[ids.uploadImage]!.useMutation as TypedUseMutation<
      TItem,
      { id: string; file: File },
      AppBaseQuery
    >,
  };
}
