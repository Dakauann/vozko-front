/**
 * @vitest-environment happy-dom
 *
 * Edge-case tests for client-side cookie utilities.
 * Uses a manual cookie store mock because happy-dom's cookie deletion
 * via expires/max-age is unreliable across tests.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hasUserDataCookie, getUserDataFromCookie } from '@/lib/auth/client-cookies';

let cookieStore: Record<string, string> = {};

beforeEach(() => {
    cookieStore = {};
    Object.defineProperty(document, 'cookie', {
        configurable: true,
        get() {
            return Object.entries(cookieStore)
                .map(([k, v]) => `${k}=${v}`)
                .join('; ');
        },
        set(value: string) {
            const match = value.match(/^([^=;]+)=([^;]*)/);
            if (match) {
                const name = match[1].trim();
                const val = match[2];
                if (value.includes('max-age=0') || value.includes('expires=Thu, 01 Jan 1970')) {
                    delete cookieStore[name];
                } else {
                    cookieStore[name] = val;
                }
            }
        },
    });
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('client-cookies edge cases', () => {
    it('hasUserDataCookie returns true when userData cookie exists', () => {
        cookieStore['userData'] = encodeURIComponent(JSON.stringify({ id: 'user-1' }));
        expect(hasUserDataCookie()).toBe(true);
    });

    it('hasUserDataCookie returns false when no cookies', () => {
        expect(hasUserDataCookie()).toBe(false);
    });

    it('hasUserDataCookie returns false when only other cookies exist', () => {
        cookieStore['workspaceId'] = 'ws-1';
        cookieStore['theme'] = 'dark';
        expect(hasUserDataCookie()).toBe(false);
    });

    it('hasUserDataCookie returns true when userData is among multiple cookies', () => {
        cookieStore['workspaceId'] = 'ws-1';
        cookieStore['userData'] = encodeURIComponent(JSON.stringify({ id: 'x' }));
        cookieStore['theme'] = 'dark';
        expect(hasUserDataCookie()).toBe(true);
    });

    it('getUserDataFromCookie parses valid JSON', () => {
        const user = { id: 'user-1', email: 'a@b.com', name: 'A', role: 'admin', customerType: 'company' };
        document.cookie = `userData=${encodeURIComponent(JSON.stringify(user))}`;
        const result = getUserDataFromCookie();
        expect(result).toEqual(user);
    });

    it('getUserDataFromCookie returns null for malformed JSON', () => {
        document.cookie = 'userData=not-valid-json';
        expect(getUserDataFromCookie()).toBeNull();
    });

    it('getUserDataFromCookie returns null when cookie value is empty', () => {
        document.cookie = 'userData=';
        expect(getUserDataFromCookie()).toBeNull();
    });

    it('getUserDataFromCookie returns null when no cookie exists', () => {
        expect(getUserDataFromCookie()).toBeNull();
    });

    it('getUserDataFromCookie handles URL-encoded special characters', () => {
        const user = { id: 'user-1', email: 'a@b.com', name: 'Alice "Bob"', role: 'admin', customerType: 'company' };
        document.cookie = `userData=${encodeURIComponent(JSON.stringify(user))}`;
        const result = getUserDataFromCookie();
        expect(result).toEqual(user);
    });
});
