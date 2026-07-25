import { REF_COOKIE_NAME } from './ref-cookie.client';
import { cookies } from 'next/headers';

export { REF_COOKIE_NAME, REF_COOKIE_MAX_AGE_SECONDS } from './ref-cookie.client';

export async function getReferralCodeFromCookie(): Promise<string> {
    const store = await cookies();
    const value = store.get(REF_COOKIE_NAME)?.value ?? '';
    return value.trim();
}

export async function clearReferralCookie(): Promise<void> {
    const store = await cookies();
    if (store.get(REF_COOKIE_NAME)) {
        store.delete(REF_COOKIE_NAME);
    }
}
