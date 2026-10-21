import { Check, ChevronDown, Copy, LogOut, UserIcon, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { nip19 } from 'nostr-tools';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu.tsx';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar.tsx';
import { Skeleton } from '@/components/ui/skeleton.tsx';
import { useLoggedInAccounts, type Account } from '@/hooks/useLoggedInAccounts';
import { useNostrLogin } from '@nostrify/react/login';
import { toast } from '@/hooks/useToast';
import { getExtensionPubkey } from '@/lib/extensionSigner';
import { getDisplayName as profileName, shortNpub } from '@/lib/profile';

interface AccountSwitcherProps {
  onAddAccountClick: () => void;
}

export function AccountSwitcher({ onAddAccountClick }: AccountSwitcherProps) {
  const { currentUser, otherUsers, isLoading, setLogin, removeLogin } = useLoggedInAccounts();

  const { logins } = useNostrLogin();
  const [copied, setCopied] = useState(false);

  if (!currentUser) return null;

  const currentNpub = nip19.npubEncode(currentUser.pubkey);

  const copyNpub = async (e: React.MouseEvent) => {
    // Keep the menu open and don't follow the profile link.
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(currentNpub);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({ title: 'Could not copy', description: currentNpub });
    }
  };

  // An extension account can only be used while it is the extension's active
  // account; the app can't switch the extension, so ask the user to.
  const switchTo = async (account: Account) => {
    const login = logins.find((l) => l.id === account.id);
    if (login?.type === 'extension') {
      const active = await getExtensionPubkey();
      if (active !== login.pubkey) {
        toast({
          title: 'Switch in your extension',
          description: `Make ${getDisplayName(account)} the active account in your signer extension. The app will follow it.`,
        });
        return;
      }
    }
    setLogin(account.id);
  };

  const getDisplayName = (account: Account): string => profileName(account.metadata, account.pubkey);

  // While the metadata query is in-flight and we don't yet have a name,
  // we don't want to flash the npub fallback / its first letter.
  const hasName = (account: Account) => Boolean(account.metadata.display_name || account.metadata.name);
  const isCurrentUserPending = isLoading && !hasName(currentUser);

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button className='flex items-center gap-2 h-10 p-1 pr-2.5 rounded-full hover:bg-accent transition-all text-foreground'>
          <Avatar className='w-8 h-8'>
            <AvatarImage
              src={currentUser.metadata.picture}
              alt={isCurrentUserPending ? '' : getDisplayName(currentUser)}
            />
            <AvatarFallback>
              {isCurrentUserPending ? (
                <Skeleton className='size-full rounded-full' />
              ) : (
                getDisplayName(currentUser).charAt(0)
              )}
            </AvatarFallback>
          </Avatar>
          <ChevronDown className='w-4 h-4 text-muted-foreground' />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className='w-56 p-2 animate-scale-in'>
        <DropdownMenuItem asChild className='flex items-center gap-2 cursor-pointer p-2 rounded-md'>
          <Link to={`/${currentNpub}`}>
            <Avatar className='w-8 h-8'>
              <AvatarImage
                src={currentUser.metadata.picture}
                alt={isCurrentUserPending ? '' : getDisplayName(currentUser)}
              />
              <AvatarFallback>
                {isCurrentUserPending ? (
                  <Skeleton className='size-full rounded-full' />
                ) : (
                  getDisplayName(currentUser)?.charAt(0) || <UserIcon />
                )}
              </AvatarFallback>
            </Avatar>
            <div className='flex-1 truncate'>
              {isCurrentUserPending ? (
                <Skeleton className='h-4 w-24' />
              ) : (
                <p className='text-sm font-medium truncate'>{getDisplayName(currentUser)}</p>
              )}
              <button
                type='button'
                onClick={copyNpub}
                title={`Copy ${currentNpub}`}
                aria-label='Copy npub'
                className='flex items-center gap-1 text-xs text-muted-foreground font-mono hover:text-foreground'
              >
                {shortNpub(currentUser.pubkey)}
                {copied ? <Check className='w-3 h-3' /> : <Copy className='w-3 h-3' />}
              </button>
            </div>
          </Link>
        </DropdownMenuItem>
        {otherUsers.map((user) => {
          const isPending = isLoading && !hasName(user);
          return (
            <DropdownMenuItem
              key={user.id}
              onClick={() => switchTo(user)}
              className='flex items-center gap-2 cursor-pointer p-2 rounded-md'
            >
              <Avatar className='w-8 h-8'>
                <AvatarImage
                  src={user.metadata.picture}
                  alt={isPending ? '' : getDisplayName(user)}
                />
                <AvatarFallback>
                  {isPending ? (
                    <Skeleton className='size-full rounded-full' />
                  ) : (
                    getDisplayName(user)?.charAt(0) || <UserIcon />
                  )}
                </AvatarFallback>
              </Avatar>
              <div className='flex-1 truncate'>
                {isPending ? (
                  <Skeleton className='h-4 w-24' />
                ) : (
                  <p className='text-sm font-medium truncate'>{getDisplayName(user)}</p>
                )}
                <p className='text-xs text-muted-foreground font-mono'>{shortNpub(user.pubkey)}</p>
              </div>
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={onAddAccountClick}
          className='flex items-center gap-2 cursor-pointer p-2 rounded-md'
        >
          <UserPlus className='w-4 h-4' />
          <span>Add another account</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => removeLogin(currentUser.id)}
          className='flex items-center gap-2 cursor-pointer p-2 rounded-md text-red-500'
        >
          <LogOut className='w-4 h-4' />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
