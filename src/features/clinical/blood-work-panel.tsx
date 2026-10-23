import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Pencil, Plus, Sparkles, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';
import { z } from 'zod';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { TextField } from '@/components/shared/form-fields';
import { FormSheet } from '@/components/shared/form-sheet';
import { InlineQuantityField, LineItems } from '@/components/shared/line-items';
import { Panel } from '@/components/shared/panel';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { applyServerErrors, toastError } from '@/lib/api/errors';
import { CHARTJS_CURVE } from '@/lib/chartjs-curve';
import { prepareReportFiles, REPORT_ACCEPT, ReportFileError } from './prepare-report-files';
import { useReportSelection } from './report-selection';
import { formatDate, formatQuantity, isoDate } from '@/lib/format';
import {
  useAddBloodWorkMutation,
  useBloodWork,
  useReadBloodReportMutation,
  useRemoveBloodWorkMutation,
  useUpdateBloodWorkMutation,
  type BloodTest,
} from '@redux/features/clinical';
import { BLOOD_TEST_LABELS, BLOOD_TESTS } from './constants';
// import { ReportSummaries } from './report-summaries';

const ALL = 'all';

const colorOf = (test: BloodTest) =>
  `var(--blood-${
    Math.max(
      0,
      BLOOD_TESTS.findIndex((b) => b.test === test),
    ) + 1
  })`;

const schema = z.object({
  testDate: z.string().min(1, 'Choose the test date'),
  values: z.array(
    z.object({
      value: z
        .string()
        .trim()
        .regex(/^(\d{1,8}(\.\d{1,3})?)?$/, 'Use a number'),
    }),
  ),
});

type Values = z.input<typeof schema>;

type Point = { id: string; date: string; value: string };
type BloodData = NonNullable<ReturnType<typeof useBloodWork>['data']>;

function pointsOn(data: BloodData | undefined, date: string) {
  return BLOOD_TESTS.map((t) =>
    data?.tests.find((row) => row.test === t.test)?.points.find((p) => p.date === date),
  );
}

function ResultsSheet({
  patientId,
  consultationId,
  editDate,
  data,
  prefill,
  open,
  onOpenChange,
}: {
  patientId: string;
  consultationId?: string;
  editDate: string | null;
  data: BloodData | undefined;
  prefill?: Record<string, string>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [add] = useAddBloodWorkMutation();
  const [update] = useUpdateBloodWorkMutation();
  const [remove] = useRemoveBloodWorkMutation();
  const existing = editDate ? pointsOn(data, editDate) : [];
  const form = useForm<Values, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      testDate: editDate ?? isoDate(),
      values: BLOOD_TESTS.map((test, index) => ({
        value: existing[index] ? String(Number(existing[index].value)) : (prefill?.[test.test] ?? ''),
      })),
    },
  });
  const [saving, setSaving] = useState(false);

  const submit = form.handleSubmit(async (values) => {
    const entered = BLOOD_TESTS.map((test, index) => ({
      test,
      value: values.values[index]?.value ?? '',
      point: existing[index],
    }));
    if (!editDate && !entered.some((e) => e.value && Number(e.value) > 0)) {
      form.setError('values', { message: 'Enter at least one result' });
      return;
    }
    setSaving(true);
    try {
      const toAdd = entered.filter((e) => !e.point && e.value && Number(e.value) > 0);
      if (toAdd.length) {
        await add({
          patientId,
          body: {
            consultationId: consultationId ?? null,
            results: toAdd.map((e) => ({
              test: e.test.test,
              value: e.value,
              unit: e.test.unit,
              testDate: values.testDate,
            })),
          },
        }).unwrap();
      }
      for (const e of entered) {
        if (!e.point) continue;
        if (!e.value || Number(e.value) === 0) await remove({ patientId, resultId: e.point.id }).unwrap();
        else if (Number(e.value) !== Number(e.point.value) || values.testDate !== editDate)
          await update({
            patientId,
            resultId: e.point.id,
            body: { value: e.value, testDate: values.testDate },
          }).unwrap();
      }
      toast.success(editDate ? 'Blood work updated' : 'Blood work saved');
      onOpenChange(false);
    } catch (error) {
      applyServerErrors(form, error);
      toastError(error);
    } finally {
      setSaving(false);
    }
  });

  const rootError = form.formState.errors.values?.root?.message ?? form.formState.errors.values?.message;

  return (
    <Form {...form}>
      <FormSheet
        open={open}
        onOpenChange={onOpenChange}
        title={editDate ? `Edit blood work · ${formatDate(editDate)}` : 'Add blood work'}
        description={
          editDate
            ? 'Change any value, or clear it to remove that result. Changing the date moves the whole column.'
            : prefill
              ? 'Values were read from the report by AI, but the report shows no date. Set the test date, check the values and save.'
              : 'Fill only the tests that were done. Empty or zero means not done, as in posSoft. If this date already has a result for a test, the new value replaces it.'
        }
        onSubmit={submit}
        submitting={saving}
        submitLabel={editDate ? 'Save changes' : 'Save results'}
        size="lg"
      >
        <TextField control={form.control} name="testDate" label="Test date" type="date" required />
        <LineItems
          columns={[
            { header: 'Test', width: 'minmax(0,1fr)' },
            { header: 'Value', width: '10rem' },
            { header: 'Unit', width: '6rem' },
          ]}
          rowKeys={BLOOD_TESTS.map((t) => t.test)}
          renderRow={(index) => [
            <span key="label" className="flex h-9 items-center text-sm font-medium">
              {BLOOD_TESTS[index]?.label}
            </span>,
            <InlineQuantityField
              key="value"
              control={form.control}
              name={`values.${index}.value`}
              label={BLOOD_TESTS[index]?.label ?? 'Value'}
              placeholder="—"
            />,
            <span key="unit" className="flex h-9 items-center text-xs text-muted-foreground">
              {BLOOD_TESTS[index]?.unit}
            </span>,
          ]}
          error={rootError}
        />
      </FormSheet>
    </Form>
  );
}

