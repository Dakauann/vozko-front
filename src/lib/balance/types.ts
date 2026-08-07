export type ResourceType =
    | 'whatsapp_sendings'
    | 'voip_minutes'
    | 'money';

export type TransactionType = 'credit' | 'debit';

export type ServiceType =
    | 'whatsapp_campaign'
    | 'voice_campaign'
    | 'voice_call'
    | 'ai'
    | 'manual_adjustment'
    | 'top_up';

export interface Balance {
    id: string;
    workspaceId: string;
    amount: number;  
    currency: string;
    createdAt: string;
    updatedAt: string;
}

export interface FullBalanceSummary {
    balance: Balance | null;
    totalMoneyCredits: number;
    totalMoneyDebits: number;
}

export interface ResourceBalance {
    resource_type: ResourceType;
    total_credited: number;
    total_debited: number;
    current_balance: number;
}

export interface BalanceSummary {
    workspace_id: string;
    balances: ResourceBalance[];
    last_updated: string;
}

export interface Transaction {
    id: string;
    balanceId: string;
    workspaceId: string;
    type: TransactionType;
    amount: number;
    resourceType: ResourceType;
    balanceBefore: number;
    balanceAfter: number;
    serviceType: ServiceType;
    referenceId?: string | null;
    description: string;
    createdAt: string;
}

export interface TransactionDisplay {
    id: string;
    user_id: string;
    resource_type: ResourceType;
    transaction_type: TransactionType;
    amount: number;
    description?: string;
    service_type?: ServiceType;
    reference_id?: string;
    created_at: string;
}

export interface BalanceListMeta {
    page: number;
    page_size: number;
    total_pages: number;
    total_items: number;
}

export interface TransactionListResponse {
    items: Transaction[];
    page: number;
    page_size: number;
    total_items: number;
    total_pages: number;
}

export interface ListTransactionsParams {
    page?: number;
    pageSize?: number;
    resource_type?: ResourceType;
    transaction_type?: TransactionType;
    service_type?: ServiceType;
    start_date?: string;
    end_date?: string;
}

export interface CreateBalancePayload {
    workspaceId: string;
    initialAmount?: number;
    currency?: string;
}

export interface ResourceOperationPayload {
    resource_type: ResourceType;
    amount: number;
    service_type?: ServiceType;
    description?: string;
    reference_id?: string;
}

export interface BalanceOperationPayload {
    amount: number;
    service_type?: ServiceType;
    description?: string;
    reference_id?: string;
}

export interface BalanceOperationResponse {
    success: boolean;
    transaction?: Transaction;
    message?: string;
}

/*
 * Resource identity is carried by the GLYPH, on the one opaque neutral plate
 * every tile in this system sits on. These were raw Tailwind palette values
 * (emerald-500, amber-500, red-100) at 15% behind text of the same hue, so they
 * missed the token system twice over: off-palette, and a wash of themselves.
 * `bgColor` is now the plate and `color`/`iconColor` are the measured ink.
 */
export const RESOURCE_TYPE_CONFIG: Record<ResourceType, { labelKey: string; color: string; bgColor: string; iconColor: string }> = {
    whatsapp_sendings: {
        labelKey: 'resourceType.whatsappSendings',
        color: 'text-healthy-ink',
        bgColor: 'tile-healthy',
        iconColor: 'text-healthy-ink',
    },
    voip_minutes: {
        labelKey: 'resourceType.voipMinutes',
        color: 'text-primary-ink',
        bgColor: 'tile-brand',
        iconColor: 'text-primary-ink',
    },
    money: {
        labelKey: 'resourceType.money',
        color: 'text-warning-ink',
        bgColor: 'tile-warning',
        iconColor: 'text-warning-ink',
    },
};

export const TRANSACTION_TYPE_CONFIG: Record<TransactionType, { labelKey: string; color: string; bgColor: string }> = {
    credit: {
        labelKey: 'transactionType.credit',
        color: 'text-healthy-ink',
        bgColor: 'bg-muted',
    },
    debit: {
        labelKey: 'transactionType.debit',
        color: 'text-destructive-ink',
        bgColor: 'bg-muted',
    },
};
