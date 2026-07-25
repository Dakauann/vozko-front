import { apiClient } from "@/lib/api/browser-client";

export type OwnerPlan = {
    ownerId: string;
    maxCallChannels: number;
    createdAt: string;
    updatedAt: string;
};

export async function getOwnerPlanAction(ownerId: string): Promise<{
    plan: OwnerPlan | null;
    error?: string;
}> {
    const response = await apiClient<OwnerPlan>(`/admin/owners/${ownerId}/plan`, {
        method: 'GET',
    });

    if (response.error) {
        return { plan: null, error: response.error.message };
    }

    return { plan: response.data ?? null };
}

export async function updateOwnerPlanAction(
    ownerId: string,
    data: { maxCallChannels: number }
): Promise<{ plan: OwnerPlan | null; error?: string }> {
    const response = await apiClient<OwnerPlan>(`/admin/owners/${ownerId}/plan`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });

    if (response.error) {
        return { plan: null, error: response.error.message };
    }

    return { plan: response.data ?? null };
}
