import { useQuery } from '@tanstack/react-query';
import JsBarcode from 'jsbarcode';
import { ArrowLeft, Printer } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { ErrorState } from '@/components/shared/error-state';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { api, unwrap } from '@/lib/api/client';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { InventoryItem } from './api';

type Layout = 'roll' | 'sheet';

const PAGE_CSS: Record<Layout, string> = {
  roll: '@page { size: 38mm 25mm; margin: 0; }',
  sheet: '@page { size: A4; margin: 8mm; }',
};

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
  return <svg ref={ref} className="h-[9mm] w-full" preserveAspectRatio="none" aria-label={value} />;
}

function Label({ item }: { item: InventoryItem }) {
  return (
    <div className="flex h-[25mm] w-[38mm] break-inside-avoid flex-col justify-between overflow-hidden bg-background px-[2mm] py-[1.5mm] text-foreground print:break-after-page [.sheet_&]:print:break-after-auto">
      <div className="truncate text-[7pt] leading-tight font-semibold">{item.productName}</div>
      <Barcode value={item.serial} />
      <div className="flex items-baseline justify-between gap-1 text-[6.5pt] leading-tight">
        <span className="font-mono font-semibold">{item.serial}</span>
        <span className="truncate text-muted-foreground">
          {[item.batchNo, item.expiryDate ? `exp ${formatDate(item.expiryDate, 'MM/yy')}` : null]
            .filter(Boolean)
            .join(' · ')}
        </span>
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
  const source = params.get('source');
  const sourceIds = (params.get('sourceIds') ?? '').split(',').filter(Boolean);
  const from = params.get('from');
  const to = params.get('to');
  const productId = params.get('productId');

  const query = useQuery({
    queryKey: ['stock', 'labels-print', source, sourceIds, from, to, productId],
    queryFn: async () => {
      if (source && sourceIds.length) {
        const lists = await Promise.all(sourceIds.map((sourceId) => fetchAll({ source, sourceId })));
        return lists.flat();
      }
      return fetchAll({
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
        ...(productId ? { productId, status: 'in_stock' } : {}),
      });
    },
  });

  const items = query.data ?? [];

  return (
    <div className={cn('min-h-screen bg-muted/40 py-8 print:bg-background print:py-0', layout)}>
      <style>{PAGE_CSS[layout]}</style>
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
          <ToggleGroupItem value="roll">Label roll 38×25 mm</ToggleGroupItem>
          <ToggleGroupItem value="sheet">A4 sheet</ToggleGroupItem>
        </ToggleGroup>
        <Button onClick={() => window.print()} disabled={items.length === 0}>
          <Printer />
          Print
        </Button>
      </div>
      <div className="mx-auto max-w-[210mm] px-4 print:max-w-none print:px-0">
        {query.isLoading ? (
          <div className="grid grid-cols-5 gap-2">
            {Array.from({ length: 10 }, (_, i) => (
              <Skeleton key={i} className="h-[25mm] w-[38mm]" />
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
            {items.map((item) => (
              <div
                key={item.id}
                className="rounded-sm border print:rounded-none print:border-0 [.sheet_&]:print:border"
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
