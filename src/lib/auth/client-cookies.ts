import type { User } from './types';

export function getUserDataFromCookie(): User | null {
    if (typeof window === 'undefined') {
        return null;
    }

    const cookies = document.cookie.split(';');
    const userDataCookie = cookies.find(cookie => cookie.trim().startsWith('userData='));

    if (!userDataCookie) {
        return null;
    }

    const userDataValue = userDataCookie.split('=')[1];
    if (!userDataValue) {
        return null;
    }

    try {
        const user = JSON.parse(decodeURIComponent(userDataValue)) as User;
        return user;
    } catch (error) {
        console.error('[ClientCookies] Error parsing userData cookie:', error);
        return null;
    }
}

export function hasUserDataCookie(): boolean {
    if (typeof window === 'undefined') {
        return false;
    }

    const cookies = document.cookie.split(';');
    return cookies.some(cookie => {
        const trimmed = cookie.trim();
        return trimmed.startsWith('userData=');
    });
}

export function clearClientAuthCookies(): void {
    if (typeof window === 'undefined') {
        return;
    }

    const cookieNames = ['accessToken', 'refreshToken', 'userData', 'workspaceId', 'departmentId'];
    const hostname = window.location.hostname;

    const domainVariations: (string | undefined)[] = [
        undefined, // No domain = current host only (most common for localhost)
    ];

    const isLocalhost = hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname.endsWith('.localhost');

    if (!isLocalhost && !/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
        const parts = hostname.split('.');
        if (parts.length >= 2) {
            const rootDomain = `.${parts.slice(-2).join('.')}`;
            domainVariations.push(rootDomain);
        }
        domainVariations.push(`.${hostname}`);
    }

    const pathVariations = ['/', ''];

    for (const name of cookieNames) {
        for (const domain of domainVariations) {
            for (const path of pathVariations) {
                const domainStr = domain ? `; domain=${domain}` : '';
                const pathStr = path ? `; path=${path}` : '';
                document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT${pathStr}${domainStr}`;
                document.cookie = `${name}=; max-age=0${pathStr}${domainStr}`;
            }
        }
    }

    if (process.env.NODE_ENV !== 'production') {
        console.log('[ClientCookies] Cleared auth cookies. Remaining:', document.cookie);
    }
}
