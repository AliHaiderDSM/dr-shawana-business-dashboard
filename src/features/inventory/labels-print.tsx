import { useQuery } from '@tanstack/react-query';
import JsBarcode from 'jsbarcode';
import { ArrowLeft, Printer } from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { ErrorState } from '@/components/shared/error-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { api, unwrap } from '@/lib/api/client';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { InventoryItem } from './api';

type Layout = 'roll' | 'sheet';

interface LabelSize {
  width: number;
  height: number;
  shift: number;
}

const SIZE_KEY = 'dsm.labelSize';
const DEFAULT_SIZE: LabelSize = { width: 38, height: 25, shift: 0 };

function readSize(): LabelSize {
  try {
    const raw = window.localStorage.getItem(SIZE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<LabelSize>) : {};
    return { ...DEFAULT_SIZE, ...parsed };
  } catch {
    return DEFAULT_SIZE;
  }
}

function saveSize(size: LabelSize) {
  try {
    window.localStorage.setItem(SIZE_KEY, JSON.stringify(size));
  } catch {
    return;
  }
}

const pageCss = (layout: Layout, size: LabelSize) =>
  layout === 'roll'
    ? `@page { size: ${size.width}mm ${size.height}mm; margin: 0; }`
    : '@page { size: A4; margin: 8mm; }';

function SizeField({
  label,
  value,
  onChange,
  min,
  max,
  step = 0.5,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
}) {
  return (
    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
      {label}
      <Input
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => {
          const next = Number(e.target.value);
          if (Number.isFinite(next) && next >= min && next <= max) onChange(next);
        }}
        className="h-8 w-16 px-2 text-right tabular-nums"
      />
      mm
    </label>
  );
}

function Barcode({ value }: { value: string }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    JsBarcode(ref.current, value, {
      format: 'CODE128',
      displayValue: false,
      margin: 0,
      height: 40,
      width: 1.4,
      lineColor: 'currentColor',
      background: 'transparent',
    });
  }, [value]);
  return (
    <svg ref={ref} className="h-[var(--barcode-h)] w-full" preserveAspectRatio="none" aria-label={value} />
  );
}

