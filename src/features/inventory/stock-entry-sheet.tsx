import { zodResolver } from '@hookform/resolvers/zod';
import { Upload } from 'lucide-react';
import { useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { AttachmentList } from '@/components/shared/attachment-list';
import { ComboboxField } from '@/components/shared/combobox';
import { FilePicker } from '@/components/shared/file-upload';
import {
  FieldRow,
  FormSection,
  MoneyField,
  SelectField,
  TextField,
  TextareaField,
} from '@/components/shared/form-fields';
import { FormSheet } from '@/components/shared/form-sheet';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { productsApi, suppliersApi } from '@redux/features/catalog';
import { applyServerErrors, toastError } from '@/lib/api/errors';
import { useAuth } from '@/lib/auth/auth-context';
import { optionalText, positiveQuantity } from '@/lib/validation';
import {
  stockAttachmentUrl,
  type GrnLineChange,
  useAddStockAttachments,
  useEditStoreReceiptMutation,
  useRemoveStockAttachment,
  useUpdateStockDocument,
  type StockDocument,
} from '@redux/features/inventory';
import { STOCK_DESTINATIONS, stockLineDetail } from './constants';
import type { StockKindConfig } from './stock-config';

const schema = z.object({
  partyId: z.string().nullable(),
  productId: z.string().min(1, 'Choose a product'),
  date: z.string().min(1, 'Choose a date'),
  qty: positiveQuantity('Qty'),
  detail: z.string().trim().max(150, 'Use at most 150 characters'),
  manufacturingDate: z.string(),
  expiryDate: z.string(),
  unitCost: z.string().regex(/^(\d{1,10}(\.\d{1,2})?)?$/, 'Use a price'),
  note: optionalText(1000),
});

const withBatchRules = <S extends z.ZodType<Values>>(base: S) =>
  base.superRefine((value, ctx) => {
    if ((value.manufacturingDate || value.expiryDate) && !value.detail)
      ctx.addIssue({ code: 'custom', path: ['detail'], message: 'Enter the batch number' });
    if (value.manufacturingDate && value.expiryDate && value.expiryDate < value.manufacturingDate)
      ctx.addIssue({ code: 'custom', path: ['expiryDate'], message: 'Before manufacturing' });
  });

type Values = z.input<typeof schema>;

const plain = (value: string | number | null | undefined) =>
  value === null || value === undefined || value === '' ? '' : String(Number(value));

interface StockEntrySheetProps {
  config: StockKindConfig;
  entry: StockDocument | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StockEntrySheet({ config, entry, open, onOpenChange }: StockEntrySheetProps) {
  const { can, me } = useAuth();
  const listId = useId();
  const [update, updateState] = useUpdateStockDocument(config.kind);
  const [editGrn, editGrnState] = useEditStoreReceiptMutation();
  const [addFiles, addFilesState] = useAddStockAttachments(config.kind);
  const [removeFile] = useRemoveStockAttachment(config.kind);
  const products = productsApi.useOptions({}, open);
  const parties = suppliersApi.useOptions({ type: config.partyType }, open);
  const [files, setFiles] = useState<File[]>([]);
  const [attachments, setAttachments] = useState(entry?.attachments ?? []);
  const form = useForm<Values, unknown, z.output<typeof schema>>({
    resolver: zodResolver(
      withBatchRules(
        config.detailRequired
          ? schema.extend({ detail: schema.shape.detail.min(1, `${config.detailLabel} is required`) })
          : schema,
      ),
    ),
    values: {
      partyId: entry ? ('supplierId' in entry ? entry.supplierId : entry.dispatcherId) : null,
      productId: entry?.productId ?? '',
      date: entry?.date ?? '',
      qty: entry ? plain(entry.qty) : '',
      detail: entry ? (stockLineDetail(entry) ?? '') : '',
      manufacturingDate: entry && 'manufacturingDate' in entry ? (entry.manufacturingDate ?? '') : '',
      expiryDate: entry && 'expiryDate' in entry ? (entry.expiryDate ?? '') : '',
      unitCost: entry && 'unitCost' in entry ? plain(entry.unitCost) : '',
      note: entry?.note ?? null,
    },
  });

  if (!entry) return null;

  const grnNo = 'grnNo' in entry ? entry.grnNo : null;
  const receiptStatus = 'receiptStatus' in entry ? entry.receiptStatus : null;
  const lab = Boolean(grnNo) && me?.role === 'lab_officer';
  const needsApproval = lab && receiptStatus === 'confirmed';

  const saveAsLab = (values: z.output<typeof schema>) => {
    const original = {
      qty: entry.qty,
      detail: stockLineDetail(entry) ?? '',
      manufacturingDate: 'manufacturingDate' in entry ? (entry.manufacturingDate ?? '') : '',
      expiryDate: 'expiryDate' in entry ? (entry.expiryDate ?? '') : '',
      unitCost: 'unitCost' in entry ? plain(entry.unitCost) : '',
    };
    const change: GrnLineChange = { id: entry.id };
    if (Number(values.qty) !== Number(original.qty)) change.qty = String(values.qty);
    if ((values.detail || '') !== (original.detail || '')) change.batch = values.detail || null;
    if ((values.manufacturingDate || '') !== (original.manufacturingDate || ''))
      change.manufacturingDate = values.manufacturingDate || null;
    if ((values.expiryDate || '') !== (original.expiryDate || ''))
      change.expiryDate = values.expiryDate || null;
    if (plain(values.unitCost) !== original.unitCost) change.unitCost = values.unitCost || null;
    if (Object.keys(change).length === 1) {
      toast.message('Nothing was changed');
      return;
    }
    void editGrn({ grnNo: grnNo!, body: { update: [change], add: [], remove: [] } })
      .unwrap()
      .then((result) => {
        toast.success(
          result.applied
            ? 'Entry updated'
            : 'Sent to the Super Admin. The stock changes once it is approved.',
        );
        onOpenChange(false);
      })
      .catch((error) => applyServerErrors(form, error));
  };

  const submit = form.handleSubmit((values) =>
    lab
      ? saveAsLab(values)
      : void update({
          id: entry.id,
          body: {
            [config.partyField]: values.partyId,
            productId: values.productId,
            date: values.date,
            qty: values.qty,
            note: values.note,
            [config.detailField]: values.detail || null,
            ...(config.batched
              ? {
                  manufacturingDate: values.manufacturingDate || null,
                  expiryDate: values.expiryDate || null,
                  unitCost: values.unitCost || null,
                }
              : {}),
          },
        })
          .unwrap()
          .then(() => {
            toast.success('Entry updated');
            onOpenChange(false);
          })
          .catch((error) => applyServerErrors(form, error)),
  );

  return (
    <Form {...form}>
      <FormSheet
        open={open}
        onOpenChange={onOpenChange}
        title={`Edit ${config.singular}`}
        description={
          needsApproval
            ? `${grnNo} is already confirmed. Your change goes to the Super Admin; the stock changes only after approval.`
            : lab
              ? `${grnNo} is still waiting for the Warehouse Keeper, so your change applies at once.`
              : 'The old movement is reversed and posted again with the new values.'
        }
        onSubmit={submit}
        submitting={updateState.isLoading || editGrnState.isLoading}
        submitLabel={needsApproval ? 'Send for approval' : 'Save changes'}
      >
        <ComboboxField
          control={form.control}
          name="productId"
          label="Product"
          disabled={lab}
          required
          options={(products.data ?? []).map((p) => ({ value: p.id, label: p.name }))}
          selectedLabel={entry.product?.name}
          placeholder="Choose product"
        />
        <FieldRow>
          <MoneyField
            control={form.control}
            name="qty"
            label="Qty"
            prefix=""
            decimals={3}
            placeholder="0"
            required
          />
          <TextField control={form.control} name="date" label="Date" type="date" disabled={lab} required />
        </FieldRow>
        <FieldRow>
          <SelectField
            control={form.control}
            name="partyId"
            label={config.partyLabel}
            disabled={lab}
            allowEmpty
            options={(parties.data ?? []).map((p) => ({ value: p.id, label: p.name }))}
          />
          <FormField
            control={form.control}
            name="detail"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {config.detailLabel}
                  {config.detailRequired ? <span className="text-destructive">*</span> : null}
                </FormLabel>
                <FormControl>
                  <Input list={config.detailField === 'destination' ? listId : undefined} {...field} />
                </FormControl>
                <datalist id={listId}>
                  {STOCK_DESTINATIONS.map((d) => (
                    <option key={d} value={d} />
                  ))}
                </datalist>
                <FormMessage />
              </FormItem>
            )}
          />
        </FieldRow>
        {config.batched ? (
          <FieldRow>
            <TextField
              control={form.control}
              name="manufacturingDate"
              label="Manufacturing date"
              type="date"
            />
            <TextField control={form.control} name="expiryDate" label="Expiry date" type="date" />
          </FieldRow>
        ) : null}
        {config.batched ? <MoneyField control={form.control} name="unitCost" label="Unit cost" /> : null}
        {config.batched ? (
          <p className="text-xs text-muted-foreground">
            New dates apply to the whole batch: every entry of it, and the branches it was sent to.
          </p>
        ) : null}
        <TextareaField control={form.control} name="note" label="Note" rows={2} disabled={lab} />
        {lab ? (
          <p className="text-xs text-muted-foreground">
            You can change the qty, batch, dates and unit cost. Ask the Super Admin to change the product,
            date, supplier or note.
          </p>
        ) : null}
        <FormSection title="Attachments">
          <AttachmentList
            files={attachments}
            emptyText="No attachments yet."
            getUrl={(file) => stockAttachmentUrl(config.kind, entry.id, file.id)}
            onRemove={
              can('stock.update')
                ? (file) =>
                    removeFile({ id: entry.id, attachmentId: file.id })
                      .unwrap()
                      .then(() => {
                        setAttachments((list) => list.filter((a) => a.id !== file.id));
                        toast.success('Attachment removed');
                      })
                : undefined
            }
          />
          {can('stock.update') ? (
            <div className="space-y-2">
              <FilePicker files={files} onChange={setFiles} />
              {files.length > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={addFilesState.isLoading}
                  onClick={() =>
                    addFiles({ id: entry.id, files })
                      .unwrap()
                      .then((updated) => {
                        setAttachments(updated.attachments);
                        setFiles([]);
                        toast.success('Attachments uploaded');
                      })
                      .catch(toastError)
                  }
                >
                  <Upload />
                  Upload {files.length} file{files.length > 1 ? 's' : ''}
                </Button>
              ) : null}
            </div>
          ) : null}
        </FormSection>
      </FormSheet>
    </Form>
  );
}
