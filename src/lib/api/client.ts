import createClient from 'openapi-fetch';
import { env } from '@/lib/env';
import { branchStore, sessionStore, type StoredSession } from '@/lib/auth/session';
import type { paths } from './schema';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  get fieldErrors(): Record<string, string> {
    if (!Array.isArray(this.details)) return {};
    return Object.fromEntries(
      (this.details as { path?: string; message?: string }[])
        .filter((d) => d.path)
        .map((d) => [String(d.path).replace(/^(body|query|params)\./, ''), String(d.message ?? '')]),
    );
  }
}

export const AUTH_EXPIRED_EVENT = 'dsm:auth-expired';

const BRANCHLESS_PREFIXES = ['/auth/', '/admin/', '/health', '/branch/reports/'];
const OVERVIEW_PATHS = [
  '/branch/dashboard',
  '/branch/inventory/expiry-alerts',
  '/branch/sales',
  '/branch/sales/delivery-slips',
];

let refreshing: Promise<StoredSession | null> | null = null;

async function refreshSession(): Promise<StoredSession | null> {
  const current = sessionStore.get();
  if (!current?.refreshToken) return null;
  refreshing ??= fetch(`${env.VITE_API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: current.refreshToken }),
  })
    .then(async (res) => {
      if (!res.ok) return null;
      const body = (await res.json()) as { data: StoredSession };
      const next = {
        accessToken: body.data.accessToken,
        refreshToken: body.data.refreshToken,
        expiresAt: body.data.expiresAt,
      };
      sessionStore.set(next);
      return next;
    })
    .catch(() => null)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

function withBranch(href: string): string {
  const branchId = branchStore.queryValue();
  if (!branchId) return href;
  const url = new URL(href, window.location.origin);
  const path = url.pathname.replace(new URL(env.VITE_API_BASE_URL, window.location.origin).pathname, '');
  if (BRANCHLESS_PREFIXES.some((p) => path.startsWith(p)) || url.searchParams.has('branchId')) return href;
  if (branchStore.inWarehouse() && OVERVIEW_PATHS.includes(path)) return href;
  url.searchParams.set('branchId', branchId);
  return url.toString();
}

export async function authFetch(input: Request): Promise<Response> {
  const url = withBranch(input.url);
  const body = input.method === 'GET' || input.method === 'HEAD' ? undefined : await input.arrayBuffer();
  const send = (token: string | undefined) => {
    const headers = new Headers(input.headers);
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return fetch(url, {
      method: input.method,
      headers,
      body,
      signal: input.signal,
      credentials: input.credentials,
      cache: input.cache,
    });
  };
  const response = await send(sessionStore.get()?.accessToken);
  if (response.status !== 401 || !sessionStore.get()) return response;
  const renewed = await refreshSession();
  if (!renewed) {
    sessionStore.clear();
    window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
    return response;
  }
  return send(renewed.accessToken);
}

export const api = createClient<paths>({ baseUrl: env.VITE_API_BASE_URL, fetch: authFetch });

interface FetchResult<T> {
  data?: T;
  error?: unknown;
  response: Response;
}

export async function unwrap<T>(promise: Promise<FetchResult<T>>): Promise<NonNullable<T>> {
  const { data, error, response } = await promise;
  if (error !== undefined || !response.ok) {
    const body = (error ?? {}) as { error?: { code?: string; message?: string; details?: unknown } };
    throw new ApiError(
      response.status,
      body.error?.code ?? 'UNKNOWN',
      body.error?.message ?? response.statusText ?? 'Request failed',
      body.error?.details,
    );
  }
  return data as NonNullable<T>;
}

export async function fetchFile(path: string, query: Record<string, string | undefined>) {
  const url = new URL(`${env.VITE_API_BASE_URL}${path}`, window.location.origin);
  for (const [key, value] of Object.entries(query)) if (value) url.searchParams.set(key, value);
  const response = await authFetch(new Request(url));
  if (!response.ok) throw new ApiError(response.status, 'DOWNLOAD_FAILED', 'Download failed');
  return response.blob();
}

export function jsonFormData(data: unknown, files: Record<string, File[] | File | null | undefined> = {}) {
  const form = new FormData();
  form.append('data', JSON.stringify(data));
  for (const [field, value] of Object.entries(files)) {
    if (!value) continue;
    for (const file of Array.isArray(value) ? value : [value]) form.append(field, file);
  }
  return form;
}

export async function uploadForm<T>(
  path: string,
  form: FormData,
  method: 'POST' | 'PATCH' = 'POST',
): Promise<T> {
  const response = await authFetch(new Request(`${env.VITE_API_BASE_URL}${path}`, { method, body: form }));
  const body = (await response.json().catch(() => ({}))) as {
    data?: T;
    error?: { code?: string; message?: string; details?: unknown };
  };
  if (!response.ok) {
    throw new ApiError(
      response.status,
      body.error?.code ?? 'UNKNOWN',
      body.error?.message ?? 'Upload failed',
      body.error?.details,
    );
  }
  return body.data as T;
}
