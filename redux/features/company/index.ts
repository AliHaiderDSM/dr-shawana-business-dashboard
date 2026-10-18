import { baseApi, fromApi, toApi } from '@redux/api/baseApi';
import { api, unwrap } from '@/lib/api/client';
import type { CompanyInfo, CompanyInfoInput, SaveCompanyInfoResponse } from './types';

export const companyApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getCompanyInfo: build.query<CompanyInfo, void>({
      queryFn: () => fromApi<CompanyInfo>(() => unwrap(api.GET('/admin/company-info')).then((r) => r.data)),
      providesTags: ['company'],
    }),
    saveCompanyInfo: build.mutation<SaveCompanyInfoResponse, CompanyInfoInput>({
      queryFn: (body) =>
        toApi<SaveCompanyInfoResponse>(() => unwrap(api.PUT('/admin/company-info', { body }))),
      invalidatesTags: (_r, error) => (error ? [] : ['company']),
    }),
  }),
  overrideExisting: false,
});

export const { useGetCompanyInfoQuery, useLazyGetCompanyInfoQuery, useSaveCompanyInfoMutation } = companyApi;
