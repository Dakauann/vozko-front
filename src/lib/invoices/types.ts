export type InvoiceStatus =
  | 'PENDING'
  | 'PAID'
  | 'OVERDUE'
  | 'CANCELLED'
  | 'REFUNDED'
  | 'REVERSED'
  | 'EXPIRED';

export type BillingType = 'PIX' | 'BOLETO';

export type InvoicePurpose = 'TOP_UP' | 'SUBSCRIPTION' | 'MONTHLY_BILLING';

export type InvoiceLineItemKind = 'PLAN' | 'CHANNEL';

export interface InvoiceLineItem {
  kind: InvoiceLineItemKind;
  label: string;
  amountBRL: number;
  quantity?: number;
  prorated?: boolean;
  creditable: boolean;
}

export type InvoicePaymentState = 'OPEN' | 'RENEWABLE' | 'CLOSED';

export interface InvoicePayment {
  state: InvoicePaymentState;
  canRenew: boolean;
  expiresAt?: string | null;
  payableUntil?: string | null;
}

export interface Invoice {
  id: string;
  workspaceId: string;
  userId: string;
  purpose?: InvoicePurpose;
  amountBRL: number;
  amountUSD: number;
  creditableUSD?: number;
  exchangeRate: number;
  status: InvoiceStatus;
  billingType: BillingType;
  externalId: string;
  dueDate?: string | null;
  lineItems?: InvoiceLineItem[];
  pixQrCode: string | null;
  pixCopy: string | null;
  payment?: InvoicePayment;
  bankSlipUrl: string | null;
  invoiceUrl: string | null;
  paidAt?: number | null;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateInvoicePayload {
  amountBrl: number;
  billingType: BillingType;
  description?: string;
  idempotencyKey?: string;
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
