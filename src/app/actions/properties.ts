import type {
    CreatePropertyPayload,
    ListPropertiesParams,
    PaginatedPropertiesResponse,
    Property,
    PropertyResponse,
    UpdatePropertyPayload,
} from '@/lib/properties/types';
import { apiFetch } from '@/lib/api/http';
import { apiClient } from "@/lib/api/browser-client";

export async function listPropertiesAction(params?: ListPropertiesParams): Promise<{
    data: PaginatedPropertiesResponse | null;
    error?: string;
}> {
    const queryParams = new URLSearchParams();

    if (params) {
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                queryParams.set(key, value.toString());
            }
        });
    }

    const queryString = queryParams.toString();
    const endpoint = `/properties${queryString ? `?${queryString}` : ''}`;

    const response = await apiFetch<PaginatedPropertiesResponse>(endpoint, {
        method: 'GET',
    });

    if (response.error) {
        return { data: null, error: response.error.message };
    }

    return { data: response.data ?? null };
}

export async function searchPropertiesAction(params?: ListPropertiesParams): Promise<{
    data: PaginatedPropertiesResponse | null;
    error?: string;
}> {
    const queryParams = new URLSearchParams();

    if (params) {
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                queryParams.set(key, value.toString());
            }
        });
    }

    const queryString = queryParams.toString();
    const endpoint = `/properties/search${queryString ? `?${queryString}` : ''}`;

    const response = await apiFetch<PaginatedPropertiesResponse>(endpoint, {
        method: 'GET',
    });

    if (response.error) {
        return { data: null, error: response.error.message };
    }

    return { data: response.data ?? null };
}

export async function getPropertyByIdAction(propertyId: string): Promise<{
    property: Property | null;
    error?: string;
}> {
    if (!propertyId) {
        return { property: null, error: 'Invalid property ID' };
    }

    const response = await apiFetch<PropertyResponse>(`/properties/${propertyId}`, {
        method: 'GET',
    });

    if (response.error) {
        return { property: null, error: response.error.message };
    }

    return { property: response.data?.data ?? null };
}

export async function createPropertyAction(payload: CreatePropertyPayload): Promise<{
    property: Property | null;
    error?: string;
}> {
    if (!payload.shopId) {
        return { property: null, error: 'Shop ID is required' };
    }
    if (!payload.name) {
        return { property: null, error: 'Property name is required' };
    }
    if (!payload.type) {
        return { property: null, error: 'Property type is required' };
    }
    if (!payload.location?.address || !payload.location?.city) {
        return { property: null, error: 'Address and city are required' };
    }
    if (!payload.price || payload.price <= 0) {
        return { property: null, error: 'Valid price is required' };
    }
    if (!payload.total_area || payload.total_area <= 0) {
        return { property: null, error: 'Valid total area is required' };
    }

    const response = await apiClient<PropertyResponse>('/properties', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    if (response.error) {
        return { property: null, error: response.error.message };
    }

    return { property: response.data?.data ?? null };
}

export async function updatePropertyAction(
    propertyId: string,
    payload: UpdatePropertyPayload
): Promise<{
    property: Property | null;
    error?: string;
}> {
    if (!propertyId) {
        return { property: null, error: 'Invalid property ID' };
    }

    const response = await apiClient<PropertyResponse>(`/properties/${propertyId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    if (response.error) {
        return { property: null, error: response.error.message };
    }

    return { property: response.data?.data ?? null };
}

export async function deletePropertyAction(propertyId: string): Promise<{
    success: boolean;
    error?: string;
}> {
    if (!propertyId) {
        return { success: false, error: 'Invalid property ID' };
    }

    const response = await apiClient<{ success: boolean; data: { message: string } }>(`/properties/${propertyId}`, {
        method: 'DELETE',
    });

    if (response.error) {
        return { success: false, error: response.error.message };
    }

    return { success: true };
}