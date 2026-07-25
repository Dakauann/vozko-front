export type InvoiceStatus =
  | 'PENDING'
  | 'PAID'
  | 'OVERDUE'
  | 'CANCELLED'
  | 'REFUNDED'
  | 'EXPIRED';

export type BillingType = 'PIX' | 'BOLETO';

export type InvoicePurpose = 'TOP_UP' | 'SUBSCRIPTION' | 'MONTHLY_BILLING';

export type InvoiceLineItemKind = 'PLAN' | 'CHANNEL';

/**
 * One customer-facing line of a unified monthly invoice. Price only (the backend never sends cost).
 * `creditable` marks the plan line, whose amount is credited to the USD saldo on payment; channel lines
 * are a pass-through and are not credited.
 */
export interface InvoiceLineItem {
  kind: InvoiceLineItemKind;
  label: string;
  amountBRL: number;
  quantity?: number;
  prorated?: boolean;
  creditable: boolean;
}

export interface Invoice {
  id: string;
  workspaceId: string;
  userId: string;
  purpose?: InvoicePurpose;
  amountBRL: number;
  amountUSD: number;
  /** Portion of amountUSD credited to the USD saldo on payment (the plan portion for MONTHLY_BILLING). */
  creditableUSD?: number;
  exchangeRate: number;
  status: InvoiceStatus;
  billingType: BillingType;
  externalId: string;
  /** Payment due date (the billing anchor / the 23rd for MONTHLY_BILLING). */
  dueDate?: string | null;
  /** Customer-facing breakdown of a unified monthly invoice (plan + channel lines), price only. */
  lineItems?: InvoiceLineItem[];
  pixQrCode: string | null;
  pixCopy: string | null;
  bankSlipUrl: string | null;
  invoiceUrl: string | null;
  paidAt: string | null;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateInvoicePayload {
  amountBrl: number;
  billingType: BillingType;
  description?: string;
}

export interface CreateInvoiceResponse {
  invoice: Invoice;
}

export interface InvoiceListResponse {
  invoices: Invoice[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ListInvoicesParams {
  page?: number;
  pageSize?: number;
}
