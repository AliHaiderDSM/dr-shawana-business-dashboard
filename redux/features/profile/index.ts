import { baseApi, toApi } from '@redux/api/baseApi';
import { api, unwrap } from '@/lib/api/client';
import type {
  ChangeMyPasswordInput,
  ChangeMyPasswordResponse,
  UpdateMyProfileInput,
  UpdateMyProfileResponse,
} from './types';

export const profileApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    updateMyProfile: build.mutation<UpdateMyProfileResponse, UpdateMyProfileInput>({
      queryFn: (body) =>
        toApi<UpdateMyProfileResponse>(() =>
          unwrap(
            api.PATCH('/auth/me', {
              body: { ...body, phone: body.phone || null, designation: body.designation || null },
            }),
          ),
        ),
    }),
    changeMyPassword: build.mutation<ChangeMyPasswordResponse, ChangeMyPasswordInput>({
      queryFn: (body) =>
        toApi<ChangeMyPasswordResponse>(() =>
          unwrap(
            api.POST('/auth/change-password', {
              body: { currentPassword: body.currentPassword, newPassword: body.newPassword },
            }),
          ),
        ),
    }),
  }),
  overrideExisting: false,
});

export const { useUpdateMyProfileMutation, useChangeMyPasswordMutation } = profileApi;
