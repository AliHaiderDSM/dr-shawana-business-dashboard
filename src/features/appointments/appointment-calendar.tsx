import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { ListState } from '@/hooks/use-list-state';
import { isoDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useAppointmentCalendar, type CalendarEntry } from '@redux/features/appointments';
import { appointmentNumber, STATUS_LABELS, timeLabel, VISIT_LABELS } from './constants';

const HOUR_HEIGHT = 56;
const ENTRY_HEIGHT = 44;

function hourHeights(columns: Column[], startHour: number, endHour: number) {
  const heights = Array.from({ length: endHour - startHour }, () => HOUR_HEIGHT);
  for (const column of columns) {
    for (const entry of column.entries) {
      const from = minutes(entry.timeFrom);
      const index = Math.floor(from / 60) - startHour;
      if (index < 0 || index >= heights.length) continue;
      const span = Math.min(Math.max(minutes(entry.timeTo) - from, 1), 60);
      heights[index] = Math.max(heights[index]!, Math.ceil((ENTRY_HEIGHT * 60) / span));
    }
  }
  return heights;
}

function lanesOf(entries: CalendarEntry[]) {
  const sorted = [...entries].sort((a, b) => minutes(a.timeFrom) - minutes(b.timeFrom));
  const placed = new Map<string, { lane: number; lanes: number }>();
  let cluster: { entry: CalendarEntry; lane: number }[] = [];
  let clusterEnd = -1;
  const close = () => {
    const lanes = Math.max(1, ...cluster.map((c) => c.lane + 1));
    for (const c of cluster) placed.set(c.entry.id, { lane: c.lane, lanes });
    cluster = [];
  };
  for (const entry of sorted) {
    const from = minutes(entry.timeFrom);
    if (from >= clusterEnd) close();
    const busy = new Set(cluster.filter((c) => minutes(c.entry.timeTo) > from).map((c) => c.lane));
    let lane = 0;
    while (busy.has(lane)) lane++;
    cluster.push({ entry, lane });
    clusterEnd = Math.max(clusterEnd, minutes(entry.timeTo));
  }
  close();
  return placed;
}
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
  const heights = hourHeights(columns, startHour, endHour);
  const offsets = heights.reduce<number[]>((acc, h, i) => [...acc, (acc[i] ?? 0) + h], [0]);
  const y = (time: string) => {
    const t = Math.min(Math.max(minutes(time) - startHour * 60, 0), hours.length * 60);
    const index = Math.min(Math.floor(t / 60), hours.length - 1);
    return (offsets[index] ?? 0) + ((t - index * 60) / 60) * (heights[index] ?? HOUR_HEIGHT);
  };
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
            {hours.map((hour, i) => (
              <div
                key={hour}
                className="pr-2 text-right text-xs text-muted-foreground"
                style={{ height: heights[i] }}
              >
                {timeLabel(`${hour}:00`)}
              </div>
            ))}
          </div>
          {columns.map((column) => {
            const lanes = lanesOf(column.entries);
            return (
              <div key={column.key} className="relative border-l">
                {hours.map((hour, i) => (
                  <div key={hour} className="border-b border-dashed" style={{ height: heights[i] }} />
                ))}
                {column.entries.map((entry) => {
                  const top = y(entry.timeFrom) + 1;
                  const height = Math.max(y(entry.timeTo) - y(entry.timeFrom) - 2, 22);
                  const { lane, lanes: count } = lanes.get(entry.id) ?? { lane: 0, lanes: 1 };
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => void navigate(`/appointments/${entry.id}`)}
                      className={cn(
                        'absolute overflow-hidden rounded-md border px-2 py-1 text-left text-xs shadow-xs transition-shadow hover:z-10 hover:shadow-md',
                        STATUS_STYLES[entry.status],
                      )}
                      style={{
                        top,
                        height,
                        left: `calc(${(lane / count) * 100}% + 4px)`,
                        width: `calc(${100 / count}% - 8px)`,
                      }}
                      title={`${entry.patient?.name ?? ''} · ${timeLabel(entry.timeFrom)} – ${timeLabel(entry.timeTo)}`}
                    >
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate font-medium">{entry.patient?.name}</span>
                        <span
                          className={cn(
                            'shrink-0 rounded-full border px-1.5 py-px text-[10px] leading-none font-medium',
                            entry.repeatNo
                              ? 'border-warning/40 bg-card text-warning-soft-foreground'
                              : entry.visitType === 'followup'
                                ? 'border-info/40 bg-card text-info-soft-foreground'
                                : 'border-success bg-success text-success-foreground',
                          )}
                        >
                          {entry.repeatNo ? 'Repeat' : VISIT_LABELS[entry.visitType]}
                        </span>
                      </div>
                      <div className="truncate opacity-80">
                        {timeLabel(entry.timeFrom)} – {timeLabel(entry.timeTo)} · #{appointmentNumber(entry)}
                        {entry.mode === 'online' ? ' · online' : ''}
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const MONTH_PREVIEW = 3;

function MonthGrid({
  start,
  end,
  month,
  entries,
  onOpenDay,
}: {
  start: Date;
  end: Date;
  month: Date;
  entries: CalendarEntry[];
  onOpenDay: (day: Date) => void;
}) {
  const navigate = useNavigate();
  const days: Date[] = [];
  for (let day = start; day <= end; day = addDays(day, 1)) days.push(day);
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[44rem]">
        <div className="grid grid-cols-7 border-b bg-card">
          {days.slice(0, 7).map((day) => (
            <div
              key={day.toISOString()}
              className="border-l px-3 py-2 text-xs font-medium text-muted-foreground first:border-l-0"
            >
              {format(day, 'EEE')}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const key = isoDate(day);
            const dayEntries = entries
              .filter((e) => e.date === key)
              .sort((a, b) => minutes(a.timeFrom) - minutes(b.timeFrom));
            const outside = !isSameMonth(day, month);
            return (
              <div
                key={key}
                className={cn(
                  'flex min-h-28 flex-col gap-1 border-b border-l p-1.5 [&:nth-child(7n+1)]:border-l-0',
                  outside && 'bg-muted/40',
                )}
              >
                <button
                  type="button"
                  onClick={() => onOpenDay(day)}
                  className={cn(
                    'flex size-7 items-center justify-center self-start rounded-full text-xs font-medium hover:bg-muted',
                    outside && 'text-muted-foreground',
                    isSameDay(day, new Date()) && 'bg-primary text-primary-foreground hover:bg-primary/90',
                  )}
                  aria-label={`Open ${format(day, 'dd MMM yyyy')}`}
                >
                  {format(day, 'd')}
                </button>
                {dayEntries.slice(0, MONTH_PREVIEW).map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => void navigate(`/appointments/${entry.id}`)}
                    className={cn(
                      'truncate rounded border px-1.5 py-0.5 text-left text-xs transition-shadow hover:shadow-sm',
                      STATUS_STYLES[entry.status],
                    )}
                  >
                    <span className="font-medium tabular-nums">{timeLabel(entry.timeFrom)}</span>{' '}
                    {entry.patient?.name}
                  </button>
                ))}
                {dayEntries.length > MONTH_PREVIEW ? (
                  <button
                    type="button"
                    onClick={() => onOpenDay(day)}
                    className="self-start px-1.5 text-xs font-medium text-primary hover:underline"
                  >
                    +{dayEntries.length - MONTH_PREVIEW} more
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface AppointmentCalendarProps {
  list: ListState;
  doctors: { id: string; name: string }[];
  lockDoctor?: boolean;
  defaultSpan?: 'day' | 'week' | 'month';
}

export function AppointmentCalendar({
  list,
  doctors,
  lockDoctor,
  defaultSpan = 'day',
}: AppointmentCalendarProps) {
  const span = list.filters.span;
  const view = span === 'week' || span === 'month' || span === 'day' ? span : defaultSpan;
  const spanFilter = (value: string) => (value === defaultSpan ? undefined : value);
  const anchor = list.filters.day ? parseISO(list.filters.day) : new Date();
  const start =
    view === 'month'
      ? startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 })
      : view === 'week'
        ? startOfWeek(anchor, { weekStartsOn: 1 })
        : anchor;
  const end =
    view === 'month'
      ? endOfWeek(endOfMonth(anchor), { weekStartsOn: 1 })
      : view === 'week'
        ? addDays(start, 6)
        : anchor;
  const doctorId = list.filters.doctorId;
  const calendar = useAppointmentCalendar({
    from: isoDate(start),
    to: isoDate(end),
    ...(doctorId ? { doctorId } : {}),
  });
  const entries = calendar.data ?? [];

  const shift = (direction: number) =>
    list.setFilter(
      'day',
      isoDate(
        view === 'month'
          ? addMonths(anchor, direction)
          : addDays(anchor, direction * (view === 'week' ? 7 : 1)),
      ),
    );
  const openDay = (day: Date) => {
    list.setFilters({ span: spanFilter('day'), day: isoDate(day) });
  };

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
            {view === 'month'
              ? format(anchor, 'MMMM yyyy')
              : view === 'week'
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
            onValueChange={(value) => value && list.setFilter('span', spanFilter(value))}
          >
            <ToggleGroupItem value="day" className="h-9 px-3">
              Day
            </ToggleGroupItem>
            <ToggleGroupItem value="week" className="h-9 px-3">
              Week
            </ToggleGroupItem>
            <ToggleGroupItem value="month" className="h-9 px-3">
              Month
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b px-4 py-2 text-xs text-muted-foreground">
        <span>Card colour shows the status:</span>
        {(['booked', 'completed', 'cancelled'] as const).map((status) => (
          <span key={status} className="inline-flex items-center gap-1.5">
            <span className={cn('size-3 rounded-sm border', STATUS_STYLES[status])} />
            {STATUS_LABELS[status]}
          </span>
        ))}
        <span className="sm:ml-auto">The badge shows the visit: New, Follow up or Repeat</span>
      </div>
      {calendar.isLoading ? (
        <div className="space-y-3 p-4">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : view === 'month' ? (
        <div className={cn('max-h-[75vh] overflow-y-auto', calendar.isFetching && 'opacity-70')}>
          <MonthGrid start={start} end={end} month={anchor} entries={entries} onOpenDay={openDay} />
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
