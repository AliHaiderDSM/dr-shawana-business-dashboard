import { baseApi, fromApi, toApi } from '@redux/api/baseApi';
import { createCrud } from '@redux/api/crud';
import { store } from '@redux/store';
import { api, unwrap, uploadForm } from '@/lib/api/client';
import type {
  Doctor,
  DoctorInput,
  DoctorOption,
  DoctorSignatureUpload,
  DoctorSignatureUrl,
  DoctorSlots,
  DoctorSlotsArg,
  DoctorStaffMembers,
  DoctorUpdate,
  MyDoctorProfile,
} from './types';

export * from './types';

export const doctorsApi = createCrud<Doctor, DoctorInput, DoctorUpdate, DoctorOption>(
  'doctors',
  '/branch/doctors',
  { invalidates: ['staff'] },
);

export const doctorsQueryApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getMyDoctorProfile: build.query<MyDoctorProfile, void>({
      queryFn: () => toApi<MyDoctorProfile>(() => unwrap(api.GET('/branch/doctors/me')).then((r) => r.data)),
      providesTags: ['doctors'],
    }),
    getDoctorSlots: build.query<DoctorSlots, DoctorSlotsArg>({
      queryFn: ({ doctorId, date }) =>
        fromApi<DoctorSlots>(() =>
          unwrap(
            api.GET('/branch/doctors/{id}/slots', {
              params: { path: { id: doctorId ?? '' }, query: { date } },
            }),
          ).then((r) => r.data),
        ),
      providesTags: ['appointments'],
    }),
    getDoctorStaffMembers: build.query<DoctorStaffMembers, void>({
      queryFn: () =>
        fromApi<DoctorStaffMembers>(() =>
          unwrap(api.GET('/branch/staff', { params: { query: { role: 'doctor', pageSize: 100 } } })).then(
            (r) => r.data,
          ),
        ),
      providesTags: ['staff'],
    }),
    uploadDoctorSignature: build.mutation<Doctor, DoctorSignatureUpload>({
      queryFn: ({ id, file }) =>
        toApi<Doctor>(() => {
          const form = new FormData();
          form.append('image', file);
          return uploadForm<Doctor>(`/branch/doctors/${id}/signature`, form);
        }),
      invalidatesTags: (_r, error) => (error ? [] : ['doctors']),
    }),
    getDoctorSignatureUrl: build.query<DoctorSignatureUrl, string>({
      queryFn: (id) =>
        toApi<DoctorSignatureUrl>(() =>
          unwrap(api.GET('/branch/doctors/{id}/signature-url', { params: { path: { id } } })).then(
            (r) => r.data,
          ),
        ),
      providesTags: ['doctors'],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetMyDoctorProfileQuery,
  useGetDoctorSlotsQuery,
  useGetDoctorStaffMembersQuery,
  useUploadDoctorSignatureMutation,
  useLazyGetDoctorSignatureUrlQuery,
} = doctorsQueryApi;

export function useMyDoctorProfile(enabled: boolean) {
  return useGetMyDoctorProfileQuery(undefined, { skip: !enabled });
}

export function useDoctorSlots(doctorId: string | null | undefined, date: string) {
  return useGetDoctorSlotsQuery({ doctorId, date }, { skip: !(doctorId && date) });
}

export function useDoctorStaff(enabled: boolean) {
  return useGetDoctorStaffMembersQuery(undefined, { skip: !enabled });
}

export async function doctorSignatureUrl(
  id: string,
): Promise<(typeof doctorsQueryApi.endpoints.getDoctorSignatureUrl)['Types']['ResultType']> {
  return store
    .dispatch(
      doctorsQueryApi.endpoints.getDoctorSignatureUrl.initiate(id, { subscribe: false, forceRefetch: true }),
    )
    .unwrap();
}
