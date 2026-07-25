import { apiClient } from "@/lib/api/browser-client";
import type {
    CustomFieldDefinition,
    CustomFieldInput,
} from '@/lib/crm/custom-fields';

export async function listCustomFieldsAction(
    objectType = 'opportunity',
): Promise<{ fields: CustomFieldDefinition[]; error?: string }> {
    const qs = objectType ? `?objectType=${encodeURIComponent(objectType)}` : '';
    const response = await apiClient<CustomFieldDefinition[]>(`/custom-fields${qs}`, { method: 'GET' });
    if (response.error) return { fields: [], error: response.error.message };
    return { fields: response.data ?? [] };
}

export async function createCustomFieldAction(
    input: CustomFieldInput,
): Promise<{ field: CustomFieldDefinition | null; error?: string }> {
    const response = await apiClient<CustomFieldDefinition>('/custom-fields', {
        method: 'POST',
        body: JSON.stringify(input),
    });
    if (response.error) return { field: null, error: response.error.message };
    return { field: response.data ?? null };
}

export async function updateCustomFieldAction(
    id: string,
    input: Partial<CustomFieldInput>,
): Promise<{ field: CustomFieldDefinition | null; error?: string }> {
    const response = await apiClient<CustomFieldDefinition>(`/custom-fields/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
    });
    if (response.error) return { field: null, error: response.error.message };
    return { field: response.data ?? null };
}

export async function deleteCustomFieldAction(
    id: string,
): Promise<{ success: boolean; error?: string }> {
    const response = await apiClient<void>(`/custom-fields/${id}`, { method: 'DELETE' });
    if (response.error) return { success: false, error: response.error.message };
    return { success: true };
}
