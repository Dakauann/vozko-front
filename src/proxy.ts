import type { NextRequest } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

const intlMiddleware = createIntlMiddleware(routing);

export function proxy(request: NextRequest) {
    return intlMiddleware(request);
}

export const config = {
    matcher: [
        '/((?!api|_next/static|_next/image|favicon.ico|images|videos|audio|3d|privacy-policy|terms-of-service|.*\\.png$|.*\\.jpg$|.*\\.svg$|.*\\.ico$|.*\\.wav$|.*\\.mp3$|.*\\.glb$|.*\\.gltf$).*)',
    ],
};
