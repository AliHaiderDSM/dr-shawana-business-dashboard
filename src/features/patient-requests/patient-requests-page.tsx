import type { ColumnDef } from '@tanstack/react-table';
import { Loader2, Save, Smartphone } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { DataTable } from '@/components/shared/data-table';
import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge, type Tone } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { toastError } from '@/lib/api/errors';
import { useAuth } from '@/lib/auth/auth-context';
import { formatDateTime } from '@/lib/format';
import {
  REQUEST_CATEGORY_LABELS,
  REQUEST_STATUS_LABELS,
  usePatientRequest,
  usePatientRequests,
  useUpdatePatientRequest,
  type PatientRequest,
  type PatientRequestStatus,
} from './api';

export const REQUEST_TONES: Record<PatientRequestStatus, Tone> = {
  submitted: 'warning',
  in_review: 'info',
  in_progress: 'primary',
  resolved: 'success',
  closed: 'neutral',
};

const STATUSES = Object.keys(REQUEST_STATUS_LABELS) as PatientRequestStatus[];

function RequestEditor({ request: r }: { request: PatientRequest }) {
  const update = useUpdatePatientRequest();
  const [status, setStatus] = useState<PatientRequestStatus>(r.status);
  const [reply, setReply] = useState(r.reply ?? '');
  const changed = status !== r.status || reply.trim() !== (r.reply ?? '');

  const save = () => {
    const body: { status?: PatientRequestStatus; reply?: string | null } = {};
    if (status !== r.status) body.status = status;
    if (reply.trim() !== (r.reply ?? '')) body.reply = reply.trim() || null;
    update
      .mutateAsync({ id: r.id, body })
      .then(() => toast.success('Request updated'))
      .catch(toastError);
  };

  return (
    <section className="space-y-4 border-t pt-4">
      <div className="space-y-2">
        <Label>Status</Label>
        <Select value={status} onValueChange={(v) => setStatus(v as PatientRequestStatus)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {REQUEST_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="request-reply">Reply to the patient</Label>
        <Textarea
          id="request-reply"
          rows={5}
          maxLength={4000}
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          placeholder="The patient sees this in the app."
        />
        {r.repliedAt ? (
          <p className="text-xs text-muted-foreground">
            Last reply {formatDateTime(r.repliedAt)}
            {r.repliedBy ? ` by ${r.repliedBy}` : ''}
          </p>
        ) : null}
      </div>
      <Button className="w-full" disabled={!changed || update.isPending} onClick={save}>
        {update.isPending ? <Loader2 className="animate-spin" /> : <Save />}
        Save
      </Button>
    </section>
  );
}

function RequestSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { can } = useAuth();
  const request = usePatientRequest(id);
  const r = request.data;
  const canEdit = can('patients.update');

  return (
    <Sheet open={id !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-lg">
        <SheetHeader className="border-b">
          <SheetTitle>{r ? r.requestNo : 'Patient request'}</SheetTitle>
          <SheetDescription>
            {r ? `${REQUEST_CATEGORY_LABELS[r.category]} · ${formatDateTime(r.createdAt)}` : 'Loading…'}
          </SheetDescription>
        </SheetHeader>
        {!r ? (
          <div className="space-y-3 p-4">
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Link to={`/patients/${r.patient.id}`} className="font-medium text-primary hover:underline">
                {r.patient.name}
              </Link>
              <span className="text-muted-foreground">{r.patient.phone}</span>
              <span className="text-muted-foreground">· {r.branch.name}</span>
            </div>
            <section className="space-y-1.5">
              <h4 className="text-sm font-semibold break-words">{r.subject}</h4>
              <p className="rounded-lg border bg-muted/30 p-3 text-sm break-words whitespace-pre-wrap">
                {r.message}
              </p>
            </section>
            <section className="space-y-2">
              <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">History</h4>
              <ol className="space-y-2 text-sm">
                {(r.history ?? []).map((h, index) => (
                  <li key={index} className="flex flex-wrap items-center gap-2">
                    <StatusBadge tone={REQUEST_TONES[h.status]}>
                      {REQUEST_STATUS_LABELS[h.status]}
                    </StatusBadge>
                    <span className="text-muted-foreground">
                      {h.by ?? (h.byPatient ? 'Patient' : 'Staff')} · {formatDateTime(h.at)}
                    </span>
                    {h.note ? <span className="w-full text-xs text-muted-foreground">{h.note}</span> : null}
                  </li>
                ))}
              </ol>
            </section>
            {canEdit ? (
              <RequestEditor key={`${r.id}-${r.updatedAt}`} request={r} />
            ) : r.reply ? (
              <section className="space-y-1.5 border-t pt-4">
                <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Reply</h4>
                <p className="text-sm whitespace-pre-wrap">{r.reply}</p>
              </section>
            ) : null}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export function PatientRequestsPage() {
  const [status, setStatus] = useState<PatientRequestStatus | 'open' | 'all'>('open');
  const requests = usePatientRequests(status);
  const [openId, setOpenId] = useState<string | null>(null);

  const columns: ColumnDef<PatientRequest, unknown>[] = [
    {
      id: 'requestNo',
      header: 'Request no',
      accessorKey: 'requestNo',
      cell: ({ row }) => <span className="font-medium whitespace-nowrap">{row.original.requestNo}</span>,
    },
    {
      id: 'createdAt',
      header: 'Received',
      accessorFn: (r) => formatDateTime(r.createdAt),
      cell: ({ row }) => <span className="whitespace-nowrap">{formatDateTime(row.original.createdAt)}</span>,
    },
    {
      id: 'patient',
      header: 'Patient',
      accessorFn: (r) => `${r.patient.name} ${r.patient.phone}`,
      cell: ({ row }) => (
        <div className="min-w-0">
          <div className="font-medium">{row.original.patient.name}</div>
          <div className="text-xs text-muted-foreground">{row.original.patient.phone}</div>
        </div>
      ),
    },
    {
      id: 'branch',
      header: 'Branch',
      accessorFn: (r) => r.branch.name,
    },
    {
      id: 'category',
      header: 'Category',
      accessorFn: (r) => REQUEST_CATEGORY_LABELS[r.category],
    },
    {
      id: 'subject',
      header: 'Subject',
      accessorFn: (r) => r.subject,
      cell: ({ row }) => (
        <div className="max-w-72 truncate" title={row.original.subject}>
          {row.original.subject}
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      accessorFn: (r) => REQUEST_STATUS_LABELS[r.status],
      cell: ({ row }) => (
        <div className="space-y-1">
          <StatusBadge tone={REQUEST_TONES[row.original.status]}>
            {REQUEST_STATUS_LABELS[row.original.status]}
          </StatusBadge>
          {row.original.reply ? <div className="text-xs text-muted-foreground">Replied</div> : null}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Patient Requests"
        description="Messages patients send from the mobile app. Open one to change its status or reply."
      />
      <DataTable
        columns={columns}
        data={requests.data}
        isLoading={requests.isLoading}
        isFetching={requests.isFetching}
        error={requests.error}
        onRetry={() => void requests.refetch()}
        searchPlaceholder="Search request no, patient, subject…"
        onRowClick={(r) => setOpenId(r.id)}
        getRowId={(r) => r.id}
        exportFileName="patient-requests"
        emptyTitle={status === 'open' ? 'No open requests' : 'No requests'}
        emptyDescription={
          <span className="inline-flex items-center gap-1.5">
            <Smartphone className="size-4" />
            Patients send requests from the app after the clinic gives them an activation code.
          </span>
        }
        quickFilters={
          <Tabs value={status} onValueChange={(v) => setStatus(v as typeof status)}>
            <TabsList>
              <TabsTrigger value="open">Open</TabsTrigger>
              <TabsTrigger value="resolved">Resolved</TabsTrigger>
              <TabsTrigger value="closed">Closed</TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />
      <RequestSheet id={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}
