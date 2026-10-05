import {
  Building2,
  Check,
  ChevronsUpDown,
  KeyRound,
  LogOut,
  Menu,
  Monitor,
  Moon,
  Sun,
  UserRound,
  Warehouse,
} from 'lucide-react';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useTheme, type Theme } from '@/components/theme-provider';
import { useBranchOptions } from '@/lib/auth/branches';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAuth } from '@/lib/auth/auth-context';
import { ALL_BRANCHES } from '@/lib/auth/session';
import { initials, titleCase } from '@/lib/format';
import { findMenuItem } from '@/lib/permissions/menu';

function BranchSwitcher() {
  const { branchId, setBranchId } = useAuth();
  const [open, setOpen] = useState(false);
  const branches = useBranchOptions();
  const current = branches.data?.find((b) => b.id === branchId);
  const warehouses = (branches.data ?? []).filter((b) => b.kind === 'warehouse');
  const shops = (branches.data ?? []).filter((b) => b.kind !== 'warehouse');

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-9 max-w-64 justify-between gap-2"
          aria-label="Switch branch"
        >
          {current?.kind === 'warehouse' ? (
            <Warehouse className="text-muted-foreground" />
          ) : (
            <Building2 className="text-muted-foreground" />
          )}
          <span className="truncate">{current ? current.name : 'All branches'}</span>
          <ChevronsUpDown className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <Command>
          <CommandInput placeholder="Find a branch…" />
          <CommandList>
            <CommandEmpty>No branch found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="all branches"
                onSelect={() => {
                  setBranchId(ALL_BRANCHES);
                  setOpen(false);
                }}
              >
                <Building2 />
                All branches
                {branchId === ALL_BRANCHES ? <Check className="ml-auto" /> : null}
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
            {warehouses.length ? (
              <CommandGroup heading="Main warehouse">
                {warehouses.map((branch) => (
                  <CommandItem
                    key={branch.id}
                    value={`${branch.name} ${branch.code}`}
                    onSelect={() => {
                      setBranchId(branch.id);
                      setOpen(false);
                    }}
                  >
                    <Warehouse />
                    <span className="truncate">{branch.name}</span>
                    {branchId === branch.id ? <Check className="ml-auto" /> : null}
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
            <CommandGroup heading="Branches">
              {shops.map((branch) => (
                <CommandItem
                  key={branch.id}
                  value={`${branch.name} ${branch.code}`}
                  onSelect={() => {
                    setBranchId(branch.id);
                    setOpen(false);
                  }}
                >
                  <span className="truncate">{branch.name}</span>
                  <span className="text-xs text-muted-foreground">{branch.code}</span>
                  {branchId === branch.id ? <Check className="ml-auto" /> : null}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function UserMenu() {
  const { me, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  if (!me) return null;
  const name = `${me.profile.firstName} ${me.profile.lastName}`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-9 gap-2 px-1.5" aria-label="Account menu">
          <Avatar className="size-7">
            <AvatarFallback className="bg-primary-soft text-xs font-semibold text-primary-soft-foreground">
              {initials(name)}
            </AvatarFallback>
          </Avatar>
          <span className="hidden max-w-36 truncate text-sm font-medium md:inline">
            {me.profile.firstName}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <div className="truncate text-sm font-medium">{name}</div>
          <div className="truncate text-xs text-muted-foreground">{me.profile.email}</div>
          <div className="mt-1 text-xs text-muted-foreground">{titleCase(me.role)}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate('/profile')}>
          <UserRound />
          Profile
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate('/profile?tab=password')}>
          <KeyRound />
          Change password
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Sun />
            Appearance
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup value={theme} onValueChange={(v) => setTheme(v as Theme)}>
              <DropdownMenuRadioItem value="light">
                <Sun />
                Light
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="dark">
                <Moon />
                Dark
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="system">
                <Monitor />
                System
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={logout}>
          <LogOut />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Topbar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const { me, isSuperAdmin } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const location = useLocation();
  const section = findMenuItem(location.pathname);

  return (
    <header className="sticky top-0 z-20 flex h-topbar items-center gap-3 border-b bg-background/85 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/70 sm:px-6">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onOpenMenu} aria-label="Open menu">
        <Menu />
      </Button>
      <div className="hidden min-w-0 text-sm font-medium text-muted-foreground sm:block">
        {section?.label}
      </div>
      <div className="ml-auto flex items-center gap-2">
        {isSuperAdmin ? (
          <BranchSwitcher />
        ) : me?.branch ? (
          <div className="hidden items-center gap-2 rounded-md border bg-card px-3 py-1.5 text-sm sm:flex">
            <Building2 className="size-4 text-muted-foreground" />
            <span className="max-w-48 truncate font-medium">{me.branch.name}</span>
            <span className="text-xs text-muted-foreground">{me.branch.code}</span>
          </div>
        ) : null}
        <Button
          variant="ghost"
          size="icon"
          aria-label="Toggle dark mode"
          onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
        >
          {resolvedTheme === 'dark' ? <Sun /> : <Moon />}
        </Button>
        <UserMenu />
      </div>
    </header>
  );
}
