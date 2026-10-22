import type { ColumnDef } from '@tanstack/react-table';
import { Check, Loader2, Pencil, Plus, Send, Trash2, Undo2, X } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { Combobox } from '@/components/shared/combobox';
import { DataTable } from '@/components/shared/data-table';
import { MoneyInput } from '@/components/shared/money-input';
import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge, type Tone } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { ROLE_LABELS } from '@/features/staff/constants';
import { toastError } from '@/lib/api/errors';
import type { Role } from '@/lib/api/types';
import { useAuth } from '@/lib/auth/auth-context';
import { useBranchKind } from '@/lib/auth/branches';
import { cn } from '@/lib/utils';
import { formatDateTime, formatQuantity } from '@/lib/format';
import {
  useAskStockMutation,
  useDecideStockRequestMutation,
  useUpdateStockRequestMutation,
  useStockRequestCatalog,
  useStockRequestCounts,
  useStockRequests,
  useWithdrawStockRequestMutation,
  type StockRequest,
  type StockRequestStatus,
} from '@redux/features/stock-requests';
import { STOCK_REQUEST_LABELS } from './constants';
import { StockDocumentSheet, type StockRequestPrefill } from './stock-document-sheet';
import { TraceNumber } from '@/features/trace/trace-page';
import { STOCK_KINDS } from './stock-config';

export const STOCK_REQUEST_TONES: Record<StockRequestStatus, Tone> = {
  pending: 'warning',
  approved: 'primary',
  rejected: 'danger',
  cancelled: 'neutral',
  sent: 'info',
  received: 'success',
};

const roleLabel = (role?: string) => (role ? (ROLE_LABELS[role as Role] ?? role.replace(/_/g, ' ')) : '');

interface DraftLine {
  key: number;
  productId: string;
  name: string;
  available: string;
  qty: string;
  note: string;
}

