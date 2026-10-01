import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import { api, unwrap } from '@/lib/api/client';
import { applyServerErrors } from '@/lib/api/errors';
import { formatDateTime } from '@/lib/format';
import { optionalEmail, optionalText, requiredText } from '@/lib/validation';

const schema = z.object({
  name: requiredText(150, 'Company name').refine((v) => v.length >= 2, 'Use at least 2 characters'),
  phone: optionalText(30),
  email: optionalEmail,
  address: optionalText(500),
});

type Values = z.input<typeof schema>;

export function CompanyPage() {
  const queryClient = useQueryClient();
  const company = useQuery({
    queryKey: ['company'],
    queryFn: () => unwrap(api.GET('/admin/company-info')).then((r) => r.data),
  });
  const form = useForm<Values, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    values: {
      name: company.data?.name ?? '',
      phone: company.data?.phone ?? null,
      email: company.data?.email ?? null,
      address: company.data?.address ?? null,
    },
  });
  const save = useMutation({
    mutationFn: (body: z.output<typeof schema>) =>
      unwrap(api.PUT('/admin/company-info', { body: { ...body, logoPath: company.data?.logoPath ?? null } })),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['company'] });
      toast.success('Company info saved');
    },
    onError: (error) => applyServerErrors(form, error),
  });

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
          <form onSubmit={form.handleSubmit((v) => save.mutate(v))} noValidate className="max-w-3xl">
            <Panel
              title="Organization"
              description={
                company.data ? `Last updated ${formatDateTime(company.data.updatedAt)}` : 'Not set up yet.'
              }
              footer={
                <Button type="submit" disabled={save.isPending || !form.formState.isDirty}>
                  {save.isPending ? <Loader2 className="animate-spin" /> : null}
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
