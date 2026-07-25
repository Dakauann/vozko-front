import type {
    PricingAuditEntry,
    PricingItem,
    PublicExchangeRate,
    ResolvedPricingItem,
} from "@/lib/pricing/types";

import { apiClient } from "@/lib/api/browser-client";




export async function getDefaultPricingItemsAction(): Promise<{
    items: PricingItem[];
    error?: string;
}> {
    const response = await apiClient<PricingItem[]>("/admin/pricing/defaults", {
        method: "GET",
    });

    if (response.error) return { items: [], error: response.error.message };
    return { items: response.data ?? [] };
}

export async function updateDefaultPricingItemAction(
    item: { category: string; service: string; metric: string; priceMicros: number; currency: string }
): Promise<{ item: PricingItem | null; error?: string }> {
    const response = await apiClient<PricingItem>("/admin/pricing/defaults", {
        method: "PUT",
        body: JSON.stringify(item),
    });

    if (response.error) return { item: null, error: response.error.message };
    return { item: response.data ?? null };
}


export async function getExchangeRateAction(): Promise<{
    item: PublicExchangeRate | null;
    error?: string;
}> {
    const response = await apiClient<PublicExchangeRate>("/pricing/exchange-rate", {
        method: "GET",
    });

    if (response.error) return { item: null, error: response.error.message };
    return { item: response.data ?? null };
}

export async function updateExchangeRateAction(
    priceMicros: number
): Promise<{ item: PricingItem | null; error?: string }> {
    const response = await apiClient<PricingItem>("/admin/pricing/exchange-rate", {
        method: "PUT",
        body: JSON.stringify({ priceMicros }),
    });

    if (response.error) return { item: null, error: response.error.message };
    return { item: response.data ?? null };
}


export async function getPricingAuditLogAction(
    limit = 50,
    offset = 0
): Promise<{ entries: PricingAuditEntry[]; error?: string }> {
    const response = await apiClient<PricingAuditEntry[]>(
        `/admin/pricing/audit?limit=${limit}&offset=${offset}`,
        { method: "GET" }
    );

    if (response.error) return { entries: [], error: response.error.message };
    return { entries: response.data ?? [] };
}


export async function getResolvedPricingAction(
    workspaceId: string
): Promise<{ items: ResolvedPricingItem[]; error?: string }> {
    const response = await apiClient<ResolvedPricingItem[]>(
        `/admin/workspaces/${encodeURIComponent(workspaceId)}/pricing/resolved`,
        { method: "GET" }
    );

    if (response.error) return { items: [], error: response.error.message };
    return { items: response.data ?? [] };
}


