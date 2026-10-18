import { Copy, KeyRound, Loader2, PowerOff, Smartphone } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Panel } from '@/components/shared/panel';
import { copyText } from '@/components/shared/secret-reveal';
import { StatusBadge, type Tone } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toastError } from '@/lib/api/errors';
import { formatDateTime } from '@/lib/format';
import {
  useAppAccess,
  useDisablePatientAppAccessMutation,
  useIssuePatientAppCodeMutation,
  type AppAccess,
} from '@redux/features/patient-requests';

const STATUS: Record<AppAccess['status'], { label: string; tone: Tone }> = {
  not_invited: { label: 'Not invited', tone: 'neutral' },
  invited: { label: 'Code given', tone: 'warning' },
  active: { label: 'Using the app', tone: 'success' },
  disabled: { label: 'Turned off', tone: 'danger' },
};

export function AppAccessPanel({
  patientId,
  phone,
  canManage,
}: {
  patientId: string;
  phone: string;
  canManage: boolean;
}) {
  const access = useAppAccess(patientId);
  const [issueCode, issue] = useIssuePatientAppCodeMutation();
  const [disable] = useDisablePatientAppAccessMutation();
  const [code, setCode] = useState<{ code: string; expiresAt: string } | null>(null);
  const [confirmOff, setConfirmOff] = useState(false);
  const a = access.data;

  const createCode = () => issueCode(patientId).unwrap().then(setCode).catch(toastError);

  return (
    <Panel title="Mobile app" className="self-start">
      {access.isLoading || !a ? (
        <Skeleton className="h-16 w-full" />
      ) : (
        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <Smartphone className="size-4 text-muted-foreground" />
            <StatusBadge tone={STATUS[a.status].tone}>{STATUS[a.status].label}</StatusBadge>
          </div>
          {a.status === 'active' && a.lastLoginAt ? (
            <p className="text-muted-foreground">Last sign-in {formatDateTime(a.lastLoginAt)}</p>
          ) : null}
          {a.status !== 'not_invited' ? (
            <p className="text-muted-foreground">
              {a.hasPassword && a.passwordSetAt
                ? `App password made ${formatDateTime(a.passwordSetAt)}. If the patient forgets it, create a new login code and they choose a new password with Forgot password.`
                : 'No app password yet. The patient makes one after logging in with a code.'}
            </p>
          ) : null}
          {a.status === 'invited' && a.codeExpiresAt ? (
            <p className="text-muted-foreground">The code works until {formatDateTime(a.codeExpiresAt)}.</p>
          ) : null}
          {canManage ? (
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={issue.isLoading}
                onClick={() => void createCode()}
              >
                {issue.isLoading ? <Loader2 className="animate-spin" /> : <KeyRound />}
                {a.status === 'active' ? 'New login code' : 'Create login code'}
              </Button>
              {a.status === 'active' || a.status === 'invited' ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setConfirmOff(true)}
                >
                  <PowerOff />
                  Turn off
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      )}

      <Dialog open={code !== null} onOpenChange={(open) => !open && setCode(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Login code</DialogTitle>
            <DialogDescription>
              Give this code to the patient. In the app they log in with {phone} and this code (or use it under Forgot password to choose a new password). It works once,
              until {code ? formatDateTime(code.expiresAt) : ''}, and is not shown again.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border bg-muted/40 py-4 text-center font-mono text-3xl font-semibold tracking-[0.4em] tabular-nums">
            {code?.code}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => code && void copyText(code.code, 'Code copied')}>
              <Copy />
              Copy
            </Button>
            <Button onClick={() => setCode(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmOff}
        onOpenChange={setConfirmOff}
        title="Turn off app access?"
        description="The patient is signed out on every phone and cannot sign in until you create a new code."
        confirmLabel="Turn off"
        destructive
        onConfirm={() =>
          disable(patientId)
            .unwrap()
            .then(() => toast.success('App access turned off'))
            .catch(toastError)
        }
      />
    </Panel>
  );
}
