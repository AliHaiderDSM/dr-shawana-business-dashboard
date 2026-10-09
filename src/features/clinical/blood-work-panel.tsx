import { zodResolver } from '@hookform/resolvers/zod';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { applyServerErrors, toastError } from '@/lib/api/errors';
import { formatDate, formatQuantity, isoDate } from '@/lib/format';
import {
  BLOOD_TEST_LABELS,
  BLOOD_TESTS,
  useAddBloodWork,
  useBloodWork,
  useRemoveBloodWork,
  useUpdateBloodWork,
  type BloodTest,
} from './api';

const ALL = 'all';

const SERIES_STYLE = [
  { stroke: 'var(--chart-1)' },
  { stroke: 'var(--chart-4)' },
  { stroke: 'var(--chart-2)' },
  { stroke: 'var(--chart-3)' },
  { stroke: 'var(--chart-5)' },
  { stroke: 'var(--chart-1)', dash: '6 4' },
  { stroke: 'var(--chart-4)', dash: '6 4' },
  { stroke: 'var(--chart-2)', dash: '6 4' },
  { stroke: 'var(--chart-3)', dash: '6 4' },
];

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
  open,
  onOpenChange,
}: {
  patientId: string;
  consultationId?: string;
  editDate: string | null;
  data: BloodData | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const add = useAddBloodWork(patientId);
  const update = useUpdateBloodWork(patientId);
  const remove = useRemoveBloodWork(patientId);
  const existing = editDate ? pointsOn(data, editDate) : [];
  const form = useForm<Values, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      testDate: editDate ?? isoDate(),
      values: BLOOD_TESTS.map((_, index) => ({
        value: existing[index] ? String(Number(existing[index].value)) : '',
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
        await add.mutateAsync({
          consultationId: consultationId ?? null,
          results: toAdd.map((e) => ({
            test: e.test.test,
            value: e.value,
            unit: e.test.unit,
            testDate: values.testDate,
          })),
        });
      }
      for (const e of entered) {
        if (!e.point) continue;
        if (!e.value || Number(e.value) === 0) await remove.mutateAsync(e.point.id);
        else if (Number(e.value) !== Number(e.point.value) || values.testDate !== editDate)
          await update.mutateAsync({
            resultId: e.point.id,
            body: { value: e.value, testDate: values.testDate },
          });
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
            : 'Fill only the tests that were done. Empty or zero means not done, as in posSoft.'
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
  const update = useUpdateBloodWork(patientId);
  const remove = useRemoveBloodWork(patientId);
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
            disabled={remove.isPending}
            onClick={() =>
              remove
                .mutateAsync(point.id)
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
            disabled={update.isPending || !/^\d{1,8}(\.\d{1,3})?$/.test(value)}
            onClick={() =>
              update
                .mutateAsync({ resultId: point.id, body: { value } })
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
  const remove = useRemoveBloodWork(patientId);
  const [sheet, setSheet] = useState<{ date: string | null; key: number } | null>(null);
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
    for (const t of shown) {
      const point = data?.tests.find((r) => r.test === t.test)?.points.find((p) => p.date === date);
      row[t.test] = point ? Number(point.value) : null;
    }
    return row;
  });

  return (
    <Panel
      title="Blood work"
      description="One column per test date. Edit or delete a whole date from its header, or click a value to correct it."
      bodyClassName="p-0"
      actions={
        canEdit ? (
          <Button size="sm" variant="outline" onClick={() => setSheet({ date: null, key: Date.now() })}>
            <Plus />
            Add results
          </Button>
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
              <Select value={chartTest} onValueChange={(v) => setChartTest(v as BloodTest | typeof ALL)}>
                <SelectTrigger size="sm" className="w-56" aria-label="Test">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All tests</SelectItem>
                  {testsWithData.map((t) => (
                    <SelectItem key={t.test} value={t.test}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartRows} margin={{ top: 8, right: 16, bottom: 0, left: -8 }}>
                  <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
                    tickLine={false}
                    axisLine={false}
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
                  {shown.length > 1 ? (
                    <Legend
                      formatter={(value: string) => BLOOD_TEST_LABELS[value as BloodTest] ?? value}
                      wrapperStyle={{ fontSize: 12, color: 'var(--muted-foreground)' }}
                    />
                  ) : null}
                  {shown.map((t) => {
                    const style =
                      SERIES_STYLE[BLOOD_TESTS.findIndex((b) => b.test === t.test)] ?? SERIES_STYLE[0];
                    return (
                      <Line
                        key={t.test}
                        type="monotone"
                        dataKey={t.test}
                        name={t.test}
                        stroke={style?.stroke}
                        strokeDasharray={style?.dash}
                        strokeWidth={2}
                        dot={{ r: 4, fill: style?.stroke, strokeWidth: 2, stroke: 'var(--card)' }}
                        activeDot={{ r: 6 }}
                        connectNulls
                      />
                    );
                  })}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
                  <th className="sticky left-0 bg-muted px-4 py-2 text-left font-medium">Blood test</th>
                  {dates.map((date) => (
                    <th key={date} className="px-3 py-2 text-right font-medium whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
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
                          <td key={date} className="px-3 py-2 text-right tabular-nums">
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
      {canEdit && sheet ? (
        <ResultsSheet
          key={sheet.key}
          patientId={patientId}
          consultationId={consultationId}
          editDate={sheet.date}
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
            for (const point of pointsOn(data, removingDate)) if (point) await remove.mutateAsync(point.id);
            toast.success('Results deleted');
          } catch (error) {
            toastError(error);
          }
        }}
      />
    </Panel>
  );
}