function Label({ item }: { item: InventoryItem }) {
  return (
    <div className="flex h-[var(--label-h)] w-[var(--label-w)] break-inside-avoid flex-col justify-center gap-[0.8mm] overflow-hidden bg-background px-[2mm] pt-[var(--label-pad-top)] pb-[var(--label-pad-bottom)] text-foreground print:h-[calc(var(--label-h)-0.3mm)]">
      <div className="truncate text-[7pt] leading-tight font-semibold">{item.productName}</div>
      <Barcode value={item.serial} />
      <div className="space-y-[0.4mm] text-[6pt] leading-none">
        <div className="flex items-baseline justify-between gap-1">
          <span className="shrink-0 font-mono text-[6.5pt] font-semibold">{item.serial}</span>
          {item.batchNo ? <span className="min-w-0 truncate font-mono">{item.batchNo}</span> : null}
        </div>
        {item.manufacturingDate || item.expiryDate ? (
          <div className="flex items-baseline justify-between gap-1 tabular-nums">
            <span>
              {item.manufacturingDate ? `MFG ${formatDate(item.manufacturingDate, 'MM/yyyy')}` : ''}
            </span>
            <span className="font-semibold">
              {item.expiryDate ? `EXP ${formatDate(item.expiryDate, 'MM/yyyy')}` : ''}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

async function fetchAll(query: Record<string, string>) {
  const items: InventoryItem[] = [];
  for (let page = 1; ; page += 1) {
    const result = await unwrap(
      api.GET('/branch/inventory/items', { params: { query: { ...query, page, pageSize: 100 } } }),
    );
    items.push(...result.data);
    if (page >= (result.meta?.totalPages ?? 1)) return items;
  }
}

export function LabelsPrint() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [layout, setLayout] = useState<Layout>('roll');
  const [size, setSizeState] = useState<LabelSize>(readSize);
  const setSize = (changes: Partial<LabelSize>) =>
    setSizeState((current) => {
      const next = { ...current, ...changes };
      saveSize(next);
      return next;
    });
  const sizeVars = {
    '--label-w': `${size.width}mm`,
    '--label-h': `${size.height}mm`,
    '--barcode-h': `${Math.max(5, size.height * 0.36).toFixed(1)}mm`,
    '--label-pad-top': `${Math.max(0, 1 + size.shift)}mm`,
    '--label-pad-bottom': `${Math.max(0, 1 - size.shift)}mm`,
  } as CSSProperties;
  const source = params.get('source');
  const sourceIds = (params.get('sourceIds') ?? '').split(',').filter(Boolean);
  const from = params.get('from');
  const to = params.get('to');
  const productId = params.get('productId');
  const batchId = params.get('batchId');
  const withoutBatch = params.get('withoutBatch');

  const query = useQuery({
    queryKey: ['stock', 'labels-print', source, sourceIds, from, to, productId, batchId, withoutBatch],
    queryFn: async () => {
      if (source && sourceIds.length) {
        const lists = await Promise.all(sourceIds.map((sourceId) => fetchAll({ source, sourceId })));
        return lists.flat();
      }
      return fetchAll({
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
        ...(batchId ? { batchId } : {}),
        ...(productId && withoutBatch ? { productId, withoutBatch } : {}),
        ...(productId && !withoutBatch && !batchId ? { productId, status: 'in_stock' } : {}),
      });
    },
  });

  const items = query.data ?? [];

  return (
    <div
      className={cn('min-h-screen bg-muted/40 py-8 print:min-h-0 print:bg-background print:py-0', layout)}
      style={sizeVars}
    >
      <style>{pageCss(layout, size)}</style>
      <div className="no-print mx-auto mb-6 flex max-w-[210mm] flex-wrap items-center gap-3 px-4">
        <Button variant="outline" onClick={() => void navigate(-1)}>
          <ArrowLeft />
          Back
        </Button>
        <div className="min-w-0 flex-1">
          <div className="font-semibold">{items.length} labels</div>
          <div className="text-xs text-muted-foreground">
            {items.length ? `${items[0]!.serial} to ${items.at(-1)!.serial}` : ''}
          </div>
        </div>
        <ToggleGroup
          type="single"
          variant="outline"
          value={layout}
          onValueChange={(value) => value && setLayout(value as Layout)}
        >
          <ToggleGroupItem value="roll">
            Label roll {size.width}×{size.height} mm
          </ToggleGroupItem>
          <ToggleGroupItem value="sheet">A4 sheet</ToggleGroupItem>
        </ToggleGroup>
        <Button onClick={() => window.print()} disabled={items.length === 0}>
          <Printer />
          Print
        </Button>
        {layout === 'roll' ? (
          <div className="flex w-full flex-wrap items-center gap-4 rounded-lg border bg-card px-3 py-2">
            <span className="text-xs font-medium">Sticker size</span>
            <SizeField
              label="Width"
              value={size.width}
              min={20}
              max={110}
              onChange={(width) => setSize({ width })}
            />
            <SizeField
              label="Height"
              value={size.height}
              min={10}
              max={80}
              onChange={(height) => setSize({ height })}
            />
            <SizeField
              label="Shift down"
              value={size.shift}
              min={-3}
              max={3}
              step={0.25}
              onChange={(shift) => setSize({ shift })}
            />
            <Button variant="ghost" size="sm" onClick={() => setSize(DEFAULT_SIZE)}>
              Reset
            </Button>
            <span className="text-xs text-muted-foreground">
              Use the exact sticker size. A minus shift moves the print up.
            </span>
          </div>
        ) : null}
      </div>
      <div className="mx-auto max-w-[210mm] px-4 print:max-w-none print:px-0">
        {query.isLoading ? (
          <div className="grid grid-cols-5 gap-2">
            {Array.from({ length: 10 }, (_, i) => (
              <Skeleton key={i} className="h-[var(--label-h)] w-[var(--label-w)]" />
            ))}
          </div>
        ) : query.error ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : (
          <div
            className={cn(
              'print-area flex flex-wrap gap-2 print:gap-0',
              layout === 'sheet' && 'print:grid print:grid-cols-5 print:gap-[1mm]',
              layout === 'roll' && 'print:block',
            )}
          >
            {items.map((item, index) => (
              <div
                key={item.id}
                className={cn(
                  'rounded-sm border print:rounded-none print:border-0 [.sheet_&]:print:border',
                  layout === 'roll' && index < items.length - 1 && 'print:break-after-page',
                )}
              >
                <Label item={item} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
