import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarCheck2, Eye, EyeOff, Loader2, ShieldCheck, Stethoscope } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { z } from 'zod';
import { BrandMark } from '@/components/layout/sidebar';
import { errorMessage } from '@/components/shared/error-state';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/auth/auth-context';

const schema = z.object({
  identifier: z.string().trim().min(3, 'Enter your username or email'),
  password: z.string().min(1, 'Enter your password'),
});

type Values = z.infer<typeof schema>;

const highlights = [
  {
    icon: CalendarCheck2,
    title: 'Appointments & consultations',
    text: 'Book, consult and prescribe from one place.',
  },
  {
    icon: Stethoscope,
    title: 'Every branch, one view',
    text: 'Patients follow you across branches securely.',
  },
  { icon: ShieldCheck, title: 'Role-based access', text: 'Each person sees only what their role allows.' },
];

export function LoginPage() {
  const { status, login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { identifier: '', password: '' },
  });

  if (status === 'authenticated') return <Navigate to={params.get('redirect') ?? '/'} replace />;

  async function onSubmit(values: Values) {
    setFormError(null);
    try {
      await login(values.identifier, values.password);
      navigate(params.get('redirect') ?? '/', { replace: true });
    } catch (error) {
      setFormError(errorMessage(error));
    }
  }

  const submitting = form.formState.isSubmitting;

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <BrandMark />
        <div className="flex flex-1 items-center justify-center py-12">
          <div className="w-full max-w-sm">
            <div className="mb-8 space-y-2">
              <h1 className="text-2xl font-semibold">Welcome back</h1>
              <p className="text-sm text-muted-foreground">Sign in with your staff username or email.</p>
            </div>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5" noValidate>
                <FormField
                  control={form.control}
                  name="identifier"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username or email</FormLabel>
                      <FormControl>
                        <Input autoComplete="username" autoFocus className="h-10" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <div className="relative">
                        <FormControl>
                          <Input
                            type={showPassword ? 'text' : 'password'}
                            autoComplete="current-password"
                            className="h-10 pr-10"
                            {...field}
                          />
                        </FormControl>
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {formError ? (
                  <div
                    role="alert"
                    className="rounded-lg border border-destructive/20 bg-destructive-soft px-3 py-2.5 text-sm text-destructive-soft-foreground"
                  >
                    {formError}
                  </div>
                ) : null}
                <Button type="submit" className="h-10 w-full" disabled={submitting}>
                  {submitting ? <Loader2 className="animate-spin" /> : null}
                  Sign in
                </Button>
              </form>
            </Form>
            <p className="mt-6 text-center text-xs text-muted-foreground">
              Forgot your password? Ask your branch admin to reset it.
            </p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} DSM Clinic</p>
      </div>

      <div className="relative hidden overflow-hidden border-l bg-primary-soft lg:block">
        <div
          aria-hidden
          className="absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, color-mix(in oklch, var(--primary) 18%, transparent) 1px, transparent 0)',
            backgroundSize: '22px 22px',
          }}
        />
        <div className="relative flex h-full flex-col justify-center px-14 xl:px-20">
          <div className="max-w-md">
            <h2 className="text-3xl leading-tight font-semibold text-primary-soft-foreground">
              Calm, connected care across every branch.
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-primary-soft-foreground/80">
              Patients, appointments, prescriptions, stock and sales — managed in one secure workspace.
            </p>
            <div className="mt-10 space-y-3">
              {highlights.map((item) => (
                <div
                  key={item.title}
                  className="flex items-start gap-3 rounded-xl border bg-card/80 p-4 shadow-xs backdrop-blur"
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-foreground">
                    <item.icon className="size-4" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">{item.title}</div>
                    <div className="text-sm text-muted-foreground">{item.text}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
