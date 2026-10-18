import type { paths } from '@/lib/api/schema';
import type { Schemas } from '@/lib/api/types';

type CompanyInfoPath = paths['/admin/company-info'];

export type CompanyInfo = Schemas['CompanyInfo'] | null;

export type CompanyInfoInput = NonNullable<
  CompanyInfoPath['put']['requestBody']
>['content']['application/json'];

export type SaveCompanyInfoResponse = CompanyInfoPath['put']['responses'][200]['content']['application/json'];
