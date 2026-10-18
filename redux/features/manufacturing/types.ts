import type { Schemas } from '@/lib/api/types';

export type MaterialCategory = Schemas['MaterialCategory'];
export type Material = Schemas['Material'];
export type MaterialReceipt = Schemas['MaterialReceipt'];
export type MaterialReceiptInput = Schemas['CreateMaterialReceipt'];
export type Recipe = Schemas['Recipe'];
export type LabTransfer = Schemas['LabTransfer'];
export type Production = Schemas['Production'];
export type MaterialPlace = MaterialReceipt['place'];

export interface MaterialReportQuery {
  from?: string;
  to?: string;
  materialId?: string;
  location?: 'store' | 'lab';
  level?: 'all' | 'minimum' | 'bare_minimum';
}
