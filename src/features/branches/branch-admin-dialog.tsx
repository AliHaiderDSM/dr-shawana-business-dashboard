import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { FieldRow, TextField } from '@/components/shared/form-fields';
import { copyText, generatePassword, SecretReveal } from '@/components/shared/secret-reveal';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Form, FormLabel } from '@/components/ui/form';
import { applyServerErrors } from '@/lib/api/errors';
import { optionalText, passwordString, requiredText, usernameString } from '@/lib/validation';
import { useCreateBranchAdmin, type Branch } from './api';

const schema = z.object({
  firstName: requiredText(100, 'First name'),
  lastName: requiredText(100, 'Last name'),
  email: z.email('Enter a valid email').trim().toLowerCase(),
  username: usernameString,
  phone: optionalText(30),
  password: passwordString,
});

type Values = z.input<typeof schema>;

interface Created {
  name: string;
  username: string;
  email: string;
  password: string;
}

export function BranchAdminDialog({
  branch,
  open,
  onOpenChange,
}: {
  branch: Pick<Branch, 'id' | 'name'> | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const create = useCreateBranchAdmin();
  const [created, setCreated] = useState<Created | null>(null);
  const form = useForm<Values, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      username: '',
      phone: null,
      password: generatePassword(),
    },
  });

  function close(next: boolean) {
    if (create.isPending) return;
    onOpenChange(next);
    if (!next) {
      setCreated(null);
      form.reset({
        firstName: '',
        lastName: '',
        email: '',
        username: '',
        phone: null,
        password: generatePassword(),
      });
    }
  }

  const submit = form.handleSubmit((values) => {
    if (!branch) return;
    create.mutate(
      { id: branch.id, body: values },
      {
        onSuccess: (staff) =>
          setCreated({
            name: `${staff.firstName} ${staff.lastName}`,
            username: staff.username,
            email: staff.email,
            password: values.password,
          }),
        onError: (error) => applyServerErrors(form, error),
      },
    );
  });

  const password = useWatch({ control: form.control, name: 'password' });

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-lg">
        {created ? (
          <>
            <DialogHeader>
              <div className="mb-2 flex size-10 items-center justify-center rounded-full bg-success-soft text-success-soft-foreground">
                <CheckCircle2 className="size-5" />
              </div>
              <DialogTitle>Branch admin created</DialogTitle>
              <DialogDescription>
                Share these sign-in details with {created.name}. The password is shown only once; they will be
                asked to change it after signing in.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-[6rem_1fr] gap-2">
                <span className="text-muted-foreground">Username</span>
                <span className="font-medium">{created.username}</span>
                <span className="text-muted-foreground">Email</span>
                <span className="font-medium">{created.email}</span>
              </div>
              <SecretReveal value={created.password} />
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() =>
                  copyText(
                    `Username: ${created.username}\nPassword: ${created.password}`,
                    'Sign-in details copied',
                  )
                }
              >
                Copy all
              </Button>
              <Button onClick={() => close(false)}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <Form {...form}>
            <form onSubmit={submit} noValidate>
              <DialogHeader>
                <DialogTitle>Create branch admin</DialogTitle>
                <DialogDescription>
                  {branch ? `The admin manages staff and data for ${branch.name}.` : null}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-5 py-5">
                <FieldRow>
                  <TextField control={form.control} name="firstName" label="First name" required />
                  <TextField control={form.control} name="lastName" label="Last name" required />
                </FieldRow>
                <FieldRow>
                  <TextField control={form.control} name="email" label="Email" type="email" required />
                  <TextField control={form.control} name="username" label="Username" required />
                </FieldRow>
                <TextField control={form.control} name="phone" label="Phone" />
                <div className="space-y-2">
                  <FormLabel>Temporary password</FormLabel>
                  <SecretReveal
                    value={password}
                    onRegenerate={() => form.setValue('password', generatePassword())}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => close(false)}
                  disabled={create.isPending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={create.isPending}>
                  {create.isPending ? <Loader2 className="animate-spin" /> : null}
                  Create admin
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
