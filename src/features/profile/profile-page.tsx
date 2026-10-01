import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { z } from 'zod';
import { FieldRow, SelectField, TextField } from '@/components/shared/form-fields';
import { PageHeader } from '@/components/shared/page-header';
import { DetailList, Panel } from '@/components/shared/panel';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api, unwrap } from '@/lib/api/client';
import { applyServerErrors } from '@/lib/api/errors';
import { useAuth } from '@/lib/auth/auth-context';
import { formatDateTime, titleCase } from '@/lib/format';

const GENDER_OPTIONS = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
];

const profileSchema = z.object({
  firstName: z.string().trim().min(1, 'Required').max(100),
  lastName: z.string().trim().min(1, 'Required').max(100),
  phone: z.string().trim().max(30).nullable(),
  gender: z.enum(['male', 'female']).nullable(),
  designation: z.string().trim().max(100).nullable(),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: z.string().min(8, 'Use at least 8 characters').max(72),
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    path: ['newPassword'],
    message: 'Choose a password different from the current one',
  });

function ProfileForm() {
  const { me, refreshMe } = useAuth();
  const profile = me?.profile;
  const form = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    values: {
      firstName: profile?.firstName ?? '',
      lastName: profile?.lastName ?? '',
      phone: profile?.phone ?? null,
      gender: (profile?.gender as 'male' | 'female' | null) ?? null,
      designation: profile?.designation ?? null,
    },
  });
  const save = useMutation({
    mutationFn: (body: z.infer<typeof profileSchema>) =>
      unwrap(
        api.PATCH('/auth/me', {
          body: { ...body, phone: body.phone || null, designation: body.designation || null },
        }),
      ),
    onSuccess: async () => {
      await refreshMe();
      toast.success('Profile updated');
    },
    onError: (error) => applyServerErrors(form, error),
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((v) => save.mutate(v))} noValidate>
        <Panel
          title="Personal details"
          description="Your name and contact details as other staff see them."
          footer={
            <Button type="submit" disabled={save.isPending || !form.formState.isDirty}>
              {save.isPending ? <Loader2 className="animate-spin" /> : null}
              Save changes
            </Button>
          }
        >
          <div className="space-y-5">
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
                options={GENDER_OPTIONS}
                allowEmpty
              />
            </FieldRow>
            <TextField control={form.control} name="designation" label="Designation" />
          </div>
        </Panel>
      </form>
    </Form>
  );
}

function PasswordForm() {
  const { refreshMe } = useAuth();
  const form = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });
  const save = useMutation({
    mutationFn: (v: z.infer<typeof passwordSchema>) =>
      unwrap(
        api.POST('/auth/change-password', {
          body: { currentPassword: v.currentPassword, newPassword: v.newPassword },
        }),
      ),
    onSuccess: async () => {
      form.reset();
      await refreshMe();
      toast.success('Password changed');
    },
    onError: (error) => applyServerErrors(form, error),
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((v) => save.mutate(v))} noValidate>
        <Panel
          title="Change password"
          description="Use at least 8 characters. You stay signed in on this device."
          footer={
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? <Loader2 className="animate-spin" /> : null}
              Update password
            </Button>
          }
        >
          <div className="max-w-md space-y-5">
            <TextField
              control={form.control}
              name="currentPassword"
              label="Current password"
              type="password"
              autoComplete="current-password"
              required
            />
            <TextField
              control={form.control}
              name="newPassword"
              label="New password"
              type="password"
              autoComplete="new-password"
              required
            />
            <TextField
              control={form.control}
              name="confirmPassword"
              label="Confirm new password"
              type="password"
              autoComplete="new-password"
              required
            />
          </div>
        </Panel>
      </form>
    </Form>
  );
}

export function ProfilePage() {
  const { me } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'password' ? 'password' : 'profile';

  return (
    <>
      <PageHeader title="Profile settings" description="Manage your account details and password." />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Tabs
          value={tab}
          onValueChange={(v) => setParams(v === 'password' ? { tab: v } : {}, { replace: true })}
        >
          <TabsList className="mb-4">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="password">Password</TabsTrigger>
          </TabsList>
          <TabsContent value="profile">
            <ProfileForm />
          </TabsContent>
          <TabsContent value="password">
            <PasswordForm />
          </TabsContent>
        </Tabs>
        <Panel title="Account" className="h-fit">
          <DetailList
            items={[
              { label: 'Username', value: me?.profile.username },
              { label: 'Email', value: me?.profile.email },
              { label: 'Role', value: titleCase(me?.role ?? '') },
              { label: 'Branch', value: me?.branch?.name ?? 'All branches' },
              { label: 'Last login', value: formatDateTime(me?.profile.lastLoginAt) },
            ]}
          />
        </Panel>
      </div>
    </>
  );
}
