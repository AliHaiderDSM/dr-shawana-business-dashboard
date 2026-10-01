import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { ImageUpload, SignedFileButton } from '@/components/shared/file-upload';
import {
  FieldRow,
  FormSection,
  MoneyField,
  SelectField,
  TextField,
  TextareaField,
} from '@/components/shared/form-fields';
import { FormSheet } from '@/components/shared/form-sheet';
import { generatePassword, SecretReveal } from '@/components/shared/secret-reveal';
import { Form, FormLabel } from '@/components/ui/form';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { applyServerErrors } from '@/lib/api/errors';
import { moneyString, optionalEmail, optionalText, requiredText, usernameString } from '@/lib/validation';
import {
  doctorsApi,
  doctorSignatureUrl,
  useDoctorStaff,
  useUploadSignature,
  type Doctor,
  type DoctorInput,
} from './api';

type AccountMode = 'new' | 'existing';

const schema = z
  .object({
    mode: z.enum(['new', 'existing']),
    staffId: z.string(),
    firstName: z.string().trim().max(100),
    lastName: z.string().trim().max(100),
    accountEmail: z.string().trim().max(150),
    username: z.string().trim(),
    password: z.string(),
    displayName: requiredText(150, 'Display name'),
    phone: optionalText(30),
    email: optionalEmail,
    details: optionalText(5000),
    consultationFee: moneyString('Consultation fee'),
    commissionPercent: z
      .string()
      .trim()
      .regex(/^\d{1,3}(\.\d{1,2})?$/, 'Use a percentage')
      .refine((v) => Number(v) <= 100, 'Use a percentage from 0 to 100'),
    status: z.enum(['active', 'inactive']),
  })
  .superRefine((v, ctx) => {
    if (v.mode === 'existing') {
      if (!v.staffId) ctx.addIssue({ code: 'custom', path: ['staffId'], message: 'Choose a doctor login' });
      return;
    }
    if (!v.firstName)
      ctx.addIssue({ code: 'custom', path: ['firstName'], message: 'First name is required' });
    if (!v.lastName) ctx.addIssue({ code: 'custom', path: ['lastName'], message: 'Last name is required' });
    if (!z.email().safeParse(v.accountEmail).success)
      ctx.addIssue({ code: 'custom', path: ['accountEmail'], message: 'Enter a valid email' });
    const username = usernameString.safeParse(v.username);
    if (!username.success)
      ctx.addIssue({
        code: 'custom',
        path: ['username'],
        message: username.error.issues[0]?.message ?? 'Invalid',
      });
  });

type Values = z.input<typeof schema>;

interface DoctorFormSheetProps {
  doctor: Doctor | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (
    doctor: Doctor,
    credentials: { name: string; username: string; password: string } | null,
  ) => void;
}

