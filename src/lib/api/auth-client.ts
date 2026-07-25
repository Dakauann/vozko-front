import { apiClient } from '@/lib/api/browser-client';

/**
 * Authenticated browser -> API fetch.
 *
 * Thin compatibility wrapper over `apiClient`: kept so existing callers do not
 * change. Auth rides the httpOnly cookie (see browser-client.ts); this no longer
 * reads or forwards the access token, and refresh-on-401 is handled centrally.
 */
export async function authenticatedFetch<T>(
    endpoint: string,
    options?: RequestInit,
): Promise<{ data?: T; error?: { message: string; status?: number } }> {
    return apiClient<T>(endpoint, options);
}
