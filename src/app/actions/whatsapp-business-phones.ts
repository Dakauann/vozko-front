import type {
    BusinessPhoneListMeta,
    BusinessPhoneListParams,
    BusinessPhoneListResponse,
    BusinessPhoneResponse,
    BusinessProfile,
    DeletePhoneResponse,
    GetBusinessProfileResponse,
    RegisterPhonePayload,
    RegisterPhoneResponse,
    ReleasePhoneResponse,
    RequestVerificationCodePayload,
    RequestVerificationCodeResponse,
    RetryOnboardingResponse,
    SyncSinglePhoneResponse,
    UpdateBusinessProfilePayload,
    UpdateBusinessProfileResponse,
    UploadProfilePictureResponse,
    VerifyPhoneCodePayload,
    VerifyPhoneCodeResponse,
    WhatsAppBusinessPhone,
} from '@/lib/whatsapp-business-phones/types';

import { apiClient } from '@/lib/api/browser-client';

const DEFAULT_BUSINESS_PHONE_META: BusinessPhoneListMeta = {
    page: 1,
    pageSize: 10,
    totalPages: 1,
    totalItems: 0,
};

function normalizeBusinessPhoneList(payload?: BusinessPhoneListResponse | null) {
    const meta: BusinessPhoneListMeta = { ...DEFAULT_BUSINESS_PHONE_META };
    let phones: WhatsAppBusinessPhone[] = [];

    if (!payload) {
        return { phones, meta };
    }

    if (Array.isArray(payload.data)) {
        phones = payload.data;
    }

    if (payload.meta) {
        meta.page = payload.meta.page ?? meta.page;
        meta.pageSize = payload.meta.pageSize ?? meta.pageSize;
        meta.totalPages = payload.meta.totalPages ?? meta.totalPages;
        meta.totalItems = payload.meta.totalItems ?? meta.totalItems;
    }

    if (!meta.totalItems) {
        meta.totalItems = phones.length;
    }

    return { phones, meta };
}

export async function listBusinessPhonesAction(params?: BusinessPhoneListParams) {
    const queryParams = new URLSearchParams();
    if (params?.wabaId) queryParams.set('wabaId', params.wabaId);
    if (params?.status) queryParams.set('status', params.status);
    if (params?.qualityRating) queryParams.set('qualityRating', params.qualityRating);
    if (params?.page) queryParams.set('page', String(params.page));
    if (params?.pageSize) queryParams.set('pageSize', String(params.pageSize));
    if (params?.search) queryParams.set('search', params.search);

    const queryString = queryParams.toString();
    const endpoint = `/whatsapp/business-phones${queryString ? `?${queryString}` : ''}`;

    const response = await apiClient<BusinessPhoneListResponse>(endpoint, {
        method: 'GET',
    });

    if (response.error) {
        return {
            phones: [] as WhatsAppBusinessPhone[],
            meta: DEFAULT_BUSINESS_PHONE_META,
            error: response.error.message,
        };
    }

    const { phones, meta } = normalizeBusinessPhoneList(response.data ?? null);

    return { phones, meta, error: null };
}

export async function getBusinessPhoneByIdAction(phoneId: string) {
    const response = await apiClient<BusinessPhoneResponse>(`/whatsapp/business-phones/${phoneId}`, {
        method: 'GET',
    });

    if (response.error) {
        return { phone: null as WhatsAppBusinessPhone | null, error: response.error.message };
    }

    const phoneData = response.data ?? null;
    return { phone: phoneData as WhatsAppBusinessPhone | null, error: null };
}

export async function syncBusinessPhoneAction(phoneId: string) {
    const response = await apiClient<SyncSinglePhoneResponse>(`/whatsapp/business-phones/${phoneId}/sync`, {
        method: 'POST',
    });

    console.log(response)

    if (response.error) {
        return { data: null, error: response.error.message };
    }

    return { data: response.data?.data ?? null, error: null };
}

/**
 * Re-runs the 360dialog Partner Hosted handover for a number stuck in
 * ONBOARDING_FAILED (for example after the account_sharing/numbers share failed).
 * Idempotent on the backend: it reuses any client created on a prior attempt.
 */
