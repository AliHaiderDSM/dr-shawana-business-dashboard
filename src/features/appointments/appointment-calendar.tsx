import { addDays, format, isSameDay, parseISO, startOfWeek } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { ListState } from '@/hooks/use-list-state';
import { isoDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { timeLabel, useAppointmentCalendar, type CalendarEntry } from './api';

const HOUR_HEIGHT = 56;
const ALL = '__all__';

const STATUS_STYLES: Record<CalendarEntry['status'], string> = {
  booked: 'border-info/50 bg-info-soft text-info-soft-foreground',
  completed: 'border-success/50 bg-success-soft text-success-soft-foreground',
  cancelled: 'border-border bg-muted text-muted-foreground line-through',
};

function minutes(time: string) {
  const [h = 0, m = 0] = time.split(':').map(Number);
  return h * 60 + m;
}

interface Column {
  key: string;
  label: string;
  sublabel?: string;
  highlight?: boolean;
  entries: CalendarEntry[];
}

function TimeGrid({
  columns,
  startHour,
  endHour,
}: {
  columns: Column[];
  startHour: number;
  endHour: number;
}) {
  const navigate = useNavigate();
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[44rem]">
        <div
          className="sticky top-0 z-10 grid border-b bg-card"
          style={{ gridTemplateColumns: `4rem repeat(${columns.length}, minmax(9rem, 1fr))` }}
        >
          <div />
          {columns.map((column) => (
            <div
              key={column.key}
              className={cn('border-l px-3 py-2 text-sm', column.highlight && 'bg-primary-soft/60')}
            >
              <div className="truncate font-medium">{column.label}</div>
              {column.sublabel ? (
                <div className="text-xs text-muted-foreground">{column.sublabel}</div>
              ) : null}
            </div>
          ))}
        </div>
        <div
          className="relative grid"
          style={{ gridTemplateColumns: `4rem repeat(${columns.length}, minmax(9rem, 1fr))` }}
        >
          <div>
            {hours.map((hour) => (
              <div
                key={hour}
                className="pr-2 text-right text-xs text-muted-foreground"
                style={{ height: HOUR_HEIGHT }}
              >
                {timeLabel(`${hour}:00`)}
              </div>
            ))}
          </div>
          {columns.map((column) => (
            <div key={column.key} className="relative border-l">
              {hours.map((hour) => (
                <div key={hour} className="border-b border-dashed" style={{ height: HOUR_HEIGHT }} />
              ))}
              {column.entries.map((entry) => {
                const top = ((minutes(entry.timeFrom) - startHour * 60) / 60) * HOUR_HEIGHT;
                const height = Math.max(
                  ((minutes(entry.timeTo) - minutes(entry.timeFrom)) / 60) * HOUR_HEIGHT,
                  24,
                );
                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => void navigate(`/appointments/${entry.id}`)}
                    className={cn(
                      'absolute inset-x-1 overflow-hidden rounded-md border px-2 py-1 text-left text-xs shadow-xs transition-shadow hover:shadow-md',
                      STATUS_STYLES[entry.status],
                    )}
                    style={{ top, height }}
                  >
                    <div className="truncate font-medium">{entry.patient?.name}</div>
                    <div className="truncate opacity-80">
                      {timeLabel(entry.timeFrom)} · #{entry.appointmentNo}
                      {entry.mode === 'online' ? ' · online' : ''}
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface AppointmentCalendarProps {
  list: ListState;
  doctors: { id: string; name: string }[];
  lockDoctor?: boolean;
}

export function AppointmentCalendar({ list, doctors, lockDoctor }: AppointmentCalendarProps) {
  const view = list.filters.span === 'week' ? 'week' : 'day';
  const anchor = list.filters.day ? parseISO(list.filters.day) : new Date();
  const start = view === 'week' ? startOfWeek(anchor, { weekStartsOn: 1 }) : anchor;
  const end = view === 'week' ? addDays(start, 6) : anchor;
  const doctorId = list.filters.doctorId;
  const calendar = useAppointmentCalendar({
    from: isoDate(start),
    to: isoDate(end),
    ...(doctorId ? { doctorId } : {}),
  });
  const entries = calendar.data ?? [];

  const shift = (direction: number) =>
    list.setFilter('day', isoDate(addDays(anchor, direction * (view === 'week' ? 7 : 1))));

  const visibleDoctors = doctorId ? doctors.filter((d) => d.id === doctorId) : doctors;
  const columns: Column[] =
    view === 'day'
      ? visibleDoctors.map((doctor) => ({
          key: doctor.id,
          label: doctor.name,
          entries: entries.filter((e) => e.doctor?.id === doctor.id),
        }))
      : Array.from({ length: 7 }, (_, i) => {
          const day = addDays(start, i);
          return {
            key: isoDate(day),
            label: format(day, 'EEE'),
            sublabel: format(day, 'dd MMM'),
            highlight: isSameDay(day, new Date()),
            entries: entries.filter((e) => e.date === isoDate(day)),
          };
        });

  const times = entries.flatMap((e) => [minutes(e.timeFrom), minutes(e.timeTo)]);
  const startHour = Math.min(9, ...times.map((t) => Math.floor(t / 60)));
  const endHour = Math.max(21, ...times.map((t) => Math.ceil(t / 60)));

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-3">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="size-9"
            onClick={() => shift(-1)}
            aria-label="Previous"
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9"
            onClick={() => list.setFilter('day', undefined)}
          >
            Today
          </Button>
          <Button variant="outline" size="icon" className="size-9" onClick={() => shift(1)} aria-label="Next">
            <ChevronRight />
          </Button>
          <span className="ml-2 text-sm font-semibold">
            {view === 'week'
              ? `${format(start, 'dd MMM')} – ${format(end, 'dd MMM yyyy')}`
              : format(anchor, 'EEEE, dd MMM yyyy')}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {lockDoctor ? null : (
            <Select
              value={doctorId ?? ALL}
              onValueChange={(value) => list.setFilter('doctorId', value === ALL ? undefined : value)}
            >
              <SelectTrigger size="sm" className="h-9 w-48" aria-label="Doctor">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All doctors</SelectItem>
                {doctors.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <ToggleGroup
            type="single"
            variant="outline"
            value={view}
            onValueChange={(value) => value && list.setFilter('span', value === 'week' ? 'week' : undefined)}
          >
            <ToggleGroupItem value="day" className="h-9 px-3">
              Day
            </ToggleGroupItem>
            <ToggleGroupItem value="week" className="h-9 px-3">
              Week
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>
      {calendar.isLoading ? (
        <div className="space-y-3 p-4">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : columns.length === 0 ? (
        <p className="p-10 text-center text-sm text-muted-foreground">Add a doctor to see the calendar.</p>
      ) : (
        <div className={cn('max-h-[70vh] overflow-y-auto', calendar.isFetching && 'opacity-70')}>
          <TimeGrid columns={columns} startHour={startHour} endHour={endHour} />
        </div>
      )}
    </div>
  );
}
