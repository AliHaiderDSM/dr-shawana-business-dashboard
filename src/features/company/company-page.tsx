import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { ErrorState } from '@/components/shared/error-state';
import { FieldRow, TextField, TextareaField } from '@/components/shared/form-fields';
import { PageHeader } from '@/components/shared/page-header';
import { Panel } from '@/components/shared/panel';
import { DetailSkeleton } from '@/components/shared/skeletons';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { applyServerErrors } from '@/lib/api/errors';
import { formatDateTime } from '@/lib/format';
import { optionalEmail, optionalText, requiredText } from '@/lib/validation';
import { useGetCompanyInfoQuery, useSaveCompanyInfoMutation } from '@redux/features/company';

const schema = z.object({
  name: requiredText(150, 'Company name').refine((v) => v.length >= 2, 'Use at least 2 characters'),
  phone: optionalText(30),
  email: optionalEmail,
  address: optionalText(500),
});

type Values = z.input<typeof schema>;

export function CompanyPage() {
  const company = useGetCompanyInfoQuery(undefined);
  const form = useForm<Values, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    values: {
      name: company.data?.name ?? '',
      phone: company.data?.phone ?? null,
      email: company.data?.email ?? null,
      address: company.data?.address ?? null,
    },
  });
  const [saveCompany, saveState] = useSaveCompanyInfoMutation();
  const save = (body: z.output<typeof schema>) => {
    void saveCompany({ ...body, logoPath: company.data?.logoPath ?? null })
      .unwrap()
      .then(() => toast.success('Company info saved'))
      .catch((error) => applyServerErrors(form, error));
  };

  return (
    <>
      <PageHeader
        title="Company info"
        description="Shown in the header of bills, prescriptions, slips and printed reports for every branch."
      />
      {company.isLoading ? (
        <DetailSkeleton />
      ) : company.error &&
        !(company.error instanceof Error && company.error.message.includes('not found')) ? (
        <ErrorState error={company.error} onRetry={() => void company.refetch()} />
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => save(v))} noValidate className="max-w-3xl">
            <Panel
              title="Organization"
              description={
                company.data ? `Last updated ${formatDateTime(company.data.updatedAt)}` : 'Not set up yet.'
              }
              footer={
                <Button type="submit" disabled={saveState.isLoading || !form.formState.isDirty}>
                  {saveState.isLoading ? <Loader2 className="animate-spin" /> : null}
                  Save changes
                </Button>
              }
            >
              <div className="space-y-5">
                <TextField control={form.control} name="name" label="Company name" required />
                <FieldRow>
                  <TextField control={form.control} name="phone" label="Phone" />
                  <TextField control={form.control} name="email" label="Email" type="email" />
                </FieldRow>
                <TextareaField control={form.control} name="address" label="Address" rows={3} />
              </div>
            </Panel>
          </form>
        </Form>
      )}
    </>
  );
}