export async function retryDialog360OnboardingAction(phoneId: string, workspaceId: string) {
    if (!workspaceId) {
        return {
            data: null as RetryOnboardingResponse['data'] | null,
            error: 'Área de trabalho não definida para este número',
        };
    }

    // The backend retry endpoint requires BOTH phone_id and workspace_id (owner
    // context). Omitting workspace_id returns 400 "workspace_id is required" before
    // the handover ever runs, which is why the retry silently no-ops.
    const response = await apiClient<RetryOnboardingResponse>(
        `/onboard/360dialog/retry?phone_id=${encodeURIComponent(phoneId)}&workspace_id=${encodeURIComponent(workspaceId)}`,
        { method: 'POST' }
    );

    if (response.error) {
        return { data: null, error: response.error.message };
    }

    return { data: response.data?.data ?? null, error: null };
}

interface CallingStatusBody {
    enabled?: boolean;
}

export async function getWhatsappCallingStatusAction(phoneId: string) {
    const response = await apiClient<CallingStatusBody>(
        `/whatsapp/business-phones/${phoneId}/calling`,
        { method: 'GET' }
    );

    if (response.error) {
        return { enabled: false, error: response.error.message };
    }

    return { enabled: !!response.data?.enabled, error: null };
}

export async function setWhatsappCallingStatusAction(phoneId: string, enabled: boolean) {
    const response = await apiClient<CallingStatusBody>(
        `/whatsapp/business-phones/${phoneId}/calling`,
        { method: 'PUT', body: JSON.stringify({ enabled }) }
    );

    if (response.error) {
        return { enabled: false, error: response.error.message };
    }

    return { enabled: !!response.data?.enabled, error: null };
}

export async function getBusinessProfileAction(phoneId: string) {
    const response = await apiClient<GetBusinessProfileResponse>(
        `/whatsapp/business-phones/${phoneId}/business-profile`,
        { method: 'GET' }
    );

    console.log(response);

    if (response.error) {
        return { data: null as BusinessProfile | null, error: response.error.message };
    }

    const profileData = response.data ?? null;
    return { data: profileData as BusinessProfile | null, error: null };
}

export async function getBusinessProfileAdminAction(phoneId: string) {
    const response = await apiClient<GetBusinessProfileResponse>(
        `/admin/whatsapp/business-phones/${phoneId}/business-profile`,
        { method: 'GET' }
    );

    if (response.error) {
        return { data: null as BusinessProfile | null, error: response.error.message };
    }

    const profileData = response.data ?? null;
    return { data: profileData as BusinessProfile | null, error: null };
}

export async function updateBusinessProfileAction(phoneId: string, payload: UpdateBusinessProfilePayload) {
    const response = await apiClient<UpdateBusinessProfileResponse>(
        `/whatsapp/business-phones/${phoneId}/business-profile`,
        {
            method: 'PUT',
            body: JSON.stringify(payload),
        }
    );

    console.log(response);

    if (response.error) {
        return { data: null, error: response.error.message };
    }

    return { data: response.data ?? null, error: null };
}

export async function uploadProfilePictureAction(formData: FormData) {
    const response = await apiClient<UploadProfilePictureResponse>(
        '/admin/whatsapp/business-phones/profile-picture',
        {
            method: 'POST',
            body: formData,
        }
    );

    if (response.error) {
        return { handle: null as string | null, error: response.error.message };
    }

    return { handle: response.data?.data?.profilePictureHandle ?? null, error: null };
}

export async function deleteBusinessPhoneAction(phoneId: string) {
    const response = await apiClient<DeletePhoneResponse>(`/whatsapp/business-phones/${phoneId}`, {
        method: 'DELETE',
    });

    if (response.error) {
        return { error: response.error.message };
    }

    return { error: null };
}

export async function releaseBusinessPhoneAction(phoneId: string, confirmPhoneNumber: string) {
    const response = await apiClient<ReleasePhoneResponse>(`/whatsapp/business-phones/${phoneId}/release`, {
        method: 'POST',
        body: JSON.stringify({ confirmPhoneNumber }),
    });

    if (response.error) {
        return { data: null as ReleasePhoneResponse['data'] | null, error: response.error.message };
    }

    return { data: response.data?.data ?? null, error: null };
}

export async function deregisterBusinessPhoneAction(phoneId: string) {
    const response = await apiClient<{ data?: { phoneNumber?: WhatsAppBusinessPhone } }>(
        `/whatsapp/business-phones/${phoneId}/deregister`,
        { method: 'POST' }
    );

    if (response.error) {
        return { data: null as WhatsAppBusinessPhone | null, error: response.error.message };
    }

    return { data: response.data?.data?.phoneNumber ?? null, error: null };
}

export async function unassignPhoneOwnerAction(phoneId: string) {
    const response = await apiClient<{ message?: string }>(`/whatsapp/business-phones/${phoneId}/owner`, {
        method: 'DELETE',
    });

    if (response.error) {
        return { error: response.error.message };
    }

    return { error: null };
}