export function DoctorFormSheet({ doctor, open, onOpenChange, onCreated }: DoctorFormSheetProps) {
  const save = doctorsApi.useSave();
  const uploadSignature = useUploadSignature();
  const staff = useDoctorStaff(open && !doctor);
  const linked = doctorsApi.useList({ pageSize: 100 }, open && !doctor);
  const [suggested] = useState(generatePassword);
  const form = useForm<Values, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    values: {
      mode: 'new',
      staffId: '',
      firstName: '',
      lastName: '',
      accountEmail: '',
      username: '',
      password: suggested,
      displayName: doctor?.displayName ?? '',
      phone: doctor?.phone ?? null,
      email: doctor?.email ?? null,
      details: doctor?.details ?? null,
      consultationFee: doctor?.consultationFee ?? '0.00',
      commissionPercent: doctor?.commissionPercent ?? '3',
      status: doctor?.status ?? 'active',
    },
  });
  const mode = useWatch({ control: form.control, name: 'mode' });
  const password = useWatch({ control: form.control, name: 'password' });
  const linkedStaff = new Set((linked.data?.data ?? []).map((d) => d.staffId));
  const freeStaff = (staff.data ?? []).filter((s) => !linkedStaff.has(s.id) && s.status === 'active');

  const submit = form.handleSubmit((values) => {
    const profile = {
      displayName: values.displayName,
      phone: values.phone,
      email: values.email,
      details: values.details,
      consultationFee: values.consultationFee,
      commissionPercent: values.commissionPercent,
      status: values.status,
    };
    const body: DoctorInput = doctor
      ? profile
      : values.mode === 'existing'
        ? { ...profile, staffId: values.staffId }
        : {
            ...profile,
            account: {
              firstName: values.firstName,
              lastName: values.lastName,
              email: values.accountEmail,
              username: values.username,
              phone: values.phone,
              password: values.password,
            },
          };
    save.mutate(
      { id: doctor?.id, body },
      {
        onSuccess: ({ data }) => {
          toast.success(doctor ? 'Doctor updated' : 'Doctor added');
          onOpenChange(false);
          if (!doctor)
            onCreated?.(
              data,
              values.mode === 'new'
                ? { name: values.displayName, username: values.username, password: values.password }
                : null,
            );
        },
        onError: (error) => applyServerErrors(form, error),
      },
    );
  });

  return (
    <Form {...form}>
      <FormSheet
        open={open}
        onOpenChange={onOpenChange}
        title={doctor ? 'Edit doctor' : 'New doctor'}
        description="A doctor profile is linked to a doctor sign-in, so they see only their own appointments."
        onSubmit={submit}
        submitting={save.isPending}
        submitLabel={doctor ? 'Save changes' : 'Add doctor'}
        size="lg"
      >
        {doctor ? null : (
          <FormSection title="Sign-in">
            <Tabs
              value={mode}
              onValueChange={(value) =>
                form.setValue('mode', value as AccountMode, { shouldValidate: false })
              }
            >
              <TabsList>
                <TabsTrigger value="new">Create new login</TabsTrigger>
                <TabsTrigger value="existing">Use existing doctor login</TabsTrigger>
              </TabsList>
            </Tabs>
            {mode === 'existing' ? (
              <SelectField
                control={form.control}
                name="staffId"
                label="Doctor login"
                required
                placeholder={freeStaff.length ? 'Choose a doctor' : 'No unlinked doctor logins'}
                description="Employees with the Doctor role that have no doctor profile yet."
                options={freeStaff.map((s) => ({
                  value: s.id,
                  label: `${s.firstName} ${s.lastName}`,
                  hint: s.username,
                }))}
              />
            ) : (
              <>
                <FieldRow>
                  <TextField control={form.control} name="firstName" label="First name" required />
                  <TextField control={form.control} name="lastName" label="Last name" required />
                </FieldRow>
                <FieldRow>
                  <TextField
                    control={form.control}
                    name="accountEmail"
                    label="Login email"
                    type="email"
                    required
                  />
                  <TextField control={form.control} name="username" label="Username" required />
                </FieldRow>
                <div className="space-y-2">
                  <FormLabel>Temporary password</FormLabel>
                  <SecretReveal
                    value={password}
                    onRegenerate={() => form.setValue('password', generatePassword())}
                  />
                </div>
              </>
            )}
          </FormSection>
        )}
        <FormSection title="Profile">
          <FieldRow>
            <TextField
              control={form.control}
              name="displayName"
              label="Display name"
              placeholder="Dr. Shawana Mufti"
              required
            />
            <SelectField
              control={form.control}
              name="status"
              label="Status"
              options={[
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
              ]}
            />
          </FieldRow>
          <FieldRow>
            <TextField control={form.control} name="phone" label="Phone" />
            <TextField control={form.control} name="email" label="Email" type="email" />
          </FieldRow>
          <FieldRow>
            <MoneyField control={form.control} name="consultationFee" label="Consultation fee" required />
            <MoneyField
              control={form.control}
              name="commissionPercent"
              label="Commission %"
              prefix="%"
              description="Used by the doctor sale report."
              required
            />
          </FieldRow>
          <TextareaField
            control={form.control}
            name="details"
            label="Details"
            description="Qualifications printed on prescriptions."
            rows={3}
          />
        </FormSection>
        {doctor ? (
          <FormSection title="Signature" description="Printed on prescriptions and referral letters.">
            <ImageUpload
              label="Signature"
              onUpload={(file) => uploadSignature.mutateAsync({ id: doctor.id, file })}
            />
            {doctor.hasSignature ? (
              <SignedFileButton name="View current signature" getUrl={() => doctorSignatureUrl(doctor.id)} />
            ) : null}
          </FormSection>
        ) : null}
      </FormSheet>
    </Form>
  );
}
