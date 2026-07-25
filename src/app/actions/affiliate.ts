import type {
    Affiliate,
    AffiliateEarning,
    AffiliateProfileWithStats,
    AffiliateReferral,
    AffiliateTier,
    PaginationMeta,
    ReferralValidationResult,
    RegisterAffiliateInput,
    UpdateAffiliateInput,
} from "@/lib/affiliate/types";
import { apiFetch } from "@/lib/api/http";
import { apiClient } from "@/lib/api/browser-client";

interface PaginatedApiResponse<T> {
    data: T[];
    meta: {
        page: number;
        pageSize: number;
        totalItems: number;
        totalPages: number;
    };
}

const DEFAULT_META: PaginationMeta = {
    page: 1,
    pageSize: 20,
    totalItems: 0,
    totalPages: 0,
};

function buildPagQS(page?: number, pageSize?: number): string {
    const qs = new URLSearchParams();
    if (page && page > 0) qs.set("page", String(page));
    if (pageSize && pageSize > 0) qs.set("pageSize", String(pageSize));
    const s = qs.toString();
    return s ? `?${s}` : "";
}


export async function registerAffiliateAction(
    input: RegisterAffiliateInput,
): Promise<{ affiliate: Affiliate | null; error?: string }> {
    const body: Record<string, string> = {
        asaasWalletId: input.asaasWalletId.trim(),
        brandName: input.brandName.trim(),
        brandLogoUrl: input.brandLogoUrl.trim(),
    };
    const code = input.code?.trim();
    if (code) body.code = code;

    const response = await apiClient<Affiliate>("/affiliate/register", {
        method: "POST",
        body: JSON.stringify(body),
    });

    if (response.error) {
        return { affiliate: null, error: response.error.message };
    }
    return { affiliate: response.data ?? null };
}

export async function getMyAffiliateAction(): Promise<{
    profile: AffiliateProfileWithStats | null;
    error?: string;
    notFound?: boolean;
}> {
    const response = await apiClient<AffiliateProfileWithStats>("/affiliate/me", {
        method: "GET",
    });

    if (response.error) {
        if (response.error.status === 404) {
            return { profile: null, notFound: true };
        }
        return { profile: null, error: response.error.message };
    }
    return { profile: response.data ?? null };
}

export async function updateMyAffiliateAction(
    input: UpdateAffiliateInput,
): Promise<{ affiliate: Affiliate | null; error?: string }> {
    const body: Record<string, string> = {};
    if (input.brandName !== undefined) body.brandName = input.brandName.trim();
    if (input.brandLogoUrl !== undefined) body.brandLogoUrl = input.brandLogoUrl.trim();
    if (input.asaasWalletId !== undefined) body.asaasWalletId = input.asaasWalletId.trim();

    const response = await apiClient<Affiliate>("/affiliate/me", {
        method: "PUT",
        body: JSON.stringify(body),
    });

    if (response.error) {
        return { affiliate: null, error: response.error.message };
    }
    return { affiliate: response.data ?? null };
}


export async function listAffiliateReferralsAction(
    page = 1,
    pageSize = 20,
): Promise<{
    items: AffiliateReferral[];
    meta: PaginationMeta;
    error?: string;
}> {
    const response = await apiClient<PaginatedApiResponse<AffiliateReferral>>(
        `/affiliate/referrals${buildPagQS(page, pageSize)}`,
        { method: "GET" },
    );

    if (response.error) {
        return { items: [], meta: DEFAULT_META, error: response.error.message };
    }
    return {
        items: response.data?.data ?? [],
        meta: response.data?.meta ?? DEFAULT_META,
    };
}

export async function listAffiliateEarningsAction(
    page = 1,
    pageSize = 20,
): Promise<{
    items: AffiliateEarning[];
    meta: PaginationMeta;
    error?: string;
}> {
    const response = await apiClient<PaginatedApiResponse<AffiliateEarning>>(
        `/affiliate/earnings${buildPagQS(page, pageSize)}`,
        { method: "GET" },
    );

    if (response.error) {
        return { items: [], meta: DEFAULT_META, error: response.error.message };
    }
    return {
        items: response.data?.data ?? [],
        meta: response.data?.meta ?? DEFAULT_META,
    };
}


export async function validateAffiliateCodeAction(
    code: string,
): Promise<{ result: ReferralValidationResult | null; error?: string }> {
    const normalized = code.trim().toUpperCase();
    if (!normalized) {
        return { result: { valid: false } };
    }

    const response = await apiFetch<ReferralValidationResult>(
        `/affiliate/validate/${encodeURIComponent(normalized)}`,
        { method: "GET" },
    );

    if (response.error) {
        return { result: null, error: response.error.message };
    }
    return { result: response.data ?? { valid: false } };
}


export async function adminListAffiliatesAction(
    page = 1,
    pageSize = 20,
): Promise<{
    items: Affiliate[];
    meta: PaginationMeta;
    error?: string;
}> {
    const response = await apiClient<PaginatedApiResponse<Affiliate>>(
        `/admin/affiliates${buildPagQS(page, pageSize)}`,
        { method: "GET" },
    );

    if (response.error) {
        return { items: [], meta: DEFAULT_META, error: response.error.message };
    }
    return {
        items: response.data?.data ?? [],
        meta: response.data?.meta ?? DEFAULT_META,
    };
}

export async function adminGetAffiliateAction(
    id: string,
): Promise<{ profile: AffiliateProfileWithStats | null; error?: string }> {
    const response = await apiClient<AffiliateProfileWithStats>(
        `/admin/affiliates/${encodeURIComponent(id)}`,
        { method: "GET" },
    );

    if (response.error) {
        return { profile: null, error: response.error.message };
    }
    return { profile: response.data ?? null };
}

export async function adminUpdateAffiliateAction(
    id: string,
    input: { commissionPct?: number; active?: boolean; tier?: AffiliateTier },
): Promise<{ affiliate: Affiliate | null; error?: string }> {
    const body: Record<string, unknown> = {};
    if (typeof input.commissionPct === "number") body.commissionPct = input.commissionPct;
    if (typeof input.active === "boolean") body.active = input.active;
    if (input.tier === "affiliate" || input.tier === "reseller") body.tier = input.tier;

    const response = await apiClient<Affiliate>(
        `/admin/affiliates/${encodeURIComponent(id)}`,
        {
            method: "PUT",
            body: JSON.stringify(body),
        },
    );

    if (response.error) {
        return { affiliate: null, error: response.error.message };
    }
    return { affiliate: response.data ?? null };
}
