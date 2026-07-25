// Pure, transport-only HTTP helpers: no cookies, no next/headers, no document.
// Safe to import from BOTH client and server modules. The cookie-coupled
// `apiAuthFetch` (server-side workspace/department header resolution) lives in
// `client.ts` and must only be imported by server code.

export function getApiBaseUrl(): string {
    return (
        process.env.API_BASE_URL ||
        process.env.NEXT_PUBLIC_API_BASE_URL ||
        'http://localhost:3001'
    );
}

export interface ApiError {
    message: string;
    status: number;
    code?: string;
    error?: unknown;
}

export interface ApiResponse<T> {
    data?: T;
    error?: ApiError;
}

export async function apiFetch<T>(
    endpoint: string,
    options: RequestInit = {}
): Promise<ApiResponse<T>> {
    const API_BASE_URL = getApiBaseUrl();
    const isAbsoluteUrl = /^https?:\/\//i.test(endpoint);
    const url = isAbsoluteUrl ? endpoint : `${API_BASE_URL}${endpoint}`;
    try {
        const isFormDataBody =
            typeof FormData !== "undefined" && options.body instanceof FormData;

        let headers: HeadersInit = options.headers ?? {};

        if (headers instanceof Headers) {
            if (!isFormDataBody && !headers.has("Content-Type")) {
                headers.set("Content-Type", "application/json");
            }
        } else if (Array.isArray(headers)) {
            const hasContentType = headers.some(
                ([key]) => key.toLowerCase() === "content-type"
            );
            if (!isFormDataBody && !hasContentType) {
                headers = [...headers, ["Content-Type", "application/json"]];
            }
        } else {
            headers = {
                ...(headers as Record<string, string>),
            };
            if (!isFormDataBody && !headers["Content-Type"]) {
                headers["Content-Type"] = "application/json";
            }
        }

        const response = await fetch(url, {
            ...options,
            headers,
        });

        if (!response.ok) {
            const errorData = await response
                .json()
                .catch(() => ({} as Record<string, unknown>));
            console.error('[apiFetch] API error response:', JSON.stringify({
                url: url,
                status: response.status,
                statusText: response.statusText,
                errorData,
            }));
            return {
                error: {
                    message:
                        (errorData as { message?: string }).message ||
                        "An error occurred",
                    status: response.status,
                    code:
                        (errorData as { code?: string }).code || undefined,
                    error: errorData,
                },
            };
        }

        let data: T | undefined;
        if (response.status !== 204) {
            data = await response.json().catch(() => undefined);
        }

        return { data };
    } catch (error) {
        console.error('[apiFetch] Network/fetch error:', error instanceof Error ? error.message : error, 'url:', url);
        return {
            error: {
                message:
                    error instanceof Error ? error.message : "Network error",
                status: 500,
                error,
            },
        };
    }
}
