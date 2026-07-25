import type {
  CreateInvoicePayload,
  CreateInvoiceResponse,
  Invoice,
  InvoiceListResponse,
  ListInvoicesParams,
} from '@/lib/invoices/types';
import { REF_COOKIE_NAME } from '@/lib/affiliate/ref-cookie.client';
import { clearClientCookie, readClientCookie } from '@/lib/browser/client-cookie';

import { apiClient } from '@/lib/api/browser-client';

export async function createInvoiceAction(payload: CreateInvoicePayload) {
  const referralCode = readClientCookie(REF_COOKIE_NAME)?.trim() || '';

  const result = await apiClient<CreateInvoiceResponse>('/user/invoices', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: referralCode ? { 'X-Affiliate-Ref': referralCode } : undefined,
  });

  if (result.error) {
    return {
      data: null,
      error: result.error.message || 'Failed to create invoice',
      errorCode: result.error.code ?? null,
    };
  }

  if (referralCode) {
    clearClientCookie(REF_COOKIE_NAME);
  }

  return { data: result.data ?? null, error: null, errorCode: null };
}

export async function listInvoicesAction(params?: ListInvoicesParams) {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.pageSize) searchParams.set('pageSize', String(params.pageSize));
  const qs = searchParams.toString();
  const endpoint = `/user/invoices${qs ? `?${qs}` : ''}`;

  const result = await apiClient<InvoiceListResponse>(endpoint);

  if (result.error) {
    return { data: null, error: result.error.message || 'Failed to list invoices' };
  }

  return { data: result.data ?? null, error: null };
}

export async function getInvoiceAction(id: string) {
  const result = await apiClient<{ invoice: Invoice }>(
    `/user/invoices/${encodeURIComponent(id)}`,
  );

  if (result.error) {
    return { data: null, error: result.error.message || 'Failed to get invoice' };
  }

  return { data: result.data?.invoice ?? null, error: null };
}
