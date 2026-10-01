import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';
import { z } from 'zod';
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
import { cn } from '@/lib/utils';
import {
  BLOOD_TEST_LABELS,
  BLOOD_TESTS,
  useAddBloodWork,
  useBloodWork,
  useRemoveBloodWork,
  useUpdateBloodWork,
  type BloodTest,
} from './api';

const schema = z.object({
  testDate: z.string().min(1, 'Choose the test date'),
  values: z
    .array(
      z.object({
        value: z
          .string()
          .trim()
          .regex(/^(\d{1,8}(\.\d{1,3})?)?$/, 'Use a number'),
      }),
    )
    .refine((rows) => rows.some((r) => r.value && Number(r.value) > 0), 'Enter at least one result'),
});

type Values = z.input<typeof schema>;

function AddResultsSheet({
  patientId,
  consultationId,
  open,
  onOpenChange,
}: {
  patientId: string;
  consultationId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const add = useAddBloodWork(patientId);
  const form = useForm<Values, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { testDate: isoDate(), values: BLOOD_TESTS.map(() => ({ value: '' })) },
  });

  const submit = form.handleSubmit((values) =>
    add.mutate(
      {
        consultationId: consultationId ?? null,
        results: BLOOD_TESTS.flatMap((test, index) => {
          const value = values.values[index]?.value;
          return value && Number(value) > 0
            ? [{ test: test.test, value, unit: test.unit, testDate: values.testDate }]
            : [];
        }),
      },
      {
        onSuccess: () => {
          toast.success('Blood work saved');
          form.reset();
          onOpenChange(false);
        },
        onError: (error) => applyServerErrors(form, error),
      },
    ),
  );

  const rootError = form.formState.errors.values?.root?.message ?? form.formState.errors.values?.message;

  return (
    <Form {...form}>
      <FormSheet
        open={open}
        onOpenChange={onOpenChange}
        title="Add blood work"
        description="Fill only the tests that were done. Empty or zero means not done, as in posSoft."
        onSubmit={submit}
        submitting={add.isPending}
        submitLabel="Save results"
      >
        <TextField control={form.control} name="testDate" label="Test date" type="date" required />
        <LineItems
          columns={[
            { header: 'Test', width: 'minmax(0,1fr)' },
            { header: 'Value', width: '8rem' },
            { header: 'Unit', width: '5.5rem' },
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

function ResultCell({
  patientId,
  point,
  canEdit,
}: {
  patientId: string;
  point: { id: string; date: string; value: string };
  canEdit: boolean;
}) {
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
  const [adding, setAdding] = useState(false);
  const [chartTest, setChartTest] = useState<BloodTest | null>(null);
  const data = blood.data;
  const dates = data?.dates ?? [];
  const testsWithData = data?.tests.filter((t) => t.points.length > 0) ?? [];
  const activeTest = chartTest ?? testsWithData[0]?.test ?? null;
  const series = data?.tests.find((t) => t.test === activeTest);

  return (
    <Panel
      title="Blood work"
      description="One column per test date. Click a value to correct it."
      bodyClassName="p-0"
      actions={
        canEdit ? (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
                  <th className="sticky left-0 bg-muted px-4 py-2 text-left font-medium">Test</th>
                  {dates.map((date) => (
                    <th key={date} className="px-3 py-2 text-right font-medium whitespace-nowrap">
                      {formatDate(date)}
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
                          className={cn(
                            'text-left hover:text-primary',
                            activeTest === test.test && 'font-semibold text-primary',
                          )}
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
          {series && series.points.length > 0 ? (
            <div className="space-y-3 border-t p-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold">Trend</h3>
                <Select value={activeTest ?? undefined} onValueChange={(v) => setChartTest(v as BloodTest)}>
                  <SelectTrigger size="sm" className="w-52" aria-label="Test">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {testsWithData.map((t) => (
                      <SelectItem key={t.test} value={t.test}>
                        {BLOOD_TEST_LABELS[t.test]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={[...series.points]
                      .sort((a, b) => a.date.localeCompare(b.date))
                      .map((p) => ({ date: formatDate(p.date, 'dd MMM yy'), value: Number(p.value) }))}
                    margin={{ top: 8, right: 16, bottom: 0, left: -8 }}
                  >
                    <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" vertical={false} />
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
                      formatter={(value) => [
                        `${String(value)} ${series.unit}`,
                        BLOOD_TEST_LABELS[series.test],
                      ]}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="var(--chart-1)"
                      strokeWidth={2}
                      dot={{ r: 3, fill: 'var(--chart-1)' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : null}
        </>
      )}
      {canEdit ? (
        <AddResultsSheet
          patientId={patientId}
          consultationId={consultationId}
          open={adding}
          onOpenChange={setAdding}
        />
      ) : null}
    </Panel>
  );
}
