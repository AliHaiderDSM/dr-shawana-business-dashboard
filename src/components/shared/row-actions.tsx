import { MoreHorizontal, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export interface RowAction {
  label: string;
  icon?: LucideIcon;
  onSelect: () => void;
  destructive?: boolean;
  hidden?: boolean;
  separatorBefore?: boolean;
}

export function RowActions({ actions, label = 'Row actions' }: { actions: RowAction[]; label?: string }) {
  const visible = actions.filter((a) => !a.hidden);
  if (visible.length === 0) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground print:hidden"
          aria-label={label}
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48" onClick={(e) => e.stopPropagation()}>
        {visible.map((action) => (
          <div key={action.label}>
            {action.separatorBefore ? <DropdownMenuSeparator /> : null}
            <DropdownMenuItem
              variant={action.destructive ? 'destructive' : 'default'}
              onSelect={action.onSelect}
            >
              {action.icon ? <action.icon /> : null}
              {action.label}
            </DropdownMenuItem>
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
