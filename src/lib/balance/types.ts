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
