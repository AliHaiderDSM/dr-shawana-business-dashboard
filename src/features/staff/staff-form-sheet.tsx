import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { FieldRow, FormSection, SelectField, TextField } from '@/components/shared/form-fields';
import { FormSheet } from '@/components/shared/form-sheet';
import { generatePassword, SecretReveal } from '@/components/shared/secret-reveal';
import { Form, FormLabel } from '@/components/ui/form';
import { applyServerErrors } from '@/lib/api/errors';
import { useAuth } from '@/lib/auth/auth-context';
import { optionalText, requiredText, usernameString } from '@/lib/validation';
import { BRANCH_ROLES, creatableRoles, ROLE_LABELS, useSaveStaff, type Staff } from './api';

const schema = z.object({
  firstName: requiredText(100, 'First name'),
  lastName: requiredText(100, 'Last name'),
  email: z.email('Enter a valid email').trim().toLowerCase(),
  username: usernameString,
  phone: optionalText(30),
  gender: z.enum(['male', 'female']).nullable(),
  designation: optionalText(100),
  role: z.enum(BRANCH_ROLES as [string, ...string[]], 'Choose a role'),
  password: z.string(),
});

type Values = z.input<typeof schema>;

interface StaffFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staff?: Staff | null;
  onCreated?: (staff: Staff, password: string) => void;
}

export function StaffFormSheet({ open, onOpenChange, staff, onCreated }: StaffFormSheetProps) {
  const { me } = useAuth();
  const save = useSaveStaff();
  const roles = creatableRoles(me?.role ?? 'front_desk');
  const [suggested] = useState(generatePassword);
  const form = useForm<Values, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    values: {
      firstName: staff?.firstName ?? '',
      lastName: staff?.lastName ?? '',
      email: staff?.email ?? '',
      username: staff?.username ?? '',
      phone: staff?.phone ?? null,
      gender: (staff?.gender as 'male' | 'female' | null) ?? null,
      designation: staff?.designation ?? null,
      role: staff?.role ?? '',
      password: staff ? '' : suggested,
    },
  });

  const submit = form.handleSubmit((values) => {
    const { password, ...rest } = values;
    const body = staff ? rest : { ...rest, password };
    save.mutate(
      { id: staff?.id, body: body as never },
      {
        onSuccess: (result) => {
          toast.success(staff ? 'Employee updated' : 'Employee created');
          onOpenChange(false);
          if (!staff && result && typeof result === 'object' && 'data' in result) {
            onCreated?.((result as { data: Staff }).data, password);
          }
        },
        onError: (error) => applyServerErrors(form, error),
      },
    );
  });

  const password = useWatch({ control: form.control, name: 'password' });
  const roleOptions = roles.map((r) => ({ value: r, label: ROLE_LABELS[r] }));

  return (
    <Form {...form}>
      <FormSheet
        open={open}
        onOpenChange={onOpenChange}
        title={staff ? 'Edit employee' : 'New employee'}
        description={
          staff ? 'Update details or change the role.' : 'The employee signs in with the username or email.'
        }
        onSubmit={submit}
        submitting={save.isPending}
        submitLabel={staff ? 'Save changes' : 'Create employee'}
        size="lg"
      >
        <FormSection title="Personal details">
          <FieldRow>
            <TextField control={form.control} name="firstName" label="First name" required />
            <TextField control={form.control} name="lastName" label="Last name" required />
          </FieldRow>
          <FieldRow>
            <TextField control={form.control} name="phone" label="Phone" placeholder="923001234567" />
            <SelectField
              control={form.control}
              name="gender"
              label="Gender"
              allowEmpty
              options={[
                { value: 'female', label: 'Female' },
                { value: 'male', label: 'Male' },
              ]}
            />
          </FieldRow>
        </FormSection>
        <FormSection title="Role and sign-in">
          <FieldRow>
            <SelectField control={form.control} name="role" label="Role" options={roleOptions} required />
            <TextField control={form.control} name="designation" label="Designation" />
          </FieldRow>
          <FieldRow>
            <TextField control={form.control} name="email" label="Email" type="email" required />
            <TextField control={form.control} name="username" label="Username" required />
          </FieldRow>
          {staff ? null : (
            <div className="space-y-2">
              <FormLabel>Temporary password</FormLabel>
              <SecretReveal
                value={password}
                onRegenerate={() => form.setValue('password', generatePassword())}
              />
              <p className="text-xs text-muted-foreground">
                The employee must change it at the first sign-in. It is shown again after saving.
              </p>
            </div>
          )}
        </FormSection>
      </FormSheet>
    </Form>
  );
}
