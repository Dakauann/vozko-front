export type BusinessPhoneStatus =
    | 'PENDING'
    | 'VERIFYING'
    | 'CONNECTED'
    | 'DISCONNECTED'
    | 'BANNED'
    | 'FLAGGED'
    | 'RESTRICTED'
    | 'RATE_LIMITED'
    | 'UNVERIFIED'
    | 'ONBOARDING_FAILED'
    | 'DELETED';

export type QualityRating = 'GREEN' | 'YELLOW' | 'RED' | 'UNKNOWN' | 'NA';

export type NameStatus =
    | 'APPROVED'
    | 'AVAILABLE_WITHOUT_REVIEW'
    | 'DECLINED'
    | 'EXPIRED'
    | 'PENDING_REVIEW'
    | 'NONE';

export type CodeVerificationStatus = 'VERIFIED' | 'NOT_VERIFIED' | 'EXPIRED';

export type VerificationMethod = 'SMS' | 'VOICE';

export type BusinessVertical =
    | 'UNDEFINED'
    | 'OTHER'
    | 'ALCOHOL'
    | 'APPAREL'
    | 'AUTO'
    | 'BEAUTY'
    | 'EDU'
    | 'ENTERTAIN'
    | 'EVENT_PLAN'
    | 'FINANCE'
    | 'GOVT'
    | 'GROCERY'
    | 'HEALTH'
    | 'HOTEL'
    | 'NONPROFIT'
    | 'ONLINE_GAMBLING'
    | 'OTC_DRUGS'
    | 'PHYSICAL_GAMBLING'
    | 'PROF_SERVICES'
    | 'RESTAURANT'
    | 'RETAIL'
    | 'TRAVEL'
    | 'NOT_A_BIZ'
    | 'REAL_ESTATE'
    | 'MANUFACTURING';

export interface BusinessProfile {
    about?: string;
    address?: string;
    description?: string;
    email?: string;
    profilePictureUrl?: string;
    websites?: string[];
    vertical?: BusinessVertical;
}

export interface WhatsAppBusinessPhone {
    id: string;
    provider?: 'meta' | 'dialog360';
    metaPhoneNumberId?: string;
    dialog360ChannelId?: string;
    /** Reason a 360dialog handover failed; shown when status is ONBOARDING_FAILED. */
    onboardingError?: string;
    wabaId: string;
    /** Business/WABA name, joined server-side so the client renders it inline. */
    wabaName?: string;
    displayPhoneNumber: string;
    verifiedName?: string;
    status: BusinessPhoneStatus;
    qualityRating: QualityRating;
    nameStatus: NameStatus;
    codeVerificationStatus?: CodeVerificationStatus;
    isOfficialBusiness?: boolean;
    messagingLimitTier?: string;
    platformType?: string;
    lastSyncedAt?: string;
    businessProfile?: BusinessProfile;
    ownerWorkspaceId?: string;
    ownerAssignedBy?: string;
    ownerAssignedAt?: string;
    createdAt: string;
    updatedAt: string;
}

export interface BusinessPhoneListMeta {
    page: number;
    pageSize: number;
    totalPages: number;
    totalItems: number;
}

export interface BusinessPhoneListParams {
    wabaId?: string;
    status?: BusinessPhoneStatus;
    qualityRating?: QualityRating;
    search?: string;
    page?: number;
    pageSize?: number;
}

export interface BusinessPhoneListResponse {
    data?: WhatsAppBusinessPhone[];
    meta?: BusinessPhoneListMeta;
}

export interface BusinessPhoneResponse {
    success: boolean;
    data?: WhatsAppBusinessPhone;
}

export interface SyncSinglePhoneResponse {
    success: boolean;
    data?: {
        message: string;
        phoneNumber: WhatsAppBusinessPhone;
    };
}

export interface GetBusinessProfileResponse {
    success: boolean;
    data?: BusinessProfile;
}

export interface UpdateBusinessProfilePayload {
    about?: string;
    address?: string;
    description?: string;
    email?: string;
    profilePictureHandle?: string;
    profilePictureUrl?: string;
    websites?: string[];
    vertical?: BusinessVertical;
}

export interface UploadProfilePictureResponse {
    success: boolean;
    data?: {
        message: string;
        profilePictureHandle: string;
    };
}

export interface UpdateBusinessProfileResponse {
    success: boolean;
    data?: {
        message: string;
        phoneNumber: WhatsAppBusinessPhone;
    };
}

export interface DeletePhoneResponse {
    success: boolean;
    data?: {
        message: string;
    };
}

export interface RequestVerificationCodePayload {
    method: 'SMS' | 'VOICE';
    language: string;
}

export interface RequestVerificationCodeResponse {
    success: boolean;
    data?: {
        message: string;
    };
}

export interface RegisterPhonePayload {
    pin: string;
}

export interface RegisterPhoneResponse {
    success: boolean;
    data?: {
        message: string;
        phoneNumber: WhatsAppBusinessPhone;
    };
}

export interface VerifyPhoneCodePayload {
    code: string;
}

export interface VerifyPhoneCodeResponse {
    success: boolean;
    data?: {
        message: string;
        phoneNumber: WhatsAppBusinessPhone;
    };
}

export interface ReleasePhoneResponse {
    success: boolean;
    data?: {
        message: string;
        result: {
            deregistered: boolean;
            webhooksRemoved: boolean;
            tokenCleared: boolean;
            phoneDeleted: boolean;
            wabaCleanedUp: boolean;
            deregisterError?: string;
            webhooksError?: string;
        };
    };
}

export interface RetryOnboardingResponse {
    success: boolean;
    data?: {
        status: string;
        phone_id: string;
        state: BusinessPhoneStatus;
    };
}

export interface BusinessPhoneErrorResponse {
    success: false;
    error: {
        message: string;
        code?: string;
        details?: unknown;
    };
}

export interface PhoneAccess {
    id: string;
    workspaceId: string;
    phoneId: string;
    grantedBy: string;
    createdAt: string;
    phone?: {
        id: string;
        displayPhoneNumber: string;
        verifiedName?: string;
    };
    workspace?: {
        id: string;
        name: string;
    };
    grantor?: {
        id: string;
        name: string;
        email: string;
    };
}

export interface PhoneAccessListResponse {
    success: boolean;
    data?: PhoneAccess[] | { items?: PhoneAccess[] };
    pagination?: PhoneAccessMeta;
}

export interface PhoneAccessMeta {
    page: number;
    pageSize: number;
    totalPages: number;
    totalItems: number;
}

export interface GrantPhoneAccessPayload {
    workspaceId: string;
    phoneId: string;
}

export interface GrantPhoneAccessResponse {
    success: boolean;
    data?: PhoneAccess;
}

export interface RevokePhoneAccessResponse {
    success: boolean;
    message?: string;
}
