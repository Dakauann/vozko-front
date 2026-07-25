
export type AffiliateTier = "affiliate" | "reseller";

export interface Affiliate {
    id: string;
    userId: string;
    code: string;
    brandName: string;
    brandLogoUrl: string;
    asaasWalletId: string;
    commissionPct: number; 
    active: boolean;
    tier: AffiliateTier;
    createdAt: string;
    updatedAt: string;
}

export interface AffiliateStats {
    totalReferrals: number;
    totalEarningMicros: number; 
    monthEarningMicros: number; 
}

export interface AffiliateProfileWithStats {
    affiliate: Affiliate;
    stats: AffiliateStats;
}

export interface AffiliateReferral {
    id: string;
    affiliateId: string;
    workspaceId: string;
    referredAt: string;
}

export interface AffiliateEarning {
    id: string;
    affiliateId: string;
    invoiceId: string;
    workspaceId: string;
    amountMicros: number; 
    exchangeRateMicros: number; 
    purpose: string;
    status: string;
    createdAt: string;
}

export interface ReferralValidationResult {
    valid: boolean;
    code?: string;
    brandName?: string;
    brandLogoUrl?: string;
}

export interface PaginationMeta {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
}

export interface RegisterAffiliateInput {
    brandName: string;
    brandLogoUrl: string;
    asaasWalletId: string;
    code?: string;
}

export interface UpdateAffiliateInput {
    brandName?: string;
    brandLogoUrl?: string;
    asaasWalletId?: string;
}
