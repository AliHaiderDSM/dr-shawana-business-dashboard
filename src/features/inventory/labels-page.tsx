import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { ArrowLeft, Loader2, Printer, Tags } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { BarcodeScanInput } from '@/components/shared/barcode-scan-input';
import { DataTable } from '@/components/shared/data-table';
import { ErrorState } from '@/components/shared/error-state';
import { FilterSelect } from '@/components/shared/list-filters';
import { PageHeader } from '@/components/shared/page-header';
import { DetailList, Panel } from '@/components/shared/panel';
import { DetailSkeleton } from '@/components/shared/skeletons';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { productsApi } from '@/features/catalog/api';
import { useListState } from '@/hooks/use-list-state';
import { toastError } from '@/lib/api/errors';
import { useAuth } from '@/lib/auth/auth-context';
import { formatDate, formatDateTime, formatQuantity } from '@/lib/format';
import {
  findItemBySerial,
  isSerial,
  useBatches,
  useRegisterLabels,
  useItems,
  useSerialSummary,
  type InventoryItem,
  type InventoryItemDetail,
  type ItemStatus,
} from './api';
import { ITEM_STATUS, ItemStatusBadge } from './item-status';
import { LabelBatchesView } from './label-batches';

const EVENT_LABELS: Record<InventoryItemDetail['history'][number]['type'], string> = {
  received: 'Received',
  produced: 'Produced',
  labelled: 'Label registered',
  sold: 'Sold',
  sale_edited: 'Taken off the sale',
  sale_deleted: 'Sale deleted',
  returned: 'Returned',
  return_cancelled: 'Return cancelled',
  quarantined: 'Put in quarantine',
  restocked: 'Back in stock',
  damaged: 'Written off as damaged',
  expired: 'Written off as expired',
  supplier_returned: 'Sent to supplier',
  dispatched: 'Sent out',
  dispatch_cancelled: 'Stock out cancelled',
  written_off: 'Written off',
};

function referencePath(type: string | null, id: string | null) {
  if (!id) return null;
  if (type === 'sale') return `/sales/${id}`;
  if (type === 'sale_return') return `/returns/${id}`;
  return null;
}

const columns: ColumnDef<InventoryItem, unknown>[] = [
  {
    id: 'serial',
    header: 'Label',
    accessorKey: 'serial',
    meta: { hideable: false },
    cell: ({ row }) => <span className="font-mono font-medium">{row.original.serial}</span>,
  },
  { id: 'product', header: 'Product', accessorKey: 'productName' },
  {
    id: 'batch',
    header: 'Batch',
    accessorFn: (r) => r.batchNo ?? '',
    cell: ({ row }) =>
      row.original.batchNo ? <span className="font-mono text-xs">{row.original.batchNo}</span> : '—',
  },
  {
    id: 'expiry',
    header: 'Expiry',
    accessorKey: 'expiryDate',
    cell: ({ row }) => formatDate(row.original.expiryDate),
  },
  {
    id: 'status',
    header: 'Status',
    accessorFn: (r) => ITEM_STATUS[r.status].label,
    cell: ({ row }) => <ItemStatusBadge status={row.original.status} />,
  },
  {
    id: 'sale',
    header: 'Sale',
    accessorFn: (r) => r.invoiceNo ?? '',
    cell: ({ row }) =>
      row.original.invoiceNo ? (
        <span>
          {row.original.invoiceNo}
          <span className="text-muted-foreground"> · {formatDate(row.original.soldOn)}</span>
        </span>
      ) : (
        '—'
      ),
  },
  {
    id: 'received',
    header: 'Received',
    accessorKey: 'receivedOn',
    cell: ({ row }) => formatDate(row.original.receivedOn),
  },
];

