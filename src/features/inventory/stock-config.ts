import type { StockKind } from './api';

export interface StockKindConfig {
  kind: StockKind;
  title: string;
  singular: string;
  description: string;
  partyLabel: string;
  partyType: 'supplier' | 'dispatcher';
  partyField: 'supplierId' | 'dispatcherId';
  detailLabel: string;
  detailField: 'batch' | 'destination';
  detailRequired: boolean;
  slipTitle: string;
  printPath: string;
}

export const STOCK_KINDS: Record<StockKind, StockKindConfig> = {
  in: {
    kind: 'in',
    title: 'Stock in',
    singular: 'stock in entry',
    description: 'Stock received from suppliers. Each line adds to the product balance.',
    partyLabel: 'Supplier',
    partyType: 'supplier',
    partyField: 'supplierId',
    detailLabel: 'Batch',
    detailField: 'batch',
    detailRequired: false,
    slipTitle: 'Stock In Slip',
    printPath: '/print/stock-in',
  },
  out: {
    kind: 'out',
    title: 'Stock out',
    singular: 'stock out entry',
    description: 'Stock sent out through dispatchers. Each line reduces the product balance.',
    partyLabel: 'Dispatcher',
    partyType: 'dispatcher',
    partyField: 'dispatcherId',
    detailLabel: 'Stock to',
    detailField: 'destination',
    detailRequired: true,
    slipTitle: 'Stock Out Slip',
    printPath: '/print/stock-out',
  },
};
