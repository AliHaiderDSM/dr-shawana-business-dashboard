import type { paths } from '@/lib/api/schema';

type JsonBody<O> = O extends { requestBody?: { content: { 'application/json': infer B } } } ? B : never;

type JsonOk<O> = O extends { responses: { 200: { content: { 'application/json': infer B } } } }
  ? B
  : O extends { responses: { 201: { content: { 'application/json': infer B } } } }
    ? B
    : unknown;

export type UpdateMyProfileInput = JsonBody<paths['/auth/me']['patch']>;
export type UpdateMyProfileResponse = JsonOk<paths['/auth/me']['patch']>;

export type ChangeMyPasswordInput = JsonBody<paths['/auth/change-password']['post']>;
export type ChangeMyPasswordResponse = JsonOk<paths['/auth/change-password']['post']>;
