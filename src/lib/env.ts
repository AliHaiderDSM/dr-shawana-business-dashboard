import { z } from 'zod';

const schema = z.object({
  VITE_API_BASE_URL: z.string().min(1).default('/api/v1'),
});

const parsed = schema.safeParse(import.meta.env);

if (!parsed.success) {
  throw new Error(`Invalid environment: ${parsed.error.issues.map((i) => i.path.join('.')).join(', ')}`);
}

export const env = parsed.data;
