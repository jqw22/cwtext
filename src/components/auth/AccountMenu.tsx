import { useState } from 'react';
import { LogOut, Mail, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useCurator, sendSignInLink, signOut } from '@/hooks/useCurator';
import { useProfile, useUpdateProfile, deleteMyAccount } from '@/hooks/useProfile';
import { useToast } from '@/hooks/useToast';

/** Email sign-in for any reader; the curator signs in the same way */
export function AccountMenu() {
  const { userId, email, isCurator, checkError } = useCurator();
  const { data: profile } = useProfile(userId);
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [address, setAddress] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  if (email) {
    const name = profile?.display_name || email;
    return (
      <>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="max-w-48">
              <span className="truncate">{name}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel className="font-normal text-muted-foreground">
              {profile?.display_name && <span className="block truncate">{email}</span>}
              {isCurator
                ? 'Signed in as curator'
                : checkError
                  ? `Couldn’t check editing rights: ${checkError}`
                  : 'Signed in'}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setSettingsOpen(true)}>
              <UserRound className="mr-2 h-4 w-4" />
              Account
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => signOut()}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <AccountDialog
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          userId={userId}
          email={email}
          displayName={profile?.display_name ?? ''}
          hasProfile={!!profile}
          isCurator={isCurator}
        />
      </>
    );
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      await sendSignInLink(address.trim());
      setSent(true);
    } catch (err) {
      toast({ title: 'Could not send the link', description: err instanceof Error ? err.message : 'An error occurred.', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => { setSent(false); setOpen(true); }}>
        Sign in
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Sign in</DialogTitle>
            <DialogDescription>
              {sent
                ? `A sign-in link is on its way to ${address.trim()}. Open it on this device to finish signing in.`
                : 'Enter your email and we’ll send you a link to sign in. If you’re new, this creates your account. No password needed.'}
            </DialogDescription>
          </DialogHeader>
          {!sent && (
            <form onSubmit={handleSend} className="flex gap-2">
              <Input
                type="email"
                required
                autoFocus
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="you@example.com"
                disabled={sending}
              />
              <Button type="submit" disabled={sending || !address.trim()}>
                <Mail className="mr-2 h-4 w-4" />
                Send link
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

interface AccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | undefined;
  email: string;
  displayName: string;
  hasProfile: boolean;
  isCurator: boolean;
}

/** Display name and closing the account */
function AccountDialog({ open, onOpenChange, userId, email, displayName, hasProfile, isCurator }: AccountDialogProps) {
  const { toast } = useToast();
  const updateProfile = useUpdateProfile(userId);
  const [name, setName] = useState(displayName);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleOpenChange = (next: boolean) => {
    if (next) setName(displayName);
    onOpenChange(next);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateProfile.mutateAsync(name);
      onOpenChange(false);
    } catch (err) {
      toast({ title: 'Could not save your name', description: err instanceof Error ? err.message : 'An error occurred.', variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteMyAccount();
      setConfirmDelete(false);
      onOpenChange(false);
      toast({ title: 'Your account has been closed' });
    } catch (err) {
      toast({ title: 'Could not close your account', description: err instanceof Error ? err.message : 'An error occurred.', variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Your account</DialogTitle>
            <DialogDescription>Signed in as {email}.</DialogDescription>
          </DialogHeader>
          {hasProfile ? (
            <form onSubmit={handleSave} className="space-y-2">
              <Label htmlFor="display-name">Name</Label>
              <div className="flex gap-2">
                <Input
                  id="display-name"
                  value={name}
                  maxLength={80}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Shown instead of your email"
                  disabled={updateProfile.isPending}
                />
                <Button type="submit" disabled={updateProfile.isPending || name.trim() === displayName}>
                  Save
                </Button>
              </div>
            </form>
          ) : (
            <p className="text-sm text-muted-foreground">Account settings aren’t available yet.</p>
          )}
          {!isCurator && hasProfile && (
            <DialogFooter className="sm:justify-start border-t pt-4">
              <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setConfirmDelete(true)}>
                Close my account
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close your account?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes your account and anything saved to it. It can’t be undone, though you can always sign up again with the same email.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(e) => { e.preventDefault(); handleDelete(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Close account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
