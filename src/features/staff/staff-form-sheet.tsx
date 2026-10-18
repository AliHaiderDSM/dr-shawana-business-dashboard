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
import { useBranchKind, useBranchOptions } from '@/lib/auth/branches';
import { emailString, optionalText, requiredText, usernameString } from '@/lib/validation';
import { useSaveStaffMutation } from '@redux/features/staff';
import type { Staff } from '@redux/features/staff/types';
import { BRANCH_ROLES, creatableRoles, ROLE_LABELS } from './constants';

const schema = z.object({
  firstName: requiredText(100, 'First name'),
  lastName: requiredText(100, 'Last name'),
  email: emailString,
  username: usernameString,
  phone: optionalText(30),
  gender: z.enum(['male', 'female']).nullable(),
  branchId: z.string(),
  role: z.enum(BRANCH_ROLES as [string, ...string[]], 'Choose a role'),
  password: z.string(),
});

type Values = z.input<typeof schema>;

interface StaffFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staff?: Staff | null;
  defaultBranchId?: string | null;
  onCreated?: (staff: Staff, password: string) => void;
}

export function StaffFormSheet({
  open,
  onOpenChange,
  staff,
  defaultBranchId,
  onCreated,
}: StaffFormSheetProps) {
  const { me, isSuperAdmin } = useAuth();
  const ownKind = useBranchKind();
  const [saveStaff, saveState] = useSaveStaffMutation();
  const branchOptions = useBranchOptions(isSuperAdmin && open);
  const targets = (branchOptions.data ?? []).filter(
    (b) => (b.kind === 'branch' || b.kind === 'dispatch' || b.kind === 'warehouse') && b.status === 'active',
  );
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
      branchId: staff?.branchId ?? defaultBranchId ?? '',
      role: staff?.role ?? '',
      password: staff ? '' : suggested,
    },
  });

  const submit = form.handleSubmit((values) => {
    const { password, branchId, ...rest } = values;
    if (isSuperAdmin && !branchId) {
      form.setError('branchId', { message: 'Choose the branch' });
      return;
    }
    const body = staff ? rest : { ...rest, password };
    void saveStaff({ id: staff?.id, body: body as never, branchId: isSuperAdmin ? branchId : undefined })
      .unwrap()
      .then((result) => {
        toast.success(staff ? 'Employee updated' : 'Employee created');
        onOpenChange(false);
        if (!staff && result && typeof result === 'object' && 'data' in result) {
          onCreated?.((result as { data: Staff }).data, password);
        }
      })
      .catch((error) => applyServerErrors(form, error));
  });

  const password = useWatch({ control: form.control, name: 'password' });
  const chosenBranch = useWatch({ control: form.control, name: 'branchId' });
  const branchKind = isSuperAdmin
    ? ((branchOptions.data ?? []).find((b) => b.id === chosenBranch)?.kind ?? staff?.branch?.kind ?? null)
    : ownKind;
  const roles = creatableRoles(me?.role ?? 'front_desk', branchKind);
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
        submitting={saveState.isLoading}
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
            {isSuperAdmin && !staff ? (
              <SelectField
                control={form.control}
                name="branchId"
                label="Branch"
                required
                placeholder="Choose branch"
                options={targets.map((b) => ({
                  value: b.id,
                  label: b.name,
                  hint:
                    b.kind === 'dispatch'
                      ? 'Dispatch Department'
                      : b.kind === 'warehouse'
                        ? 'Warehouse Keeper, Lab Officer'
                        : undefined,
                }))}
              />
            ) : null}
            <SelectField
              control={form.control}
              name="role"
              label="Role"
              options={roleOptions}
              required
              description={
                branchKind === 'dispatch'
                  ? 'The Dispatch Department has Branch Admin, Store Keeper, Delivery Print and Dispatcher only.'
                  : branchKind === 'warehouse'
                    ? 'Super Admin stock roles: the Lab Officer enters Stock In; the Warehouse Keeper confirms what arrived and sends the approved requests.'
                    : undefined
              }
            />
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
