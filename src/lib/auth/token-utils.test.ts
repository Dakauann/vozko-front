/**
 * @vitest-environment node
 */

import {
    decodeAccessToken,
    isAccessTokenExpired,
    isAccessTokenExpiringSoon,
    shouldAttemptSessionRefresh,
} from '@/lib/auth/token-utils';
import { describe, expect, it } from 'vitest';

function toBase64Url(value: string): string {
    return Buffer.from(value, 'utf-8')
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
}

function makeAccessToken(offsetMs: number): string {
    const now = Date.now();
    const header = toBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = toBase64Url(
        JSON.stringify({
            sub: 'user-1',
            email: 'alice@example.com',
            role: 'admin',
            customerType: 'company',
            iat: Math.floor(now / 1000),
            exp: Math.floor((now + offsetMs) / 1000),
        })
    );

    return `${header}.${payload}.signature`;
}

describe('token-utils', () => {
    it('decodes access token payload fields', () => {
        const token = makeAccessToken(15 * 60 * 1000);

        expect(decodeAccessToken(token)).toMatchObject({
            sub: 'user-1',
            email: 'alice@example.com',
            role: 'admin',
            customerType: 'company',
        });
    });

    it('treats expired access tokens as expired', () => {
        expect(isAccessTokenExpired(makeAccessToken(-60_000))).toBe(true);
        expect(isAccessTokenExpired(makeAccessToken(15 * 60 * 1000))).toBe(false);
    });

    it('refreshes based on access token state instead of refresh token format', () => {
        const expiredAccessToken = makeAccessToken(-60_000);
        const validAccessToken = makeAccessToken(15 * 60 * 1000);

        expect(shouldAttemptSessionRefresh(expiredAccessToken, 'opaque-refresh-token')).toBe(true);
        expect(shouldAttemptSessionRefresh(validAccessToken, 'opaque-refresh-token')).toBe(false);
        expect(shouldAttemptSessionRefresh(null, 'opaque-refresh-token')).toBe(true);
        expect(shouldAttemptSessionRefresh(expiredAccessToken, null)).toBe(false);
    });

    it('marks near-expiry access tokens for refresh', () => {
        expect(isAccessTokenExpiringSoon(makeAccessToken(30_000))).toBe(true);
        expect(isAccessTokenExpiringSoon(makeAccessToken(10 * 60 * 1000))).toBe(false);
    });

    it('treats non-JWT opaque tokens as not expired (let the backend validate)', () => {
        expect(isAccessTokenExpired('opaque-access-token')).toBe(false);
        expect(isAccessTokenExpiringSoon('opaque-access-token')).toBe(false);
        expect(shouldAttemptSessionRefresh('opaque-access-token', 'refresh-token')).toBe(false);
    });

    it('treats JWT tokens without exp as not expired (let the backend validate)', () => {
        const header = toBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
        const payload = toBase64Url(JSON.stringify({ sub: 'user-1' }));
        const tokenWithoutExp = `${header}.${payload}.signature`;

        expect(isAccessTokenExpired(tokenWithoutExp)).toBe(false);
        expect(isAccessTokenExpiringSoon(tokenWithoutExp)).toBe(false);
        expect(shouldAttemptSessionRefresh(tokenWithoutExp, 'refresh-token')).toBe(false);
    });

    it('attempts refresh when access token is absent but refresh token exists', () => {
        expect(shouldAttemptSessionRefresh(null, 'refresh-token')).toBe(true);
        expect(shouldAttemptSessionRefresh(undefined, 'refresh-token')).toBe(true);
        expect(shouldAttemptSessionRefresh('', 'refresh-token')).toBe(true);
    });
});
