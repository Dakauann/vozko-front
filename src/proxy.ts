import type { NextRequest } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

const intlMiddleware = createIntlMiddleware(routing);

/**
 * Next.js request boundary (formerly middleware).
 *
 * Locale routing only. Auth is intentionally NOT handled here:
 *
 * - Session refresh lives in the browser (`browser-client` → Go `/auth/refresh` on 401).
 * - Login → dashboard bounce lives on the login page after AuthContext proves a
 *   session via `/user/me` (or after a successful credential login).
 *
 * Edge redirects based on httpOnly access cookies caused historical infinite
 * bounce loops: proxy saw a leftover access cookie and sent users to /dashboard,
 * while the client (missing `userData` or a dead refresh) sent them back to
 * /login. Auth.js documents the same failure mode, do not redirect to a page
 * that will immediately redirect the other way on a partial session signal.
 */
export function proxy(request: NextRequest) {
    return intlMiddleware(request);
}

export const config = {
    matcher: [
        '/((?!api|_next/static|_next/image|favicon.ico|images|videos|audio|3d|privacy-policy|terms-of-service|.*\\.png$|.*\\.jpg$|.*\\.svg$|.*\\.ico$|.*\\.wav$|.*\\.mp3$|.*\\.glb$|.*\\.gltf$).*)',
    ],
};
