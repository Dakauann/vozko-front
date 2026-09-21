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
  creditableUSD?: number;
  exchangeRate: number;
  status: InvoiceStatus;
  billingType: BillingType;
  externalId: string;
  dueDate?: string | null;
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