export function RegisterLabelsDialog({ productId, onClose }: { productId?: string; onClose: () => void }) {
  const register = useRegisterLabels();
  const products = productsApi.useOptions();
  const [product, setProduct] = useState(productId ?? '');
  const [batchId, setBatchId] = useState('none');
  const [firstSerial, setFirstSerial] = useState('');
  const [qty, setQty] = useState('');
  const summary = useSerialSummary(product || undefined);
  const batches = useBatches({ productId: product, pageSize: 100 }, Boolean(product));
  const free = summary.data?.unlabelled.find((u) => (u.batchId ?? 'none') === batchId);
  const count = Number(qty);
  const valid = Boolean(product) && isSerial(firstSerial) && Number.isInteger(count) && count > 0;
  const last = valid
    ? `DSM-${String(Number(firstSerial.trim().slice(4)) + count - 1).padStart(6, '0')}`
    : null;

  return (
    <Dialog open onOpenChange={(open) => !open && !register.isPending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Register labels on stock</DialogTitle>
          <DialogDescription>
            For packs already on the shelf that carry consecutive DSM labels. After this, the product is sold,
            sent out and returned by scanning its labels.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Product</Label>
            <Select value={product} onValueChange={setProduct} disabled={Boolean(productId)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose product" />
              </SelectTrigger>
              <SelectContent>
                {(products.data ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Batch</Label>
            <Select value={batchId} onValueChange={setBatchId} disabled={!product}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No batch</SelectItem>
                {(batches.data?.data ?? []).map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.batchNo}
                    {b.expiryDate ? ` · exp ${formatDate(b.expiryDate)}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {product ? (
              <span className="text-xs text-muted-foreground">
                {formatQuantity(free?.qty ?? 0)} pieces of this batch have no label yet
              </span>
            ) : null}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="first-label">First label</Label>
              <Input
                id="first-label"
                className="font-mono"
                placeholder="DSM-000001"
                value={firstSerial}
                onChange={(e) => setFirstSerial(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="label-count">How many</Label>
              <Input
                id="label-count"
                inputMode="numeric"
                value={qty}
                onChange={(e) => setQty(e.target.value.replace(/\D/g, ''))}
              />
            </div>
          </div>
          {last ? (
            <p className="rounded-md bg-muted/50 px-3 py-2 text-sm">
              Labels <span className="font-mono">{firstSerial.trim().toUpperCase()}</span> to{' '}
              <span className="font-mono">{last}</span>
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={register.isPending}>
            Cancel
          </Button>
          <Button
            disabled={!valid || register.isPending}
            onClick={() =>
              register
                .mutateAsync({
                  productId: product,
                  batchId: batchId === 'none' ? null : batchId,
                  firstSerial: firstSerial.trim().toUpperCase(),
                  qty: count,
                })
                .then((result) => {
                  toast.success(
                    `${result.count} labels registered (${result.firstSerial} to ${result.lastSerial})`,
                  );
                  onClose();
                })
                .catch(toastError)
            }
          >
            {register.isPending ? <Loader2 className="animate-spin" /> : <Tags />}
            Register
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function LabelsPage() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const list = useListState({ defaultSort: 'serial' });
  const query = useItems(list.query);
  const products = productsApi.useOptions();
  const [registering, setRegistering] = useState(false);

  const scan = async (code: string) => {
    try {
      const item = await findItemBySerial(code);
      void navigate(`/inventory/labels/${item.serial}`);
    } catch (error) {
      toastError(error);
    }
  };

  return (
    <>
      <PageHeader
        title="Labels"
        description="Every labelled piece with its product, batch and where it is now. Scan a label to see its history."
        actions={
          can('stock.create') ? (
            <Button variant="outline" onClick={() => setRegistering(true)}>
              <Tags />
              Register labels on stock
            </Button>
          ) : null
        }
      />
      <BarcodeScanInput
        onScan={scan}
        className="mb-4 max-w-md"
        placeholder="Scan or type a label, e.g. DSM-000001"
      />
      <Tabs defaultValue="batches" className="gap-4">
        <TabsList>
          <TabsTrigger value="batches">By batch</TabsTrigger>
          <TabsTrigger value="all">All labels</TabsTrigger>
        </TabsList>
        <TabsContent value="batches">
          <LabelBatchesView />
        </TabsContent>
        <TabsContent value="all">
          <DataTable
            columns={columns}
            data={query.data?.data}
            meta={query.data?.meta}
            list={list}
            isLoading={query.isLoading}
            isFetching={query.isFetching}
            error={query.error}
            onRetry={() => void query.refetch()}
            searchPlaceholder="Label or product"
            exportFileName="labels"
            onRowClick={(r) => void navigate(`/inventory/labels/${r.serial}`)}
            emptyTitle="No labelled pieces yet"
            emptyDescription="Labels are made on Stock In (Print new labels) or registered for stock already on the shelf."
            toolbar={
              <>
                <FilterSelect
                  list={list}
                  name="productId"
                  allLabel="All products"
                  className="w-48"
                  options={(products.data ?? []).map((p) => ({ value: p.id, label: p.name }))}
                />
                <FilterSelect
                  list={list}
                  name="status"
                  allLabel="Any status"
                  className="w-44"
                  options={(Object.keys(ITEM_STATUS) as ItemStatus[]).map((s) => ({
                    value: s,
                    label: ITEM_STATUS[s].label,
                  }))}
                />
              </>
            }
          />
        </TabsContent>
      </Tabs>
      {registering ? <RegisterLabelsDialog onClose={() => setRegistering(false)} /> : null}
    </>
  );
}

export function LabelDetailPage() {
  const { serial = '' } = useParams();
  const navigate = useNavigate();
  const query = useQuery({
    queryKey: ['stock', 'item-serial', serial],
    queryFn: () => findItemBySerial(serial),
    enabled: Boolean(serial),
  });
  const item = query.data;
  if (query.isLoading) return <DetailSkeleton />;
  if (query.error || !item) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2 text-muted-foreground">
        <Link to="/inventory/labels">
          <ArrowLeft />
          Labels
        </Link>
      </Button>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <span className="font-mono">{item.serial}</span>
            <ItemStatusBadge status={item.status} />
          </span>
        }
        description={item.productName}
        actions={
          <>
            <BarcodeScanInput
              onScan={async (code) => {
                await navigate(`/inventory/labels/${code.trim().toUpperCase()}`);
              }}
              className="w-64"
              placeholder="Scan another label"
            />
            <Button
              variant="outline"
              onClick={() => void navigate(`/print/labels?from=${item.serial}&to=${item.serial}`)}
            >
              <Printer />
              Reprint
            </Button>
          </>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Panel title="History" description="Every step of this piece, oldest first." bodyClassName="p-0">
          <ol className="relative">
            {item.history.map((h, index) => {
              const path = referencePath(h.referenceType, h.referenceId);
              return (
                <li key={h.id} className="flex gap-4 px-5 py-3">
                  <div className="flex flex-col items-center">
                    <span className="mt-1.5 size-2.5 rounded-full bg-primary" />
                    {index < item.history.length - 1 ? <span className="w-px flex-1 bg-border" /> : null}
                  </div>
                  <div className="min-w-0 flex-1 pb-1 text-sm">
                    <div className="font-medium">{EVENT_LABELS[h.type]}</div>
                    <div className="text-muted-foreground">
                      {formatDateTime(h.createdAt)} · {h.branchName}
                      {h.by ? ` · ${h.by}` : ''}
                    </div>
                    {h.referenceLabel ? (
                      <div className="text-muted-foreground">
                        {path ? (
                          <Link to={path} className="text-primary hover:underline">
                            {h.referenceLabel}
                          </Link>
                        ) : (
                          h.referenceLabel
                        )}
                      </div>
                    ) : null}
                    {h.note ? <div className="text-muted-foreground">{h.note}</div> : null}
                  </div>
                </li>
              );
            })}
          </ol>
        </Panel>
        <Panel title="Details">
          <DetailList
            items={[
              {
                label: 'Product',
                value: (
                  <Link to={`/stock/${item.productId}`} className="text-primary hover:underline">
                    {item.productName}
                  </Link>
                ),
              },
              {
                label: 'Batch',
                value: item.batchId ? (
                  <Link
                    to={`/inventory/batches/${item.batchId}`}
                    className="font-mono text-primary hover:underline"
                  >
                    {item.batchNo}
                  </Link>
                ) : (
                  'No batch'
                ),
              },
              { label: 'Manufacturing', value: formatDate(item.manufacturingDate) },
              { label: 'Expiry', value: formatDate(item.expiryDate) },
              { label: 'Branch', value: item.branchName },
              { label: 'Received', value: formatDate(item.receivedOn) },
              {
                label: 'Sale',
                value: item.saleId ? (
                  <Link to={`/sales/${item.saleId}`} className="text-primary hover:underline">
                    {item.invoiceNo} · {formatDate(item.soldOn)}
                  </Link>
                ) : null,
              },
              {
                label: 'Customer',
                value: item.patientId ? (
                  <Link to={`/patients/${item.patientId}`} className="text-primary hover:underline">
                    {item.patientName}
                  </Link>
                ) : null,
              },
            ]}
          />
        </Panel>
      </div>
    </>
  );
}
