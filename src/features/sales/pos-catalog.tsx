import { Gift, Package, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { BarcodeScanInput } from '@/components/shared/barcode-scan-input';
import { Thumb } from '@/components/shared/thumb';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { bundlesApi, categoriesApi, findProductByBarcode, productsApi } from '@/features/catalog/api';
import { useStockBalances } from '@/features/inventory/api';
import { toastError } from '@/lib/api/errors';
import { formatMoney, formatQuantity } from '@/lib/format';
import { cn } from '@/lib/utils';
import { isSerial } from '@/features/inventory/api';
import { toast } from 'sonner';

export interface CatalogPick {
  kind: 'product' | 'bundle';
  refId: string;
  name: string;
  price: string;
  available?: string;
  parts?: { productId: string; qty: string }[];
}

function useDebounced<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function Card({
  name,
  price,
  imageUrl,
  meta,
  low,
  inCart,
  onPick,
}: {
  name: string;
  price: string;
  imageUrl?: string | null;
  meta?: string;
  low?: boolean;
  inCart?: string;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      className={cn(
        'group relative flex flex-col gap-2 rounded-xl border bg-card p-3 text-left shadow-xs transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-sm focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
        inCart && 'border-primary/60 bg-primary-soft/40',
      )}
    >
      <Thumb src={imageUrl} name={name} className="aspect-square size-auto w-full rounded-lg text-base" />
      <div className="min-w-0">
        <div className="line-clamp-2 text-sm leading-snug font-medium">{name}</div>
        <div className="mt-1 flex items-center justify-between gap-2">
          <span className="text-sm font-semibold tabular-nums">{formatMoney(price)}</span>
          {meta ? (
            <span className={cn('text-xs tabular-nums', low ? 'text-destructive' : 'text-muted-foreground')}>
              {meta}
            </span>
          ) : null}
        </div>
      </div>
      {inCart ? (
        <span className="absolute top-2 right-2 rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground tabular-nums">
          {inCart}
        </span>
      ) : null}
    </button>
  );
}

export function PosCatalog({
  onPick,
  onPiece,
  inCart,
}: {
  onPick: (pick: CatalogPick) => void;
  onPiece: (serial: string) => Promise<void>;
  inCart: (kind: CatalogPick['kind'], refId: string) => string | undefined;
}) {
  const [tab, setTab] = useState<'products' | 'bundles'>('products');
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const term = useDebounced(search.trim());
  const categories = categoriesApi.useOptions();
  const products = productsApi.useList({
    pageSize: 100,
    status: 'active',
    sort: 'name',
    ...(term ? { search: term } : {}),
    ...(categoryId ? { categoryId } : {}),
  });
  const bundles = bundlesApi.useList(
    { pageSize: 100, sort: 'name', ...(term ? { search: term } : {}) },
    tab === 'bundles',
  );
  const stock = useStockBalances({ pageSize: 100, ...(term ? { search: term } : {}) });
  const balances = new Map((stock.data?.data ?? []).map((row) => [row.productId, row]));
  const sellable = (productId: string) => {
    const row = balances.get(productId);
    return row ? String(Number(row.quantity) - Number(row.expiredQuantity)) : undefined;
  };

  const scan = async (code: string) => {
    try {
      if (isSerial(code)) {
        await onPiece(code);
        return;
      }
      const product = await findProductByBarcode(code);
      if (product.trackSerials) {
        toast.error(`${product.name} is labelled. Scan the DSM label on the pack.`);
        return;
      }
      onPick({
        kind: 'product',
        refId: product.id,
        name: product.name,
        price: product.salePrice,
        available: sellable(product.id),
      });
    } catch (error) {
      toastError(error);
    }
  };

  const loading = tab === 'products' ? products.isLoading : bundles.isLoading;

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Tabs value={tab} onValueChange={(v) => setTab(v as 'products' | 'bundles')}>
          <TabsList>
            <TabsTrigger value="products">
              <Package />
              Products
            </TabsTrigger>
            <TabsTrigger value="bundles">
              <Gift />
              Bundles
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tab === 'products' ? 'Search products' : 'Search bundles'}
            className="h-9 pl-9"
            aria-label="Search catalog"
          />
        </div>
      </div>
      <BarcodeScanInput onScan={scan} placeholder="Scan a product barcode" />
      {tab === 'products' ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {[{ id: null, name: 'All' }, ...(categories.data ?? [])].map((c) => (
            <button
              key={c.id ?? 'all'}
              type="button"
              onClick={() => setCategoryId(c.id)}
              className={cn(
                'shrink-0 rounded-full border px-3 py-1 text-sm transition-colors',
                categoryId === c.id
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'bg-card text-muted-foreground hover:text-foreground',
              )}
            >
              {c.name}
            </button>
          ))}
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 2xl:grid-cols-4">
        {loading
          ? Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="aspect-[3/4] rounded-xl" />)
          : tab === 'products'
            ? (products.data?.data ?? []).map((p) => {
                const balance = balances.get(p.id);
                return (
                  <Card
                    key={p.id}
                    name={p.name}
                    price={p.salePrice}
                    imageUrl={p.imageUrl}
                    meta={balance ? `${formatQuantity(sellable(p.id))} ${balance.unit}` : undefined}
                    low={balance ? Number(sellable(p.id)) <= 0 || balance.isLowStock : false}
                    inCart={inCart('product', p.id)}
                    onPick={() =>
                      p.trackSerials
                        ? toast.error(`${p.name} is labelled. Scan the DSM label on the pack.`)
                        : onPick({
                            kind: 'product',
                            refId: p.id,
                            name: p.name,
                            price: p.salePrice,
                            available: sellable(p.id),
                          })
                    }
                  />
                );
              })
            : (bundles.data?.data ?? []).map((b) => (
                <Card
                  key={b.id}
                  name={b.name}
                  price={b.totalPrice}
                  imageUrl={b.imageUrl}
                  meta={`${b.items.length} items`}
                  inCart={inCart('bundle', b.id)}
                  onPick={() =>
                    onPick({
                      kind: 'bundle',
                      refId: b.id,
                      name: b.name,
                      price: b.totalPrice,
                      parts: b.items.map((i) => ({ productId: i.productId, qty: i.qty })),
                    })
                  }
                />
              ))}
      </div>
      {!loading && (tab === 'products' ? products.data?.data.length : bundles.data?.data.length) === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Nothing matches.</p>
      ) : null}
    </div>
  );
}
