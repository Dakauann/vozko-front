import type {
    ListUsersMeta,
    ListUsersParams,
    ListUsersResponse,
    UpdateUserRolePayload,
    User,
    UserResponse,
} from '@/lib/users/types';

import { apiClient } from "@/lib/api/browser-client";

const DEFAULT_USERS_META: ListUsersMeta = {
    page: 1,
    pageSize: 20,
    totalPages: 1,
    totalItems: 0,
};

export async function listUsersAction(params: ListUsersParams = {}) {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.set('page', params.page.toString());
    if (params.pageSize) queryParams.set('pageSize', params.pageSize.toString());
    if (params.search) queryParams.set('search', params.search);
    if (params.role) queryParams.set('role', params.role);

    const queryString = queryParams.toString();
    const url = `/admin/users${queryString ? `?${queryString}` : ''}`;

    const response = await apiClient<ListUsersResponse>(url, {
        method: 'GET',
    });

    console.log(response)

    if (response.error) {
        return {
            users: [] as User[],
            meta: DEFAULT_USERS_META,
            error: response.error.message,
        };
    }

    const data = response.data?.items;

    return {
        users: data ?? [],
        meta: {
            page: response.data?.page ?? 1,
            pageSize: response.data?.page_size ?? 20,
            totalPages: response.data?.total_pages ?? 1,
            totalItems: response.data?.total_items ?? 0,
        },
        error: null,
    };
}

export async function getUserByIdAction(userId: string) {
    const response = await apiClient<UserResponse>(`/admin/users/${userId}`, {
        method: 'GET',
    });

    if (response.error) {
        return {
            user: null,
            error: response.error.message,
        };
    }

    const raw = response.data as Record<string, unknown> | undefined;
    const user: User | null = raw?.data
        ? (raw.data as User)
        : raw?.email
            ? (raw as unknown as User)
            : null;

    return {
        user,
        error: null,
    };
}

export async function updateUserRoleAction(userId: string, payload: UpdateUserRolePayload) {
    const response = await apiClient<UserResponse>(`/admin/users/${userId}/role`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
    });

    if (response.error) {
        const errorMessage = response.error.message;
        const status = response.error.status;

        if (status === 403) {
            return {
                user: null,
                error: 'Cannot modify your own role',
            };
        }

        if (status === 409) {
            return {
                user: null,
                error: 'Cannot remove role from the last admin',
            };
        }

        return {
            user: null,
            error: errorMessage,
        };
    }

    return {
        user: response.data?.data ?? null,
        error: null,
    };
}


export async function adminSendEmailVerificationAction(email: string) {
    const response = await apiClient<{ message: string }>('/admin/users/send-email-verification', {
        method: 'POST',
        body: JSON.stringify({ email }),
    });

    if (response.error) {
        return { error: response.error.message };
    }

    return { success: true };
}

type AdminRegisterPayload = {
    name: string;
    email: string;
    password: string;
    customerType: 'individual' | 'company';
    cpf?: string;
    cnpj?: string;
    verificationToken: string;
};

type AdminRegisterResult = {
    userId: string;
    email: string;
    name: string;
    role: string;
    customerType: string;
    message: string;
};

export async function adminRegisterUserAction(payload: AdminRegisterPayload) {
    const response = await apiClient<AdminRegisterResult>('/admin/users/register', {
        method: 'POST',
        body: JSON.stringify(payload),
    });

    if (response.error) {
        return { user: null as AdminRegisterResult | null, error: response.error.message, statusCode: response.error.status };
    }

    return { user: response.data ?? null, error: null };
}
