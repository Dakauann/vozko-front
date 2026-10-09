import { apiClient } from "@/lib/api/browser-client";
import { codedErrorOf, type CodedError } from "@/lib/api/coded-error";
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
): Promise<{ field: CustomFieldDefinition | null; error?: CodedError }> {
    const response = await apiClient<CustomFieldDefinition>('/custom-fields', {
        method: 'POST',
        body: JSON.stringify(input),
    });
    if (response.error) return { field: null, error: codedErrorOf(response.error) };
    return { field: response.data ?? null };
}

export async function updateCustomFieldAction(
    id: string,
    input: Partial<CustomFieldInput>,
): Promise<{ field: CustomFieldDefinition | null; error?: CodedError }> {
    const response = await apiClient<CustomFieldDefinition>(`/custom-fields/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
    });
    if (response.error) return { field: null, error: codedErrorOf(response.error) };
    return { field: response.data ?? null };
}

export async function deleteCustomFieldAction(
    id: string,
): Promise<{ success: boolean; error?: CodedError }> {
    const response = await apiClient<void>(`/custom-fields/${id}`, { method: 'DELETE' });
    if (response.error) return { success: false, error: codedErrorOf(response.error) };
    return { success: true };
}