function NewRequestSheet({
  open,
  onOpenChange,
  editing = null,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: StockRequest | null;
}) {
  const [ask, askState] = useAskStockMutation();
  const [update, updateState] = useUpdateStockRequestMutation();
  const saving = askState.isLoading || updateState.isLoading;
  const [search, setSearch] = useState('');
  const catalog = useStockRequestCatalog(search, open);
  const [lines, setLines] = useState<DraftLine[]>(() =>
    (editing?.items ?? []).map((i, index) => ({
      key: index + 1,
      productId: i.productId,
      name: i.productName,
      available: String(i.available),
      qty: String(Number(i.qty)),
      note: i.note ?? '',
    })),
  );
  const [note, setNote] = useState(editing?.note ?? '');
  const [nextKey, setNextKey] = useState((editing?.items.length ?? 0) + 1);
  const options = (catalog.data ?? [])
    .filter((p) => !lines.some((l) => l.productId === p.id))
    .map((p) => ({
      value: p.id,
      label: p.name,
      hint: `${formatQuantity(p.available)} ${p.unit} at Super Admin${p.batchNo ? ` · ${p.batchNo}` : ''}`,
    }));
  const over = (l: (typeof lines)[number]) => Number(l.qty) > Number(l.available);
  const ready = lines.length > 0 && lines.every((l) => Number(l.qty) > 0 && !over(l));

  const close = (value: boolean) => {
    if (!value) {
      setLines([]);
      setNote('');
    }
    onOpenChange(value);
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !saving && close(v)}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{editing ? `Edit ${editing.requestNo}` : 'Ask the Super Admin for stock'}</SheetTitle>
          <SheetDescription>
            {editing
              ? 'Fix the products, quantities or note. You can change the request until the Super Admin answers it.'
              : 'Pick the products and how many you need. The request gets its own number; the Super Admin approves it and sends the stock, and your branch admin receives it.'}
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-4">
          <Combobox
            value={null}
            onChange={(value) => {
              const product = (catalog.data ?? []).find((p) => p.id === value);
              if (!product) return;
              setLines((current) => [
                ...current,
                {
                  key: nextKey,
                  productId: product.id,
                  name: product.name,
                  available: product.available,
                  qty: '',
                  note: '',
                },
              ]);
              setNextKey((k) => k + 1);
            }}
            onSearchChange={setSearch}
            loading={catalog.isFetching && !catalog.data}
            options={options}
            placeholder="Add a product"
            aria-label="Add a product"
          />
          {lines.length ? (
            <ul className="divide-y rounded-lg border">
              {lines.map((line) => (
                <li key={line.key} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                  <div className="min-w-40 flex-1">
                    <div className="text-sm font-medium">{line.name}</div>
                    <div
                      className={over(line) ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'}
                    >
                      {over(line)
                        ? `Only ${formatQuantity(line.available)} at Super Admin. Ask for less.`
                        : `${formatQuantity(line.available)} at Super Admin`}
                    </div>
                  </div>
                  <MoneyInput
                    prefix=""
                    decimals={3}
                    placeholder="Qty"
                    aria-label={`${line.name} quantity`}
                    className="h-9 w-24 text-right"
                    aria-invalid={over(line)}
                    value={line.qty}
                    onChange={(e) =>
                      setLines((current) =>
                        current.map((l) => (l.key === line.key ? { ...l, qty: e.target.value } : l)),
                      )
                    }
                  />
                  <Input
                    placeholder="Note (optional)"
                    className="h-9 w-44"
                    value={line.note}
                    maxLength={500}
                    onChange={(e) =>
                      setLines((current) =>
                        current.map((l) => (l.key === line.key ? { ...l, note: e.target.value } : l)),
                      )
                    }
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground"
                    aria-label={`Remove ${line.name}`}
                    onClick={() => setLines((current) => current.filter((l) => l.key !== line.key))}
                  >
                    <Trash2 />
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-lg border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">
              Add the products you need.
            </p>
          )}
          <div className="space-y-2">
            <Label htmlFor="request-note">Note for the Super Admin</Label>
            <Textarea
              id="request-note"
              value={note}
              maxLength={1000}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>
        <SheetFooter>
          <Button variant="outline" onClick={() => close(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            disabled={!ready || saving}
            onClick={() => {
              const body = {
                note: note.trim() || null,
                items: lines.map((l) => ({
                  productId: l.productId,
                  qty: l.qty,
                  note: l.note.trim() || null,
                })),
              };
              (editing ? update({ id: editing.id, body }) : ask(body))
                .unwrap()
                .then((saved) => {
                  toast.success(
                    editing ? `${saved.requestNo} updated` : `${saved.requestNo} sent to the Super Admin`,
                  );
                  close(false);
                })
                .catch(toastError);
            }}
          >
            {saving ? <Loader2 className="animate-spin" /> : editing ? <Check /> : <Send />}
            {editing ? 'Save changes' : 'Send request'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function RequestSheet({
  request,
  onClose,
  onSend,
  onEdit,
}: {
  request: StockRequest | null;
  onClose: () => void;
  onSend: (prefill: StockRequestPrefill) => void;
  onEdit: (request: StockRequest) => void;
}) {
  const { isSuperAdmin, me } = useAuth();
  const sender = me?.role === 'warehouse_keeper';
  const [decide, decideState] = useDecideStockRequestMutation();
  const [withdraw, withdrawState] = useWithdrawStockRequestMutation();
  const [approved, setApproved] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  if (!request) return null;
  const pending = request.status === 'pending';
  const choosing = isSuperAdmin && pending;
  const busy = decideState.isLoading;
  const tooMuch = new Set(
    request.items.filter((i) => approved[i.id] && Number(approved[i.id]) > Number(i.qty)).map((i) => i.id),
  );

  const toSend = request.items
    .map((i) => ({
      productId: i.productId,
      qty: Math.max(Number(i.approvedQty ?? 0) - Number(i.sentQty), 0),
    }))
    .filter((i) => i.qty > 0);
  const canSend = sender && (request.status === 'approved' || request.status === 'sent') && toSend.length > 0;

  const answer = (approve: boolean) =>
    decide({
      id: request.id,
      approve,
      body: {
        note: note.trim() || null,
        ...(approve
          ? {
              items: request.items
                .filter((i) => approved[i.id] !== undefined && approved[i.id] !== '')
                .map((i) => ({ id: i.id, approvedQty: approved[i.id]! })),
            }
          : {}),
      },
    })
      .unwrap()
      .then(() => {
        toast.success(`${request.requestNo} ${approve ? 'approved' : 'rejected'}`);
        onClose();
      })
      .catch(toastError);

  return (
    <Sheet open onOpenChange={(open) => !open && !busy && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle className="flex flex-wrap items-center gap-2">
            {request.requestNo}
            <StatusBadge tone={STOCK_REQUEST_TONES[request.status]}>
              {STOCK_REQUEST_LABELS[request.status]}
            </StatusBadge>
          </SheetTitle>
          <SheetDescription>
            {request.branch.name} · asked by {request.requestedBy?.name ?? '—'} (
            {roleLabel(request.requestedBy?.role)}) on {formatDateTime(request.createdAt)}
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-4 pb-4">
          {request.note ? <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm">“{request.note}”</p> : null}
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Product</th>
                  <th className="px-3 py-2 text-right font-medium">Asked</th>
                  <th className="px-3 py-2 text-right font-medium">Approved</th>
                  <th className="px-3 py-2 text-right font-medium">Sent</th>
                  <th className="px-3 py-2 text-right font-medium">Received</th>
                  {sender ? <th className="px-3 py-2 text-right font-medium">At Super Admin</th> : null}
                </tr>
              </thead>
              <tbody className="divide-y">
                {request.items.map((i) => (
                  <tr key={i.id}>
                    <td className="px-3 py-2">
                      <div className="font-medium">{i.productName}</div>
                      {i.note ? <div className="text-xs text-muted-foreground">{i.note}</div> : null}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatQuantity(i.qty)} {i.unit}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {choosing ? (
                        <MoneyInput
                          prefix=""
                          decimals={3}
                          aria-label={`Approve ${i.productName}`}
                          className={cn(
                            'ml-auto h-8 w-24 text-right',
                            tooMuch.has(i.id) && 'border-destructive focus-visible:ring-destructive/30',
                          )}
                          aria-invalid={tooMuch.has(i.id)}
                          placeholder={String(Number(i.qty))}
                          value={approved[i.id] ?? ''}
                          onChange={(e) => setApproved((current) => ({ ...current, [i.id]: e.target.value }))}
                        />
                      ) : null}
                      {choosing && tooMuch.has(i.id) ? (
                        <div className="mt-1 text-xs text-destructive">At most {formatQuantity(i.qty)}</div>
                      ) : choosing ? null : i.approvedQty === null ? (
                        '—'
                      ) : (
                        formatQuantity(i.approvedQty)
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatQuantity(i.sentQty)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatQuantity(i.receivedQty)}</td>
                    {sender ? (
                      <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">
                        {formatQuantity(i.available)}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {request.decidedBy ? (
            <p className="text-sm text-muted-foreground">
              {request.status === 'rejected' ? 'Rejected' : 'Approved'} by {request.decidedBy.name}
              {request.decidedAt ? ` on ${formatDateTime(request.decidedAt)}` : ''}
              {request.decisionNote ? ` · “${request.decisionNote}”` : ''}
            </p>
          ) : null}
          {request.transfers.length ? (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Transfer</th>
                    <th className="px-3 py-2 text-left font-medium">Sent</th>
                    <th className="px-3 py-2 text-right font-medium">Qty</th>
                    <th className="px-3 py-2 text-left font-medium">Received</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {request.transfers.map((t) => (
                    <tr key={t.transferNo}>
                      <td className="px-3 py-2">
                        <TraceNumber number={t.transferNo} />
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {formatDateTime(t.sentAt)}
                        <div className="text-xs text-muted-foreground">by {t.sentBy ?? '—'}</div>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatQuantity(t.qty)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {t.received && t.receivedAt ? (
                          <>
                            {formatDateTime(t.receivedAt)}
                            <div className="text-xs text-muted-foreground">by {t.receivedBy ?? '—'}</div>
                          </>
                        ) : (
                          <StatusBadge tone="warning">On the way</StatusBadge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {choosing ? (
            <div className="space-y-2">
              <Label htmlFor="decision">Note for the branch (optional)</Label>
              <Textarea
                id="decision"
                value={note}
                maxLength={500}
                onChange={(e) => setNote(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Leave Approved empty to give what was asked; type a smaller number to give less, or 0 for
                none.
              </p>
            </div>
          ) : null}
        </div>
        <SheetFooter className="flex-row flex-wrap justify-end gap-2">
          {isSuperAdmin && pending ? (
            <>
              <Button variant="outline" disabled={decideState.isLoading} onClick={() => void answer(false)}>
                <X />
                Reject
              </Button>
              <Button
                disabled={decideState.isLoading || tooMuch.size > 0}
                title={tooMuch.size ? 'Approve no more than the branch asked' : undefined}
                onClick={() => void answer(true)}
              >
                {decideState.isLoading ? <Loader2 className="animate-spin" /> : <Check />}
                Approve
              </Button>
            </>
          ) : null}
          {canSend ? (
            <Button
              onClick={() =>
                onSend({
                  stockRequestId: request.id,
                  requestNo: request.requestNo,
                  toBranchId: request.branch.id,
                  toBranchName: request.branch.name,
                  items: toSend.map((i) => ({ productId: i.productId, qty: String(i.qty) })),
                })
              }
            >
              <Send />
              Send stock
            </Button>
          ) : null}
          {!isSuperAdmin && !sender && pending ? (
            <Button variant="outline" onClick={() => onEdit(request)}>
              <Pencil />
              Edit
            </Button>
          ) : null}
          {!isSuperAdmin && pending ? (
            <Button
              variant="outline"
              disabled={withdrawState.isLoading}
              onClick={() =>
                withdraw(request.id)
                  .unwrap()
                  .then(() => {
                    toast.success(`${request.requestNo} withdrawn`);
                    onClose();
                  })
                  .catch(toastError)
              }
            >
              <Undo2 />
              Withdraw
            </Button>
          ) : null}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export function StockRequestsPage() {
  const { isSuperAdmin, can, me } = useAuth();
  const overview = isSuperAdmin || me?.role === 'warehouse_keeper';
  const kind = useBranchKind();
  const [status, setStatus] = useState<StockRequestStatus | 'all'>('all');
  const requests = useStockRequests(status === 'all' ? undefined : status);
  const counts = useStockRequestCounts(isSuperAdmin);
  const [asking, setAsking] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [editingRequest, setEditingRequest] = useState<StockRequest | null>(null);
  const [prefill, setPrefill] = useState<StockRequestPrefill | null>(null);
  const opened = (requests.data ?? []).find((r) => r.id === openId) ?? null;
  const canAsk =
    !isSuperAdmin &&
    (kind === 'branch' || kind === 'dispatch') &&
    (can('stock.create') || can('stock.update'));

  const columns: ColumnDef<StockRequest, unknown>[] = [
    {
      id: 'requestNo',
      header: 'Request no',
      accessorKey: 'requestNo',
      cell: ({ row }) => <TraceNumber number={row.original.requestNo} />,
    },
    {
      id: 'createdAt',
      header: 'Asked',
      accessorFn: (r) => formatDateTime(r.createdAt),
      cell: ({ row }) => <span className="whitespace-nowrap">{formatDateTime(row.original.createdAt)}</span>,
    },
    ...(overview
      ? ([
          {
            id: 'branch',
            header: 'Branch',
            accessorFn: (r) => r.branch.name,
            cell: ({ row }) => (
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                <span className="rounded-md bg-primary-soft px-1.5 py-0.5 text-xs font-semibold text-primary-soft-foreground">
                  {row.original.branch.code}
                </span>
                {row.original.branch.name}
              </span>
            ),
          },
        ] as ColumnDef<StockRequest, unknown>[])
      : []),
    {
      id: 'requestedBy',
      header: 'Asked by',
      accessorFn: (r) => r.requestedBy?.name ?? '',
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.requestedBy?.name ?? '—'}</div>
          <div className="text-xs text-muted-foreground">{roleLabel(row.original.requestedBy?.role)}</div>
        </div>
      ),
    },
    {
      id: 'items',
      header: 'Products',
      accessorFn: (r) => r.items.map((i) => `${i.productName} × ${Number(i.qty)}`).join(', '),
      cell: ({ row }) => (
        <div className="max-w-80 truncate" title={row.original.items.map((i) => i.productName).join(', ')}>
          <span className="font-medium">{row.original.items.length}</span>{' '}
          <span className="text-muted-foreground">
            · {row.original.items.map((i) => `${i.productName} × ${formatQuantity(i.qty)}`).join(', ')}
          </span>
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      accessorFn: (r) => STOCK_REQUEST_LABELS[r.status],
      cell: ({ row }) => (
        <div className="space-y-1">
          <StatusBadge tone={STOCK_REQUEST_TONES[row.original.status]}>
            {STOCK_REQUEST_LABELS[row.original.status]}
          </StatusBadge>
          {row.original.transferNos.length ? (
            <div className="font-mono text-xs text-muted-foreground">
              {row.original.transferNos.join(', ')}
            </div>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Stock requests"
        description={
          isSuperAdmin
            ? 'What the branches asked for. Approve a request; the Warehouse Keeper sends it and the branch admin receives it. Every request keeps its number from start to end.'
            : me?.role === 'warehouse_keeper'
              ? 'Requests the Super Admin approved. Open one and use Send stock: scan the approved products only. The branch admin receives it.'
              : 'Ask the Super Admin for stock. Approved requests come as a transfer that your branch admin receives under Incoming stock.'
        }
        actions={
          canAsk ? (
            <Button onClick={() => setAsking(true)}>
              <Plus />
              New request
            </Button>
          ) : null
        }
      />
      <DataTable
        columns={columns}
        data={requests.data}
        isLoading={requests.isLoading}
        isFetching={requests.isFetching}
        error={requests.error}
        onRetry={() => void requests.refetch()}
        getRowId={(r) => r.id}
        onRowClick={(r) => setOpenId(r.id)}
        exportFileName="stock-requests"
        emptyTitle="No stock requests"
        toolbar={
          <Tabs value={status} onValueChange={(v) => setStatus(v as StockRequestStatus | 'all')}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="pending">
                Waiting{counts.data?.pending ? ` (${counts.data.pending})` : ''}
              </TabsTrigger>
              <TabsTrigger value="approved">
                To send{counts.data?.toSend ? ` (${counts.data.toSend})` : ''}
              </TabsTrigger>
              <TabsTrigger value="sent">On the way</TabsTrigger>
              <TabsTrigger value="received">Received</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />
      <NewRequestSheet open={asking} onOpenChange={setAsking} />
      {editingRequest ? (
        <NewRequestSheet
          key={editingRequest.id}
          open
          editing={editingRequest}
          onOpenChange={(value) => !value && setEditingRequest(null)}
        />
      ) : null}
      <RequestSheet
        key={opened?.id ?? 'none'}
        request={opened}
        onClose={() => setOpenId(null)}
        onEdit={(value) => {
          setOpenId(null);
          setEditingRequest(value);
        }}
        onSend={(value) => {
          setOpenId(null);
          setPrefill(value);
        }}
      />
      {prefill ? (
        <StockDocumentSheet
          key={prefill.stockRequestId}
          config={STOCK_KINDS.out}
          open
          prefill={prefill}
          onOpenChange={(open) => !open && setPrefill(null)}
        />
      ) : null}
    </>
  );
}

export function PendingStockRequestsBanner({ className }: { className?: string }) {
  const { isSuperAdmin } = useAuth();
  const counts = useStockRequestCounts(isSuperAdmin);
  if (!isSuperAdmin || !counts.data || (counts.data.pending === 0 && counts.data.toSend === 0)) return null;
  const parts = [
    counts.data.pending ? `${counts.data.pending} waiting for approval` : null,
    counts.data.toSend ? `${counts.data.toSend} approved and not sent` : null,
  ].filter(Boolean);
  return (
    <Link
      to="/stock-requests"
      className={`flex items-center justify-between gap-3 rounded-xl border border-info/40 bg-info-soft px-4 py-3 text-sm text-info-soft-foreground transition-colors hover:bg-info-soft/80 ${className ?? ''}`}
    >
      <span className="font-medium">Stock requests: {parts.join(', ')}</span>
      <span className="font-semibold">Review</span>
    </Link>
  );
}
