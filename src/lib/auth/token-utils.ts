const ACCESS_TOKEN_REFRESH_THRESHOLD_MS = 5 * 60 * 1000;

export interface AccessTokenPayload {
    sub?: string;
    email?: string;
    role?: string;
    customerType?: string;
    typ?: string;
    iat?: number;
    exp?: number;
}

function decodeBase64Url(value: string): string {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');

    if (typeof atob === 'function') {
        return atob(padded);
    }

    if (typeof Buffer !== 'undefined') {
        return Buffer.from(padded, 'base64').toString('utf-8');
    }

    throw new Error('No base64 decoder available');
}

export function decodeAccessToken(token: string): AccessTokenPayload | null {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) {
            return null;
        }

        return JSON.parse(decodeBase64Url(parts[1])) as AccessTokenPayload;
    } catch {
        return null;
    }
}

export function isAccessTokenExpired(token: string): boolean {
    const payload = decodeAccessToken(token);
    if (!payload?.exp) {
        return false;
    }

    return Date.now() >= payload.exp * 1000;
}

export function isAccessTokenExpiringSoon(
    token: string,
    thresholdMs = ACCESS_TOKEN_REFRESH_THRESHOLD_MS
): boolean {
    const payload = decodeAccessToken(token);
    if (!payload?.exp) {
        return false;
    }

    return payload.exp * 1000 - Date.now() < thresholdMs;
}

export function shouldAttemptSessionRefresh(
    accessToken: string | null | undefined,
    refreshToken: string | null | undefined,
    thresholdMs = ACCESS_TOKEN_REFRESH_THRESHOLD_MS
): boolean {
    if (!refreshToken) {
        return false;
    }

    if (!accessToken) {
        return true;
    }

    return isAccessTokenExpiringSoon(accessToken, thresholdMs);
}
