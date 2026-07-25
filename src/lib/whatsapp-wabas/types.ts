export interface WhatsAppBusinessAccount {
    id: string;
    metaWabaId: string;
    name?: string;
    businessPortfolioId?: string;
    accountReviewStatus?: string;
    businessVerificationStatus?: string;
    ownershipType?: string;
    messagingLimitTier?: string;
    phoneCount: number;
    templateCount: number;
    createdAt: string;
    updatedAt: string;
}

export interface WABAListMeta {
    page: number;
    pageSize: number;
    totalPages: number;
    totalItems: number;
}

export interface WABAListResponse {
    data: WhatsAppBusinessAccount[];
    meta: WABAListMeta;
}
