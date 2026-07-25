import type {
    BalanceOperationPayload,
    BalanceOperationResponse,
    BalanceSummary,
    CreateBalancePayload,
    FullBalanceSummary,
    ListTransactionsParams,
    ResourceOperationPayload,
    Transaction,
    TransactionListResponse,
} from '@/lib/balance/types';

import type { Invoice } from '@/lib/invoices/types';
import { apiClient } from "@/lib/api/browser-client";

const DEFAULT_META = {
    page: 1,
    page_size: 20,
    total_pages: 1,
    total_items: 0,
};

function buildTransactionQueryString(params?: ListTransactionsParams): string {
    if (!params) return '';
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', String(params.page));
    if (params.pageSize) searchParams.set('pageSize', String(params.pageSize));
    if (params.resource_type) searchParams.set('resourceType', params.resource_type);
    if (params.transaction_type) searchParams.set('type', params.transaction_type);
    if (params.service_type) searchParams.set('serviceType', params.service_type);
    if (params.start_date) searchParams.set('startDate', params.start_date);
    if (params.end_date) searchParams.set('endDate', params.end_date);
    const qs = searchParams.toString();
    return qs ? `?${qs}` : '';
}

function normalizeBalanceSummary(apiResponse: FullBalanceSummary): BalanceSummary {
    const balance = apiResponse.balance;
    return {
        workspace_id: balance?.workspaceId ?? '',
        last_updated: balance?.updatedAt ?? new Date().toISOString(),
        balances: [
            {
                resource_type: 'money',
                current_balance: (balance?.amount ?? 0) / 1_000_000, // USD micros to USD
                total_credited: (apiResponse.totalMoneyCredits ?? 0) / 1_000_000,
                total_debited: (apiResponse.totalMoneyDebits ?? 0) / 1_000_000,
            },
        ],
    };
}

function normalizeTransaction(tx: Transaction) {
    return {
        id: tx.id,
        workspace_id: tx.workspaceId,
        resource_type: tx.resourceType,
        transaction_type: tx.type,
        amount: tx.amount / 1_000_000, // USD micros to USD
        description: tx.description,
        service_type: tx.serviceType,
        reference_id: tx.referenceId ?? undefined,
        created_at: tx.createdAt,
    };
}


export async function getMyBalanceAction() {
    const response = await apiClient<FullBalanceSummary>('/user/balance', {
        method: 'GET',
    });

    if (response.error) {
        return { summary: null, error: response.error.message };
    }

    if (!response.data) {
        return { summary: null, error: 'Saldo n�o encontrado' };
    }

    const summary = normalizeBalanceSummary(response.data);
    return { summary, error: null };
}

export async function listMyTransactionsAction(params?: ListTransactionsParams) {
    const qs = buildTransactionQueryString(params);
    const response = await apiClient<TransactionListResponse>(`/user/balance/transactions${qs}`, {
        method: 'GET',
    });

    if (response.error) {
        return {
            transactions: [] as ReturnType<typeof normalizeTransaction>[],
            meta: DEFAULT_META,
            error: response.error.message,
        };
    }

    const data = response.data;
    const transactions = (data?.items ?? []).map(normalizeTransaction);

    return {
        transactions,
        meta: {
            page: data?.page ?? DEFAULT_META.page,
            page_size: data?.page_size ?? DEFAULT_META.page_size,
            total_pages: data?.total_pages ?? DEFAULT_META.total_pages,
            total_items: data?.total_items ?? DEFAULT_META.total_items,
        },
        error: null,
    };
}


export async function adminCreateBalanceAction(payload: CreateBalancePayload) {
    const apiPayload = {
        workspaceId: payload.workspaceId,
        initialAmount: payload.initialAmount ?? 0,
        currency: payload.currency ?? 'USD',
    };

    const response = await apiClient<{ balance: FullBalanceSummary['balance'] }>('/admin/balances', {
        method: 'POST',
        body: JSON.stringify(apiPayload),
    });

    if (response.error) {
        return { balance: null, error: response.error.message };
    }

    return { balance: response.data?.balance ?? null, error: null };
}

export async function adminGetBalanceAction(workspaceId: string) {
    const response = await apiClient<FullBalanceSummary>(`/admin/balances/${workspaceId}`, {
        method: 'GET',
    });

    if (response.error) {
        return { summary: null, error: response.error.message };
    }

    if (!response.data) {
        return { summary: null, error: 'Saldo n�o encontrado' };
    }

    const summary = normalizeBalanceSummary(response.data);
    return { summary, error: null };
}

export async function adminGetFullSummaryAction(workspaceId: string) {
    const response = await apiClient<FullBalanceSummary>(`/admin/balances/${workspaceId}/summary`, {
        method: 'GET',
    });

    if (response.error) {
        return { summary: null, error: response.error.message };
    }

    if (!response.data) {
        return { summary: null, error: 'Saldo n�o encontrado' };
    }

    const summary = normalizeBalanceSummary(response.data);
    return { summary, error: null };
}