export async function requestVerificationCodeAction(
    phoneId: string,
    payload: RequestVerificationCodePayload
) {
    const response = await apiClient<RequestVerificationCodeResponse>(
        `/whatsapp/business-phones/${phoneId}/request-verification`,
        {
            method: 'POST',
            body: JSON.stringify({
                method: payload.method,
                language: payload.language,
            }),
        }
    );

    console.log(response)

    if (response.error) {
        return { error: response.error.message };
    }

    return { error: null };
}

export async function verifyPhoneCodeAction(
    phoneId: string,
    payload: VerifyPhoneCodePayload
) {
    const response = await apiClient<VerifyPhoneCodeResponse>(
        `/whatsapp/business-phones/${phoneId}/verify-code`,
        {
            method: 'POST',
            body: JSON.stringify({
                code: payload.code,
            }),
        }
    );

    if (response.error) {
        return { error: response.error.message };
    }

    return { data: response.data?.data ?? null, error: null };
}

export async function registerBusinessPhoneAction(
    phoneId: string,
    payload: RegisterPhonePayload
) {
    const response = await apiClient<RegisterPhoneResponse>(
        `/whatsapp/business-phones/${phoneId}/register`,
        {
            method: 'POST',
            body: JSON.stringify({
                pin: payload.pin,
            }),
        }
    );

    if (response.error) {
        return { data: null, error: response.error.message };
    }

    return { data: response.data?.data ?? null, error: null };
}

export async function assignPhoneOwnerAction(phoneId: string, workspaceId: string) {
    const response = await apiClient<{ data: WhatsAppBusinessPhone }>(
        `/whatsapp/business-phones/${phoneId}/owner`,
        {
            method: 'PATCH',
            body: JSON.stringify({ workspaceId }),
        }
    );

    if (response.error) {
        return { data: null, error: response.error.message };
    }

    return { data: response.data?.data ?? null, error: null };
}

export async function listBusinessPhonesAdminAction(params?: BusinessPhoneListParams) {
    const queryParams = new URLSearchParams();
    if (params?.wabaId) queryParams.set('wabaId', params.wabaId);
    if (params?.status) queryParams.set('status', params.status);
    if (params?.qualityRating) queryParams.set('qualityRating', params.qualityRating);
    if (params?.page) queryParams.set('page', String(params.page));
    if (params?.pageSize) queryParams.set('pageSize', String(params.pageSize));
    if (params?.search) queryParams.set('search', params.search);

    const queryString = queryParams.toString();
    const endpoint = `/admin/whatsapp/business-phones${queryString ? `?${queryString}` : ''}`;

    const response = await apiClient<BusinessPhoneListResponse>(endpoint, {
        method: 'GET',
    });

    if (response.error) {
        return {
            phones: [] as WhatsAppBusinessPhone[],
            meta: DEFAULT_BUSINESS_PHONE_META,
            error: response.error.message,
        };
    }

    const { phones, meta } = normalizeBusinessPhoneList(response.data ?? null);

    return { phones, meta, error: null };
}

export async function getBusinessPhoneByIdAdminAction(phoneId: string) {
    const response = await apiClient<BusinessPhoneResponse>(`/admin/whatsapp/business-phones/${phoneId}`, {
        method: 'GET',
    });

    if (response.error) {
        return { phone: null as WhatsAppBusinessPhone | null, error: response.error.message };
    }

    const phoneData = response.data ?? null;
    return { phone: phoneData as WhatsAppBusinessPhone | null, error: null };
}

export interface WhatsAppOnboardingConfig {
    /** Active onboarding provider: "meta" (native Cloud API) or "dialog360". */
    provider: string;
    /** Whether the active onboarding path consumes a workspace phone-capacity slot. */
    requiresSlot: boolean;
}

/**
 * Reads the server's active onboarding mode (mirrors ENABLE_360DIALOG_ONBOARDING).
 * The capacity gate uses `requiresSlot` so it never blocks a slot-free native Meta
 * onboarding, while still gating the slot-billed 360dialog path.
 */
export async function getWhatsAppOnboardingConfigAction(): Promise<{
    config: WhatsAppOnboardingConfig | null;
    error?: string | null;
}> {
    const response = await apiClient<WhatsAppOnboardingConfig>(`/whatsapp/onboarding-config`, {
        method: 'GET',
    });

    if (response.error) {
        return { config: null, error: response.error.message };
    }
    return { config: response.data ?? null, error: null };
}
