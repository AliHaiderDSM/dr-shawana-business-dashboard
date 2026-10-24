import { useState } from 'react';

export const newIdempotencyKey = () => crypto.randomUUID();

export const idempotencyHeaders = (key: string | undefined): Record<string, string> =>
  key ? { 'Idempotency-Key': key } : {};

export function useIdempotencyKey() {
  const [key, setKey] = useState(newIdempotencyKey);
  return { key, renew: () => setKey(newIdempotencyKey()) };
}
