import { ApiError } from '@/lib/api/client';
import { env } from '@/lib/env';

export const API_BASE_URL = env.VITE_API_BASE_URL;

export const CACHE_SECONDS = 5 * 60;
export const STALE_SECONDS = 30;
export const MAX_QUERY_RETRIES = 2;

export function shouldRetry(error: unknown) {
  return !(error instanceof ApiError && error.status < 500);
}
