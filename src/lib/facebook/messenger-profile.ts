import { isHttpsUrl } from '@/lib/facebook/composer';
import type { MessengerIceBreaker, MessengerPersistentMenu, MessengerProfile } from '@/lib/facebook/types';

export const MAX_ICE_BREAKERS = 4;
export const MAX_MENU_ITEMS = 20;
export const MAX_MENU_TITLE_CHARS = 30;
export const MAX_GREETING_CHARS = 160;
export const GET_STARTED_PAYLOAD = 'GET_STARTED';
export const DEFAULT_PROFILE_LOCALE = 'default';

export type ProfileProblem =
    | 'menuNeedsGetStarted'
    | 'greetingTooLong'
    | 'tooManyIceBreakers'
    | 'iceBreakerIncomplete'
    | 'tooManyMenuItems'
    | 'menuTitleLength'
    | 'menuPayloadMissing'
    | 'menuLinkInvalid';

export function emptyMessengerProfile(): MessengerProfile {
    return { greeting: [], getStarted: null, iceBreakers: [], persistentMenu: [] };
}

function charCount(text: string): number {
    return Array.from(text).length;
}

export function profileProblems(profile: MessengerProfile): ProfileProblem[] {
    const problems = new Set<ProfileProblem>();
    if (profile.persistentMenu.length > 0 && !profile.getStarted) problems.add('menuNeedsGetStarted');
    for (const greeting of profile.greeting) {
        if (charCount(greeting.text) > MAX_GREETING_CHARS) problems.add('greetingTooLong');
    }
    for (const set of profile.iceBreakers) {
        if (set.items.length > MAX_ICE_BREAKERS) problems.add('tooManyIceBreakers');
        if (set.items.some((item) => !item.question.trim() || !item.payload.trim())) problems.add('iceBreakerIncomplete');
    }
    for (const menu of profile.persistentMenu) {
        if (menu.items.length > MAX_MENU_ITEMS) problems.add('tooManyMenuItems');
        for (const item of menu.items) {
            const title = item.title.trim();
            if (!title || charCount(title) > MAX_MENU_TITLE_CHARS) problems.add('menuTitleLength');
            if (item.type === 'postback' && !item.payload.trim()) problems.add('menuPayloadMissing');
            if (item.type === 'web_url' && !isHttpsUrl(item.url)) problems.add('menuLinkInvalid');
        }
    }
    return [...problems];
}

const LOCALE_PATTERN = /^[a-z]{2}_[A-Z]{2}$/;

export function isProfileLocale(locale: string): boolean {
    return locale === DEFAULT_PROFILE_LOCALE || LOCALE_PATTERN.test(locale);
}

export function profileLocales(profile: MessengerProfile): string[] {
    const seen = new Set<string>([DEFAULT_PROFILE_LOCALE]);
    for (const entry of [...profile.greeting, ...profile.iceBreakers, ...profile.persistentMenu]) seen.add(entry.locale);
    return [...seen];
}

export function greetingFor(profile: MessengerProfile, locale: string): string {
    return profile.greeting.find((g) => g.locale === locale)?.text ?? '';
}

export function withGreeting(profile: MessengerProfile, locale: string, text: string): MessengerProfile {
    const others = profile.greeting.filter((g) => g.locale !== locale);
    return { ...profile, greeting: text.trim() ? [...others, { locale, text }] : others };
}

export function iceBreakersFor(profile: MessengerProfile, locale: string): MessengerIceBreaker[] {
    return profile.iceBreakers.find((set) => set.locale === locale)?.items ?? [];
}

export function withIceBreakers(profile: MessengerProfile, locale: string, items: MessengerIceBreaker[]): MessengerProfile {
    const others = profile.iceBreakers.filter((set) => set.locale !== locale);
    return { ...profile, iceBreakers: items.length > 0 ? [...others, { locale, items }] : others };
}

export function menuFor(profile: MessengerProfile, locale: string): MessengerPersistentMenu | null {
    return profile.persistentMenu.find((menu) => menu.locale === locale) ?? null;
}

export function withMenu(profile: MessengerProfile, locale: string, menu: MessengerPersistentMenu | null): MessengerProfile {
    const others = profile.persistentMenu.filter((m) => m.locale !== locale);
    return { ...profile, persistentMenu: menu ? [...others, menu] : others };
}

export function normalizeMessengerProfile(raw: Partial<MessengerProfile> | null | undefined): MessengerProfile {
    return {
        greeting: raw?.greeting ?? [],
        getStarted: raw?.getStarted ?? null,
        iceBreakers: raw?.iceBreakers ?? [],
        persistentMenu: raw?.persistentMenu ?? [],
    };
}
