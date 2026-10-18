import { CalendarClock, ClipboardList, PackageCheck, PackageX, RotateCcw, Truck } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useSidebarBadges } from '@redux/features/layout';
import { StatCard } from '@/components/shared/stat-card';
import { useIncomingStock, useWriteOffs } from '@redux/features/stock-requests';
import { useDeliveryCalendar } from '@redux/features/sales';
import { useAuth } from '@/lib/auth/auth-context';
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

export function KeeperOverview() {
  const badges = useSidebarBadges(true);
  const { me } = useAuth();
  const lab = me?.role === 'lab_officer';
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Tile to="/store-receipts">
        <StatCard
          label={lab ? 'Stock In waiting for the Warehouse Keeper' : 'Stock In to count and confirm'}
          value={formatCount(badges.data?.stockReceipts ?? 0)}
          hint={lab ? 'It becomes stock once confirmed' : 'Open Store Receipts and confirm what arrived'}
          tone={badges.data?.stockReceipts ? 'warning' : undefined}
          icon={PackageCheck}
        />
      </Tile>
      {lab ? null : (
        <Tile to="/stock-requests">
          <StatCard
            label="Approved requests to send"
            value={formatCount(badges.data?.stockRequests ?? 0)}
            hint="Open a request and use Send stock"
            tone={badges.data?.stockRequests ? 'warning' : undefined}
            icon={ClipboardList}
          />
        </Tile>
      )}
      {lab ? null : (
        <Tile to="/incoming-stock">
          <StatCard
            label="Transfers not received yet"
            value={formatCount(badges.data?.incomingStock ?? 0)}
            hint="Sent stock the branches still have to check"
            icon={Truck}
          />
        </Tile>
      )}
    </div>
  );
}
