import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { copyText, SecretReveal } from './secret-reveal';

export interface SignInCredentials {
  title: string;
  name: string;
  username: string;
  password: string;
}

export function CredentialsDialog({
  value,
  onClose,
}: {
  value: SignInCredentials | null;
  onClose: () => void;
}) {
  if (!value) return null;
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{value.title}</DialogTitle>
          <DialogDescription>
            Share these sign-in details with {value.name}. The password is shown only now; they must change it
            after signing in.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-[6rem_1fr] gap-2">
            <span className="text-muted-foreground">Username</span>
            <span className="font-medium">{value.username}</span>
          </div>
          <SecretReveal value={value.password} />
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() =>
              copyText(`Username: ${value.username}\nPassword: ${value.password}`, 'Sign-in details copied')
            }
          >
            Copy all
          </Button>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
