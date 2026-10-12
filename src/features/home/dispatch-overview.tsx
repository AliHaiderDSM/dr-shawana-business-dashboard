import { CalendarClock, PackageCheck, PackageX, RotateCcw, Truck } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { StatCard } from '@/components/shared/stat-card';
import { useIncomingStock, useWriteOffs } from '@/features/inventory/requests-api';
import { useDeliveryCalendar } from '@/features/sales/api';
import { formatCount, formatDate, isoDate } from '@/lib/format';

function Tile({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="block rounded-xl transition-shadow hover:shadow-md">
      {children}
    </Link>
  );
}

export function DispatchOverview() {
  const today = isoDate();
  const calendar = useDeliveryCalendar(today.slice(0, 7));
  const incoming = useIncomingStock('waiting');
  const writeOffs = useWriteOffs({ status: 'pending' });
  const days = calendar.data?.days ?? [];
  const sum = (key: 'dispatchedOn' | 'returned' | 'orders') => days.reduce((total, d) => total + d[key], 0);
  const todayRow = days.find((d) => d.date === today);
  const awaiting = calendar.data?.awaiting;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <Tile to="/deliveries">
        <StatCard
          label="Waiting to dispatch"
          value={formatCount(awaiting?.orders ?? 0)}
          hint={awaiting?.oldest ? `Oldest booked ${formatDate(awaiting.oldest)}` : 'Nothing is waiting'}
          tone={awaiting?.orders ? 'warning' : undefined}
          icon={CalendarClock}
        />
      </Tile>
      <Tile to="/deliveries?view=dispatch">
        <StatCard
          label="Dispatched today"
          value={formatCount(todayRow?.dispatchedOn ?? 0)}
          hint={`${formatCount(todayRow?.orders ?? 0)} booked today`}
          icon={Truck}
        />
      </Tile>
      <Tile to="/delivery-report">
        <StatCard
          label="Dispatched this month"
          value={formatCount(sum('dispatchedOn'))}
          hint={`${formatCount(sum('orders'))} orders booked this month`}
          icon={Truck}
        />
      </Tile>
      <Tile to="/deliveries">
        <StatCard
          label="Returned this month"
          value={formatCount(sum('returned'))}
          tone={sum('returned') ? 'danger' : undefined}
          icon={RotateCcw}
        />
      </Tile>
      <Tile to="/incoming-stock">
        <StatCard
          label="Stock to receive"
          value={formatCount(incoming.data?.length ?? 0)}
          hint="Transfers from the Super Admin waiting for a check"
          tone={incoming.data?.length ? 'warning' : undefined}
          icon={PackageCheck}
        />
      </Tile>
      <Tile to="/write-offs">
        <StatCard
          label="Write-offs waiting"
          value={formatCount(writeOffs.data?.length ?? 0)}
          hint="Expired, damaged or lost stock waiting for the Super Admin"
          icon={PackageX}
        />
      </Tile>
    </div>
  );
}
