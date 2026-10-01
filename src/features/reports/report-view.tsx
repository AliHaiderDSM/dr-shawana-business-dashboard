import type { ColumnDef } from '@tanstack/react-table';
import { ArrowLeft, Download, Printer } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { DataTable } from '@/components/shared/data-table';
import { ErrorState } from '@/components/shared/error-state';
import { DateRangeFilter, FilterSelect } from '@/components/shared/list-filters';
import { PageHeader } from '@/components/shared/page-header';
import { Panel } from '@/components/shared/panel';
import { PrintPage, Letterhead, PrintTable } from '@/components/shared/print-document';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useListState, type ListState } from '@/hooks/use-list-state';
import { toastError } from '@/lib/api/errors';
import { useAuth } from '@/lib/auth/auth-context';
import { formatDate, titleCase } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  displayValue,
  downloadReportCsv,
  isNumeric,
  useReport,
  useSourceOptions,
  type ReportData,
  type ReportValue,
} from './api';
import { findReport, type ReportDef, type ReportFilter } from './reports-config';

type Row = Record<string, ReportValue> & { __total?: boolean };

const PAGE_KEYS = new Set(['page', 'pageSize', 'sort', 'search']);

function reportQuery(params: URLSearchParams) {
  return Object.fromEntries([...params.entries()].filter(([key, value]) => value && !PAGE_KEYS.has(key)));
}

function SourceFilter({
  list,
  filter,
}: {
  list: ListState;
  filter: Extract<ReportFilter, { kind: 'source' }>;
}) {
  const options = useSourceOptions(filter.source);
  return (
    <FilterSelect
      list={list}
      name={filter.key}
      allLabel={`All ${filter.label.toLowerCase()}s`}
      className="w-44"
      options={options}
    />
  );
}

function TextFilter({ list, filter }: { list: ListState; filter: Extract<ReportFilter, { kind: 'text' }> }) {
  const [value, setValue] = useState(list.filters[filter.key] ?? '');
  return (
    <Input
      value={value}
      placeholder={filter.label}
      aria-label={filter.label}
      className="h-9 w-36"
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => list.setFilter(filter.key, value.trim() || undefined)}
      onKeyDown={(e) => e.key === 'Enter' && list.setFilter(filter.key, value.trim() || undefined)}
    />
  );
}

function columnsFor(data: ReportData): ColumnDef<Row, unknown>[] {
  return data.columns.map((column, index) => {
    const numeric =
      data.rows.some((row) => isNumeric(row[column.key] ?? null)) &&
      data.rows.every(
        (row) =>
          row[column.key] === null || row[column.key] === undefined || isNumeric(row[column.key] ?? null),
      );
    return {
      id: column.key,
      header: column.label,
      accessorFn: (row: Row) => row[column.key] ?? '',
      meta: {
        align: numeric ? 'right' : 'left',
        hideable: index !== 0,
        exportValue: (row: unknown) => (row as Row)[column.key] as string,
      },
      cell: ({ row }) => (
        <span className={cn(row.original.__total && 'font-semibold', index === 0 && 'font-medium')}>
          {row.original.__total && index === 0 ? 'Total' : displayValue(row.original[column.key] ?? null)}
        </span>
      ),
    } satisfies ColumnDef<Row, unknown>;
  });
}

function rowsWithTotals(data: ReportData): Row[] {
  if (!data.totals || data.rows.length === 0) return data.rows;
  return [...data.rows, { ...data.totals, __total: true }];
}

function Summary({ data }: { data: ReportData }) {
  if (!data.summary) return null;
  const entries = Object.entries(data.summary).filter(([, v]) => typeof v !== 'object' || v === null);
  if (!entries.length) return null;
  return (
    <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {entries.map(([key, value]) => (
        <div key={key} className="rounded-xl border bg-card p-4 shadow-xs">
          <div className="text-xs text-muted-foreground">{titleCase(key.replace(/([A-Z])/g, ' $1'))}</div>
          <div className="mt-1 text-xl font-semibold tabular-nums">{displayValue(value)}</div>
        </div>
      ))}
    </div>
  );
}

