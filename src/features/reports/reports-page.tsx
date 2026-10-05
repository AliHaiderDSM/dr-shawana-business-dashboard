import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router';
import { EmptyState } from '@/components/shared/empty-state';
import { PageHeader } from '@/components/shared/page-header';
import { useAuth } from '@/lib/auth/auth-context';
import { REPORT_ICON, REPORTS, type ReportDef } from './reports-config';

const GROUPS: ReportDef['group'][] = ['Sales', 'Clinic', 'Inventory', 'Finance'];

export function ReportsPage() {
  const { can, me, isSuperAdmin } = useAuth();
  const available = REPORTS.filter((r) => r.allowed(can, me?.role));

  return (
    <>
      <PageHeader
        title="Reports"
        description={
          isSuperAdmin
            ? 'Every branch together, with charts and a per-branch breakdown. Each report has a Branch filter for one branch.'
            : 'Filter, export to CSV or print any report.'
        }
      />
      {available.length === 0 ? (
        <div className="rounded-xl border bg-card">
          <EmptyState icon={REPORT_ICON} title="No reports for your role" />
        </div>
      ) : (
        <div className="space-y-8">
          {GROUPS.map((group) => {
            const items = available.filter((r) => r.group === group);
            if (items.length === 0) return null;
            return (
              <section key={group} className="space-y-3">
                <h2 className="text-sm font-semibold text-muted-foreground">{group}</h2>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {items.map((report) => (
                    <Link
                      key={report.key}
                      to={`/reports/${report.key}`}
                      className="group flex gap-4 rounded-xl border bg-card p-5 shadow-xs transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm"
                    >
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-foreground">
                        <report.icon className="size-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1 font-medium">
                          {report.title}
                          <ArrowUpRight className="size-4 opacity-0 transition-opacity group-hover:opacity-100" />
                        </span>
                        <span className="mt-1 block text-sm text-muted-foreground">{report.description}</span>
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
