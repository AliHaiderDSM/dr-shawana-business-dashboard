import type { paths } from '@/lib/api/schema';
import type { Me, Schemas } from '@/lib/api/types';

export type { Me };

export type LoginInput = Schemas['Login'];

export type LoginResponse = paths['/auth/login']['post']['responses'][200]['content']['application/json'];

export type Session = LoginResponse['data'];
