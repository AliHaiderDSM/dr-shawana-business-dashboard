import { baseApi, toApi } from '@redux/api/baseApi';
import { api, unwrap } from '@/lib/api/client';
import type { TraceResponse } from './types';

export * from './types';

export const traceApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getTrace: build.query<TraceResponse, string>({
      queryFn: (number) =>
        toApi<TraceResponse>(() =>
          unwrap(api.GET('/branch/trace/{number}', { params: { path: { number } } })).then((r) => r.data),
        ),
      providesTags: ['trace'],
    }),
  }),
  overrideExisting: false,
});

export const { useGetTraceQuery } = traceApi;

export function useTrace(number: string) {
  return useGetTraceQuery(number, { skip: number.length < 3 });
}
