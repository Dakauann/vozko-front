import { defaultLocale, locales } from './config';

import { createNavigation } from 'next-intl/navigation';
import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
    locales,
    defaultLocale,
    localePrefix: 'always',
    localeDetection: true,
});


export const { Link, redirect, usePathname, useRouter, getPathname } =
    createNavigation(routing);