export async function adminCreditBalanceAction(workspaceId: string, payload: BalanceOperationPayload) {
    const apiPayload = {
        amount: payload.amount,
        serviceType: payload.service_type ?? 'manual_adjustment',
        description: payload.description,
        referenceId: payload.reference_id,
    };

    const response = await apiClient<BalanceOperationResponse>(`/admin/balances/${workspaceId}/credit`, {
        method: 'POST',
        body: JSON.stringify(apiPayload),
    });

    if (response.error) {
        return { result: null, error: response.error.message };
    }

    return { result: response.data ?? null, error: null };
}

export async function adminDebitBalanceAction(workspaceId: string, payload: BalanceOperationPayload) {
    const apiPayload = {
        amount: payload.amount,
        serviceType: payload.service_type ?? 'manual_adjustment',
        description: payload.description,
        referenceId: payload.reference_id,
    };

    const response = await apiClient<BalanceOperationResponse>(`/admin/balances/${workspaceId}/debit`, {
        method: 'POST',
        body: JSON.stringify(apiPayload),
    });

    if (response.error) {
        return { result: null, error: response.error.message };
    }

    return { result: response.data ?? null, error: null };
}

export async function adminCreditResourceAction(workspaceId: string, payload: ResourceOperationPayload) {
    const apiPayload = {
        amount: Math.round(payload.amount * 1_000_000),
        resourceType: payload.resource_type,
        serviceType: payload.service_type ?? 'manual_adjustment',
        description: payload.description,
        referenceId: payload.reference_id,
    };

    const response = await apiClient<BalanceOperationResponse>(`/admin/balances/${workspaceId}/credit-resource`, {
        method: 'POST',
        body: JSON.stringify(apiPayload),
    });

    if (response.error) {
        return { result: null, error: response.error.message };
    }

    return { result: response.data ?? null, error: null };
}

export async function adminDebitResourceAction(workspaceId: string, payload: ResourceOperationPayload) {
    const apiPayload = {
        amount: Math.round(payload.amount * 1_000_000),
        resourceType: payload.resource_type,
        serviceType: payload.service_type ?? 'manual_adjustment',
        description: payload.description,
        referenceId: payload.reference_id,
    };

    const response = await apiClient<BalanceOperationResponse>(`/admin/balances/${workspaceId}/debit-resource`, {
        method: 'POST',
        body: JSON.stringify(apiPayload),
    });

    if (response.error) {
        return { result: null, error: response.error.message };
    }

    return { result: response.data ?? null, error: null };
}

export async function adminListTransactionsAction(workspaceId: string, params?: ListTransactionsParams) {
    const qs = buildTransactionQueryString(params);
    const response = await apiClient<TransactionListResponse>(`/admin/balances/${workspaceId}/transactions${qs}`, {
        method: 'GET',
    });

    if (response.error) {
        return {
            transactions: [] as ReturnType<typeof normalizeTransaction>[],
            meta: DEFAULT_META,
            error: response.error.message,
        };
    }

    const data = response.data;
    const transactions = (data?.items ?? []).map(normalizeTransaction);

    return {
        transactions,
        meta: {
            page: data?.page ?? DEFAULT_META.page,
            page_size: data?.page_size ?? DEFAULT_META.page_size,
            total_pages: data?.total_pages ?? DEFAULT_META.total_pages,
            total_items: data?.total_items ?? DEFAULT_META.total_items,
        },
        error: null,
    };
}


export async function adminCreateInvoiceAction(
    workspaceId: string,
    payload: { amountBrl: number; billingType: string; description?: string },
) {
    const resp = await apiClient<{ invoice: Invoice }>(`/admin/balances/${workspaceId}/invoices`, {
        method: 'POST',
        body: JSON.stringify(payload),
    });

    if (resp.error) {
        return { invoice: null as Invoice | null, error: resp.error.message };
    }

    return { invoice: resp.data?.invoice ?? null, error: null };
}

export async function adminGetInvoiceAction(workspaceId: string, invoiceId: string) {
    const resp = await apiClient<{ invoice: Invoice }>(
        `/admin/balances/${workspaceId}/invoices/${encodeURIComponent(invoiceId)}`,
        { method: 'GET' },
    );

    if (resp.error) {
        return { invoice: null as Invoice | null, error: resp.error.message };
    }

    return { invoice: resp.data?.invoice ?? null, error: null };
}

export async function adminListInvoicesAction(workspaceId: string, page = 1, pageSize = 20) {
    const qs = `?page=${page}&pageSize=${pageSize}`;
    const resp = await apiClient<{ invoices: Invoice[]; total: number; totalPages: number }>(
        `/admin/balances/${workspaceId}/invoices${qs}`,
        { method: 'GET' },
    );

    if (resp.error) {
        return { invoices: [] as Invoice[], total: 0, totalPages: 1, error: resp.error.message };
    }

    return {
        invoices: resp.data?.invoices ?? [],
        total: resp.data?.total ?? 0,
        totalPages: resp.data?.totalPages ?? 1,
        error: null,
    };
}
