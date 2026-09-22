import { apiClient } from '@/lib/api/browser-client';

export async function authenticatedFetch<T>(
    endpoint: string,
    options?: RequestInit,
): Promise<{ data?: T; error?: { message: string; status?: number } }> {
    return apiClient<T>(endpoint, options);
}
