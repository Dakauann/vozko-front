
export interface PricingItem {
    id: string;
    workspaceId: string | null;
    category: string;
    service: string;
    metric: string;
    costMicros: number;
    priceMicros: number;
    markupPct: number;
    currency: string;
    createdAt: string;
    updatedAt: string;
}

export interface PublicExchangeRate {
    priceMicros: number;
    currency: string;
}

export interface PricingAuditEntry {
    id: string;
    workspaceId: string | null;
    category: string;
    service: string;
    metric: string;
    oldPriceMicros: number;
    newPriceMicros: number;
    currency: string;
    changedBy: string;
    changedAt: string;
}

export interface ResolvedPricingItem {
    category: string;
    service: string;
    metric: string;
    costMicros: number;
    priceMicros: number;
    markupPct: number;
    currency: string;
    isOverride: boolean;
    defaultCostMicros: number;
    defaultPriceMicros: number;
    defaultMarkupPct: number;
    overrideId?: string;
    updatedAt: string;
}