function ResultCell({ patientId, point, canEdit }: { patientId: string; point: Point; canEdit: boolean }) {
  const [updateResult, update] = useUpdateBloodWorkMutation();
  const [removeResult, remove] = useRemoveBloodWorkMutation();
  const [value, setValue] = useState(point.value);
  const [open, setOpen] = useState(false);
  if (!canEdit) return <span>{formatQuantity(point.value)}</span>;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="rounded px-1.5 py-0.5 font-medium hover:bg-muted">
          {formatQuantity(point.value)}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-60 space-y-3" align="center">
        <div className="text-xs text-muted-foreground">Result on {formatDate(point.date)}</div>
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          inputMode="decimal"
          aria-label="Value"
        />
        <div className="flex justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive"
            disabled={remove.isLoading}
            onClick={() =>
              removeResult({ patientId, resultId: point.id })
                .unwrap()
                .then(() => {
                  toast.success('Result removed');
                  setOpen(false);
                })
                .catch(toastError)
            }
          >
            <Trash2 />
            Remove
          </Button>
          <Button
            size="sm"
            disabled={update.isLoading || !/^\d{1,8}(\.\d{1,3})?$/.test(value)}
            onClick={() =>
              updateResult({ patientId, resultId: point.id, body: { value } })
                .unwrap()
                .then(() => {
                  toast.success('Result updated');
                  setOpen(false);
                })
                .catch(toastError)
            }
          >
            Save
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function BloodWorkPanel({
  patientId,
  consultationId,
  canEdit,
}: {
  patientId: string;
  consultationId?: string;
  canEdit: boolean;
}) {
  const blood = useBloodWork(patientId);
  const [remove] = useRemoveBloodWorkMutation();
  const [sheet, setSheet] = useState<{
    date: string | null;
    key: number;
    prefill?: Record<string, string>;
  } | null>(null);
  const [read] = useReadBloodReportMutation();
  const [add] = useAddBloodWorkMutation();
  const [reading, setReading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const selection = useReportSelection();
  const chosen = selection?.selected ?? [];

  const readReport = async (picked: File[], recordFileIds: string[]) => {
    setReading(true);
    try {
      let files: File[];
      try {
        files = await prepareReportFiles(picked);
      } catch (error) {
        if (error instanceof ReportFileError) {
          toast.error(error.message, { duration: 10000 });
          return false;
        }
        throw error;
      }
      const found = await read({ patientId, files, recordFileIds }).unwrap();
      if (recordFileIds.length) selection?.clear();
      if (found.results.length === 0) {
        toast.message(
          'No FSH, estradiol, testosterone, DHEA-S, vitamin D, TSH, ferritin or B12 value was found on these reports.',
        );
        return true;
      }
      const dated = new Map<string, typeof found.results>();
      const undated = found.results.filter((r) => !r.testDate);
      for (const r of found.results) {
        if (!r.testDate) continue;
        dated.set(r.testDate, [...(dated.get(r.testDate) ?? []), r]);
      }
      for (const [testDate, results] of dated) {
        await add({
          patientId,
          body: {
            consultationId: consultationId ?? null,
            results: results.map((r) => ({ test: r.test, value: r.value, unit: r.unit, testDate })),
          },
        }).unwrap();
      }
      setChartTest(ALL);
      const saved = found.results.length - undated.length;
      if (saved > 0) {
        toast.success(
          `${saved} value${saved === 1 ? '' : 's'} saved for ${[...dated.keys()].map((d) => formatDate(d)).join(', ')}; tests not on the reports show —. ✏️ corrects any mistake.`,
        );
      }
      if (undated.length) {
        setSheet((current) => ({
          date: null,
          key: (current?.key ?? 0) + 1,
          prefill: Object.fromEntries(undated.map((r) => [r.test, r.value])),
        }));
      }
      return true;
    } catch (error) {
      toastError(error);
      return false;
    } finally {
      setReading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };
  const [removingDate, setRemovingDate] = useState<string | null>(null);
  const [chartTest, setChartTest] = useState<BloodTest | typeof ALL>(ALL);
  const data = blood.data;
  const dates = [...(data?.dates ?? [])].sort((a, b) => a.localeCompare(b));
  const testsWithData = BLOOD_TESTS.filter((t) =>
    data?.tests.some((row) => row.test === t.test && row.points.length > 0),
  );
  const shown = chartTest === ALL ? testsWithData : testsWithData.filter((t) => t.test === chartTest);
  const chartRows = dates.map((date) => {
    const row: Record<string, string | number | null> = { date: formatDate(date, 'dd-MM-yyyy') };
    for (const t of testsWithData) {
      const point = data?.tests.find((r) => r.test === t.test)?.points.find((p) => p.date === date);
      row[t.test] = point ? Number(point.value) : null;
    }
    return row;
  });
  const highest = Math.max(
    0,
    ...chartRows.flatMap((row) =>
      shown.map((t) => row[t.test]).filter((v): v is number => typeof v === 'number'),
    ),
  );
  const chartTop = Math.max(350, Math.ceil(highest / 50) * 50);
  const yTicks = Array.from({ length: chartTop / 50 + 1 }, (_, i) => i * 50);

  return (
    <Panel
      title="Blood work"
      description="One column per test date. Use ✏️ / 🗑️ on a date, or click a value to correct it."
      bodyClassName="p-0"
      actions={
        canEdit ? (
          <>
            <input
              ref={fileInput}
              type="file"
              accept={REPORT_ACCEPT}
              multiple
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                if (files.length) void readReport(files, []);
              }}
            />
            <Button
              size="sm"
              variant={chosen.length ? 'default' : 'outline'}
              disabled={reading}
              title={
                chosen.length
                  ? 'Read the reports ticked under Medical and imaging records. AI reads the values into the table and chart.'
                  : 'Tick saved reports under Medical and imaging records first, or click to upload up to 5 lab reports from this device (PDF, JPG, PNG, WebP or HEIC; 4.3 MB in total). AI reads the values into the table and chart.'
              }
              onClick={() => (chosen.length ? void readReport([], chosen) : fileInput.current?.click())}
            >
              {reading ? <Loader2 className="animate-spin" /> : <Sparkles />}
              {reading
                ? 'Reading report…'
                : chosen.length
                  ? `Read ${chosen.length} selected (AI)`
                  : 'Read report (AI)'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setSheet({ date: null, key: Date.now() })}>
              <Plus />
              Add results
            </Button>
          </>
        ) : null
      }
    >
      {blood.isLoading ? (
        <div className="p-5">
          <Skeleton className="h-40 w-full" />
        </div>
      ) : dates.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">No blood work recorded yet.</p>
      ) : (
        <>
          <div className="space-y-3 border-b p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-semibold">
                {chartTest === ALL ? 'All results over time' : `${BLOOD_TEST_LABELS[chartTest]} over time`}
              </h3>
              <span className="text-xs text-muted-foreground">
                Click a test in the legend to show only that test; click it again to show all.
              </span>
            </div>
            {dates.length < 2 ? (
              <div className="space-y-3">
                <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
                  Only one test date so far ({formatDate(dates[0] ?? '')}). The trend lines appear once a
                  second date is added; until then the results are listed here.
                </p>
                <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
                  {shown.map((t) => {
                    const point = data?.tests.find((r) => r.test === t.test)?.points[0];
                    return (
                      <div key={t.test} className="rounded-lg border bg-muted/30 px-3 py-2">
                        <div className="text-xs text-muted-foreground">{t.label}</div>
                        <div className="font-semibold tabular-nums">
                          {point ? formatQuantity(point.value) : '—'}{' '}
                          <span className="text-xs font-normal text-muted-foreground">{t.unit}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="h-[30rem]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartRows} margin={{ top: 8, right: 16, bottom: 0, left: -8 }}>
                    <CartesianGrid stroke="var(--chart-grid)" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
                      tickLine={false}
                      axisLine={{ stroke: 'var(--chart-grid)' }}
                    />
                    <YAxis
                      domain={[0, chartTop]}
                      ticks={yTicks}
                      interval={0}
                      allowDecimals={false}
                      tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
                      tickLine={false}
                      axisLine={{ stroke: 'var(--chart-grid)' }}
                      width={48}
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--popover)',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        color: 'var(--popover-foreground)',
                        fontSize: 12,
                      }}
                      formatter={(value, name) => {
                        const test = BLOOD_TESTS.find((t) => t.test === name);
                        return [`${String(value)} ${test?.unit ?? ''}`, test?.label ?? String(name)];
                      }}
                    />
                    <Legend
                      verticalAlign="top"
                      height={32}
                      iconType="plainline"
                      wrapperStyle={{ fontSize: 12, cursor: 'pointer' }}
                      onClick={(entry) => {
                        const key = String(entry.dataKey) as BloodTest;
                        setChartTest((current) => (current === key ? ALL : key));
                      }}
                      formatter={(value: string) => (
                        <span
                          className={
                            chartTest !== ALL && chartTest !== value
                              ? 'text-muted-foreground line-through'
                              : 'text-foreground'
                          }
                        >
                          {BLOOD_TEST_LABELS[value as BloodTest] ?? value}
                        </span>
                      )}
                    />
                    {testsWithData.map((t) => (
                      <Line
                        key={t.test}
                        type={CHARTJS_CURVE}
                        dataKey={t.test}
                        name={t.test}
                        hide={chartTest !== ALL && chartTest !== t.test}
                        stroke={colorOf(t.test)}
                        strokeWidth={2}
                        dot={{ r: 3, fill: 'var(--card)', stroke: colorOf(t.test), strokeWidth: 1 }}
                        activeDot={{ r: 4, fill: colorOf(t.test) }}
                        connectNulls
                        isAnimationActive={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
                  <th className="sticky left-0 bg-muted px-4 py-2 text-left font-medium">Blood test</th>
                  {dates.map((date) => (
                    <th key={date} className="px-3 py-2 text-center font-medium whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <span className="text-foreground">{formatDate(date, 'dd-MM-yyyy')}</span>
                        {canEdit ? (
                          <>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              aria-label={`Edit results of ${formatDate(date)}`}
                              onClick={() => setSheet({ date, key: Date.now() })}
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-7 text-destructive"
                              aria-label={`Delete results of ${formatDate(date)}`}
                              onClick={() => setRemovingDate(date)}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {BLOOD_TESTS.map((test) => {
                  const row = data?.tests.find((t) => t.test === test.test);
                  return (
                    <tr key={test.test} className="border-b last:border-b-0">
                      <td className="sticky left-0 bg-card px-4 py-2">
                        <button
                          type="button"
                          onClick={() => setChartTest(test.test)}
                          className="text-left font-medium hover:text-primary"
                        >
                          {test.label}
                        </button>
                        <div className="text-xs text-muted-foreground">{row?.unit ?? test.unit}</div>
                      </td>
                      {dates.map((date) => {
                        const point = row?.points.find((p) => p.date === date);
                        return (
                          <td key={date} className="px-3 py-2 text-center tabular-nums">
                            {point ? (
                              <ResultCell patientId={patientId} point={point} canEdit={canEdit} />
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
      {/* <ReportSummaries patientId={patientId} canEdit={canEdit} /> */}
      {canEdit && sheet ? (
        <ResultsSheet
          key={sheet.key}
          patientId={patientId}
          consultationId={consultationId}
          editDate={sheet.date}
          prefill={sheet.prefill}
          data={data}
          open
          onOpenChange={(open) => !open && setSheet(null)}
        />
      ) : null}
      <ConfirmDialog
        open={removingDate !== null}
        onOpenChange={(open) => !open && setRemovingDate(null)}
        title={`Delete all results of ${removingDate ? formatDate(removingDate) : ''}?`}
        description="Every blood test value of this date is removed."
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (!removingDate) return;
          try {
            for (const point of pointsOn(data, removingDate))
              if (point) await remove({ patientId, resultId: point.id }).unwrap();
            toast.success('Results deleted');
          } catch (error) {
            toastError(error);
          }
        }}
      />
    </Panel>
  );
}
