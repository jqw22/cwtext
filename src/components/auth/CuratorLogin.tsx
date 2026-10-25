import { useState } from 'react';
import { LogOut, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { useToast } from '@/hooks/useToast';

/** Email sign-in for the curator; readers never need it */
export function CuratorLogin() {
  const { email, isCurator, checkError } = useCurator();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [address, setAddress] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  if (email) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="max-w-48">
            <span className="truncate">{email}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel className="font-normal text-muted-foreground">
            {isCurator
              ? 'Signed in as curator'
              : checkError
                ? `Couldn’t check editing rights: ${checkError}`
                : 'This account can’t edit notes'}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => signOut()}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
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
            <DialogTitle>Curator sign in</DialogTitle>
            <DialogDescription>
              {sent
                ? `A sign-in link is on its way to ${address.trim()}. Open it on this device to start editing.`
                : 'Enter your email and we’ll send you a link to sign in. Only curators can edit notes.'}
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
