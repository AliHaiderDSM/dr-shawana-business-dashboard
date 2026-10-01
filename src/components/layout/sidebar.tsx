import { Activity, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { NavLink } from 'react-router';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/lib/auth/auth-context';
import { visibleMenu } from '@/lib/permissions/menu';
import { cn } from '@/lib/utils';

interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
  onNavigate?: () => void;
}

export function BrandMark({ collapsed }: { collapsed?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
        <Activity className="size-4" strokeWidth={2.5} />
      </div>
      {collapsed ? null : (
        <div className="min-w-0 leading-tight">
          <div className="truncate text-sm font-semibold text-foreground">DSM Clinic</div>
          <div className="truncate text-xs text-sidebar-muted-foreground">Operations</div>
        </div>
      )}
    </div>
  );
}

export function SidebarNav({ collapsed, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const { me, can, isSuperAdmin } = useAuth();
  const groups = visibleMenu(can, isSuperAdmin, me?.role);

  return (
    <nav className="space-y-5 px-3 py-4" aria-label="Main">
      {groups.map((group) => (
        <div key={group.label} className="space-y-1">
          {collapsed ? (
            <div className="mx-auto mb-2 h-px w-6 bg-sidebar-border first:hidden" />
          ) : (
            <div className="px-2.5 pb-1 text-[11px] font-medium tracking-wide text-sidebar-muted-foreground uppercase">
              {group.label}
            </div>
          )}
          {group.items.map((item) => {
            const link = (
              <NavLink
                key={item.key}
                to={item.path}
                end={item.path === '/'}
                onClick={onNavigate}
                className={({ isActive }) =>
                  cn(
                    'group flex h-9 items-center gap-3 rounded-md px-2.5 text-sm font-medium text-sidebar-foreground transition-colors duration-150',
                    'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                    isActive && 'bg-sidebar-active text-sidebar-active-foreground hover:bg-sidebar-active',
                    collapsed && 'justify-center px-0',
                  )
                }
              >
                <item.icon className="size-4 shrink-0" />
                {collapsed ? null : <span className="truncate">{item.label}</span>}
                {!collapsed && item.phase ? (
                  <span className="ml-auto rounded px-1.5 text-[10px] font-medium text-sidebar-muted-foreground">
                    Soon
                  </span>
                ) : null}
              </NavLink>
            );
            return collapsed ? (
              <Tooltip key={item.key}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            ) : (
              link
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 ease-standard lg:flex',
        collapsed ? 'w-sidebar-collapsed' : 'w-sidebar',
      )}
    >
      <div
        className={cn(
          'flex h-topbar shrink-0 items-center border-b border-sidebar-border px-4',
          collapsed && 'justify-center px-0',
        )}
      >
        <BrandMark collapsed={collapsed} />
      </div>
      <ScrollArea className="flex-1">
        <SidebarNav collapsed={collapsed} />
      </ScrollArea>
      <div className={cn('border-t border-sidebar-border p-3', collapsed && 'flex justify-center')}>
        <Button
          variant="ghost"
          size={collapsed ? 'icon' : 'sm'}
          className="w-full justify-start text-sidebar-muted-foreground"
          onClick={onToggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
          {collapsed ? null : 'Collapse'}
        </Button>
      </div>
    </aside>
  );
}
