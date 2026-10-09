import { ReportCharts } from './report-charts';
import { useBranchOptions } from '@/lib/auth/branches';
import type { ColumnDef } from '@tanstack/react-table';
import { ArrowLeft, Download, Printer } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { Combobox } from '@/components/shared/combobox';
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
import { usePatientSearch } from '@/features/patients/api';
import { useAuth } from '@/lib/auth/auth-context';
import { formatDate, titleCase } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  displayValue,
  downloadReportExcel,
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
  branchId,
}: {
  list: ListState;
  filter: Extract<ReportFilter, { kind: 'source' }>;
  branchId?: string;
}) {
  const options = useSourceOptions(filter.source, branchId);
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

function PatientFilter({
  list,
  filter,
}: {
  list: ListState;
  filter: Extract<ReportFilter, { kind: 'patient' }>;
}) {
  const [search, setSearch] = useState('');
  const patients = usePatientSearch(search);
  const [label, setLabel] = useState<string | null>(null);
  return (
    <Combobox
      value={list.filters[filter.key] ?? null}
      onChange={(value, option) => {
        setLabel(option?.label ?? null);
        list.setFilter(filter.key, value ?? undefined);
      }}
      options={(patients.data ?? []).map((p) => ({ value: p.id, label: `${p.name} · ${p.phone}` }))}
      selectedLabel={label}
      onSearchChange={setSearch}
      loading={patients.isFetching}
      placeholder="All patients"
      searchPlaceholder="Name or phone"
      clearable
      className="h-9 w-64"
      aria-label={filter.label}
    />
  );
}

function DateFilter({ list, filter }: { list: ListState; filter: Extract<ReportFilter, { kind: 'date' }> }) {
  return (
    <label className="flex h-9 items-center gap-2 rounded-md border bg-background pl-3 text-sm text-muted-foreground">
      {filter.label}
      <Input
        type="date"
        aria-label={filter.label}
        value={list.filters[filter.key] ?? ''}
        className="h-8 w-36 border-0 shadow-none focus-visible:ring-0"
        onChange={(e) => list.setFilter(filter.key, e.target.value || undefined)}
      />
    </label>
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
        <span
          className={cn(
            'whitespace-pre-line',
            row.original.__total && 'font-semibold',
            index === 0 && 'font-medium',
          )}
        >
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
  const rows = data.byBranch;
  const keys = Object.keys(rows[0] ?? {});
  const numeric = (key: string) => key !== 'branch' && rows.some((row) => isNumeric(row[key] ?? null));
  return (
    <Panel title="By branch" className="mt-6" bodyClassName="overflow-x-auto p-0">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
            {keys.map((key) => (
              <th
                key={key}
                className={cn('px-4 py-2 font-medium', numeric(key) ? 'text-right' : 'text-left')}
              >
                {titleCase(key.replace(/([A-Z])/g, ' $1'))}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-b last:border-b-0">
              {keys.map((key) => (
                <td
                  key={key}
                  className={cn('px-4 py-2', numeric(key) ? 'text-right tabular-nums' : 'text-left')}
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
  const { isSuperAdmin } = useAuth();
  const branches = useBranchOptions(isSuperAdmin);
  const superAdminStock = (branches.data ?? []).find((b) => b.kind === 'warehouse')?.id;
  const sourceBranch = isSuperAdmin ? (list.filters.branchId ?? superAdminStock) : undefined;
  const branchOptions = (branches.data ?? [])
    .filter((b) => b.kind === 'branch')
    .map((b) => ({ value: b.id, label: `${b.name} · ${b.code}` }));

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
                downloadReportExcel(report.key, data.data?.title ?? report.title, query)
                  .catch(toastError)
                  .finally(() => setDownloading(false));
              }}
            >
              <Download />
              Excel
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
          {data.data ? <ReportCharts data={data.data} /> : null}
          <DataTable
            columns={data.data ? columnsFor(data.data) : []}
            data={data.data ? rowsWithTotals(data.data) : undefined}
            isLoading={data.isLoading}
            isFetching={data.isFetching}
            rowClassName={(row) => (row.__total ? 'bg-muted/50 hover:bg-muted/50' : undefined)}
            exportFileName={report.key}
            columnsMenu={report.columnsMenu}
            emptyTitle="Nothing in this period"
            emptyDescription="Change the dates or filters."
            toolbar={
              <>
                {isSuperAdmin ? (
                  <FilterSelect
                    list={list}
                    name="branchId"
                    allLabel="All branches"
                    className="w-48"
                    options={branchOptions}
                  />
                ) : null}
                <DateRangeFilter list={list} placeholder="This month" />
                {report.filters.map((filter) =>
                  filter.kind === 'source' ? (
                    <SourceFilter key={filter.key} list={list} filter={filter} branchId={sourceBranch} />
                  ) : filter.kind === 'text' ? (
                    <TextFilter key={filter.key} list={list} filter={filter} />
                  ) : filter.kind === 'date' ? (
                    <DateFilter key={filter.key} list={list} filter={filter} />
                  ) : filter.kind === 'patient' ? (
                    <PatientFilter key={filter.key} list={list} filter={filter} />
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
    <PrintPage
      paper={(data.data?.columns.length ?? 0) > 6 ? 'landscape' : 'a4'}
      isLoading={data.isLoading}
      error={data.error ?? (report ? null : new Error('Unknown report'))}
    >
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
              dense
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
