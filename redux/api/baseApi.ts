import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';
import { CACHE_SECONDS, MAX_QUERY_RETRIES, RETRY_DELAY_MS, shouldRetry, STALE_SECONDS } from './apiConfig';
import { TAG_TYPES } from './tagTypes';

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: fakeBaseQuery<unknown>(),
  tagTypes: TAG_TYPES,
  keepUnusedDataFor: CACHE_SECONDS,
  refetchOnMountOrArgChange: STALE_SECONDS,
  refetchOnFocus: false,
  refetchOnReconnect: false,
  endpoints: () => ({}),
});

export type AppBaseQuery = ReturnType<typeof fakeBaseQuery<unknown>>;

type Outcome<T> = { data: T } | { error: unknown };

export async function fromApi<T>(request: () => Promise<T>): Promise<Outcome<T>> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return { data: await request() };
    } catch (error) {
      if (attempt >= MAX_QUERY_RETRIES || !shouldRetry(error)) return { error };
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * 2 ** attempt));
    }
  }
}

export async function toApi<T>(request: () => Promise<T>): Promise<Outcome<T>> {
  try {
    return { data: await request() };
  } catch (error) {
    return { error };
  }
}
