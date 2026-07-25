/**
 * @vitest-environment node
 */

import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { proxy } from './proxy';

const intlMiddlewareMock = vi.hoisted(() => vi.fn());

vi.mock('next-intl/middleware', () => ({
    default: vi.fn(() => intlMiddlewareMock),
}));

vi.mock('./i18n/routing', () => ({
    routing: {},
}));

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
        }),
    );

    return `${header}.${payload}.signature`;
}

describe('proxy', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        intlMiddlewareMock.mockReset();
        intlMiddlewareMock.mockImplementation(() => NextResponse.next());
        vi.stubGlobal('fetch', vi.fn());
    });

    it('only runs intl middleware and never calls the Go API', async () => {
        const fetchMock = vi.mocked(fetch);

        const request = new NextRequest('http://localhost/pt/dashboard', {
            headers: {
                host: 'localhost',
                cookie: `accessToken=${makeAccessToken(-60_000)}; refreshToken=opaque-refresh-token`,
            },
        });

        const response = await proxy(request);

        expect(fetchMock).not.toHaveBeenCalled();
        expect(intlMiddlewareMock).toHaveBeenCalledWith(request);
        expect(response.status).toBe(200);
        expect(response.cookies.get('accessToken')?.value).toBeUndefined();
    });

    it('does not bounce /login to /dashboard based on access cookies (avoids redirect loops)', async () => {
        const fetchMock = vi.mocked(fetch);

        const request = new NextRequest('http://localhost/pt/login', {
            headers: {
                host: 'localhost',
                cookie: `accessToken=${makeAccessToken(60 * 60 * 1000)}; refreshToken=opaque-refresh-token; userData=%7B%22id%22%3A%22user-1%22%7D`,
            },
        });

        intlMiddlewareMock.mockImplementation(() => {
            const res = NextResponse.next();
            res.headers.set('x-middleware-rewrite', 'http://localhost/pt/login');
            return res;
        });

        const response = await proxy(request);

        expect(fetchMock).not.toHaveBeenCalled();
        expect(response.status).not.toBe(307);
        expect(response.headers.get('location')).toBeNull();
        expect(intlMiddlewareMock).toHaveBeenCalledWith(request);
    });

    it('does not bounce /login when the access token is an opaque non-JWT cookie', async () => {
        const request = new NextRequest('http://localhost/pt/login', {
            headers: {
                host: 'localhost',
                cookie: `accessToken=opaque-access-token; refreshToken=opaque-refresh-token`,
            },
        });

        intlMiddlewareMock.mockImplementation(() => {
            const res = NextResponse.next();
            res.headers.set('x-middleware-rewrite', 'http://localhost/pt/login');
            return res;
        });

        const response = await proxy(request);

        expect(response.status).not.toBe(307);
        expect(vi.mocked(fetch)).not.toHaveBeenCalled();
    });

    it('does not clear or rewrite session cookies on any navigation', async () => {
        const request = new NextRequest('http://localhost/pt/dashboard/agents', {
            headers: {
                host: 'localhost',
                cookie: `accessToken=${makeAccessToken(60_000)}; refreshToken=rt; userData=%7B%22id%22%3A%22u%22%7D`,
            },
        });

        const response = await proxy(request);

        expect(response.cookies.get('accessToken')?.value).toBeUndefined();
        expect(response.cookies.get('refreshToken')?.value).toBeUndefined();
        expect(response.cookies.get('userData')?.value).toBeUndefined();
        expect(vi.mocked(fetch)).not.toHaveBeenCalled();
    });
});