function ByBranch({ data }: { data: ReportData }) {
  if (!data.byBranch?.length) return null;
  const keys = Object.keys(data.byBranch[0] ?? {});
  return (
    <Panel title="By branch" className="mt-6" bodyClassName="overflow-x-auto p-0">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
            {keys.map((key) => (
              <th key={key} className="px-4 py-2 text-left font-medium">
                {titleCase(key.replace(/([A-Z])/g, ' $1'))}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.byBranch.map((row, index) => (
            <tr key={index} className="border-b last:border-b-0">
              {keys.map((key) => (
                <td
                  key={key}
                  className={cn('px-4 py-2', isNumeric(row[key] ?? null) && 'text-right tabular-nums')}
                >
                  {displayValue(row[key] ?? null)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

function ReportBody({ report }: { report: ReportDef }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const list = useListState();
  const query = reportQuery(params);
  const data = useReport(report.key, query);
  const [downloading, setDownloading] = useState(false);

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2 text-muted-foreground">
        <Link to="/reports">
          <ArrowLeft />
          Reports
        </Link>
      </Button>
      <PageHeader
        title={data.data?.title ?? report.title}
        description={report.description}
        actions={
          <>
            <Button
              variant="outline"
              disabled={downloading}
              onClick={() => {
                setDownloading(true);
                downloadReportCsv(report.key, query)
                  .catch(toastError)
                  .finally(() => setDownloading(false));
              }}
            >
              <Download />
              CSV
            </Button>
            <Button
              variant="outline"
              onClick={() => void navigate(`/print/report/${report.key}?${params.toString()}`)}
            >
              <Printer />
              Print
            </Button>
          </>
        }
      />
      {data.error ? (
        <ErrorState error={data.error} onRetry={() => void data.refetch()} />
      ) : (
        <>
          {data.data ? <Summary data={data.data} /> : null}
          <DataTable
            columns={data.data ? columnsFor(data.data) : []}
            data={data.data ? rowsWithTotals(data.data) : undefined}
            isLoading={data.isLoading}
            isFetching={data.isFetching}
            rowClassName={(row) => (row.__total ? 'bg-muted/50 hover:bg-muted/50' : undefined)}
            exportFileName={report.key}
            emptyTitle="Nothing in this period"
            emptyDescription="Change the dates or filters."
            toolbar={
              <>
                <DateRangeFilter list={list} placeholder="This month" />
                {report.filters.map((filter) =>
                  filter.kind === 'source' ? (
                    <SourceFilter key={filter.key} list={list} filter={filter} />
                  ) : filter.kind === 'text' ? (
                    <TextFilter key={filter.key} list={list} filter={filter} />
                  ) : (
                    <FilterSelect
                      key={filter.key}
                      list={list}
                      name={filter.key}
                      allLabel={`Any ${filter.label.toLowerCase()}`}
                      options={filter.options}
                    />
                  ),
                )}
              </>
            }
          />
          {data.data ? <ByBranch data={data.data} /> : null}
        </>
      )}
    </>
  );
}

export function ReportPage() {
  const { key } = useParams();
  const { can, me } = useAuth();
  const report = findReport(key);
  if (!report || !report.allowed(can, me?.role))
    return <ErrorState error={new Error('This report does not exist or is not available for your role.')} />;
  return <ReportBody key={report.key} report={report} />;
}

export function ReportPrint() {
  const { key } = useParams();
  const [params] = useSearchParams();
  const report = findReport(key);
  const query = reportQuery(params);
  const data = useReport(key ?? '', query);
  return (
    <PrintPage isLoading={data.isLoading} error={data.error ?? (report ? null : new Error('Unknown report'))}>
      {() => {
        const d = data.data;
        if (!d || !report) return null;
        const rows = rowsWithTotals(d);
        const period = query.from
          ? `${formatDate(query.from)} – ${formatDate(query.to ?? query.from)}`
          : 'This month';
        return (
          <div className="space-y-5 text-xs">
            <Letterhead title={d.title} subtitle={period} />
            <PrintTable
              head={d.columns.map((c) => c.label)}
              rows={rows.map((row) =>
                d.columns.map((c, index) =>
                  row.__total && index === 0 ? 'Total' : displayValue(row[c.key] ?? null),
                ),
              )}
            />
          </div>
        );
      }}
    </PrintPage>
  );
}
