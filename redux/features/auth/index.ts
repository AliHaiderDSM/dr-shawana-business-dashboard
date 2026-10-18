import { baseApi, toApi } from '@redux/api/baseApi';
import { store, type AppDispatch, type RootState } from '@redux/store';
import { api, unwrap } from '@/lib/api/client';
import type { LoginInput, LoginResponse, Me } from './types';

export const ME_STALE_SECONDS = 5 * 60;

export const authApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getMe: build.query<Me, void>({
      queryFn: () => toApi<Me>(() => unwrap(api.GET('/auth/me')).then((r) => r.data)),
      providesTags: ['auth'],
    }),
    login: build.mutation<LoginResponse, LoginInput>({
      queryFn: (body) => toApi<LoginResponse>(() => unwrap(api.POST('/auth/login', { body }))),
    }),
  }),
  overrideExisting: false,
});

export const { useGetMeQuery, useLazyGetMeQuery, useLoginMutation } = authApi;

export function useMe(enabled: boolean) {
  return useGetMeQuery(undefined, { skip: !enabled, refetchOnMountOrArgChange: ME_STALE_SECONDS });
}

export function requestLogin(
  body: LoginInput,
): Promise<(typeof authApi.endpoints.login)['Types']['ResultType']> {
  return store.dispatch(authApi.endpoints.login.initiate(body, { track: false })).unwrap();
}

export function seedMe(me: Me) {
  return authApi.util.upsertQueryEntries([{ endpointName: 'getMe', arg: undefined, value: me }]);
}

export function clearApiCache() {
  return baseApi.util.resetApiState();
}

export function clearApiCacheKeepingMe() {
  return (dispatch: AppDispatch, getState: () => RootState) => {
    const me = authApi.endpoints.getMe.select(undefined)(getState()).data;
    dispatch(baseApi.util.resetApiState());
    if (me) dispatch(seedMe(me));
  };
}
