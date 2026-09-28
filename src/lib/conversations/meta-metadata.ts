export type MetaPrefix = 'instagram' | 'facebook';

export type MetaMetadata = Record<string, unknown> | null | undefined;

export function metaPrefix(channel: string | null | undefined): MetaPrefix | null {
    return channel === 'instagram' || channel === 'facebook' ? channel : null;
}

function text(meta: MetaMetadata, key: string): string | undefined {
    const value = meta?.[key];
    return typeof value === 'string' && value !== '' ? value : undefined;
}

export function readReaction(meta: MetaMetadata, prefix: MetaPrefix): string | null {
    return text(meta, `${prefix}_reaction_emoji`) ?? text(meta, `${prefix}_reaction`) ?? null;
}

export interface MetaReferral {
    source?: string;
    type?: string;
    ref?: string;
    adId?: string;
    adTitle?: string;
}

export function readReferral(meta: MetaMetadata, prefix: MetaPrefix): MetaReferral | null {
    const key = (name: string) => text(meta, `${prefix}_referral_${name}`);
    const referral: MetaReferral = {
        source: key('source'),
        adTitle: key('ad_title'),
        adId: key('ad_id'),
        ref: key('ref'),
        type: key('type'),
    };
    return Object.values(referral).some(Boolean) ? referral : null;
}

export function readLinkShare(meta: MetaMetadata, prefix: MetaPrefix): { url?: string; title?: string } | null {
    const url = text(meta, `${prefix}_link_url`);
    const title = text(meta, `${prefix}_link_title`);
    return url || title ? { url, title } : null;
}

export function readPostShare(meta: MetaMetadata, prefix: MetaPrefix): { url?: string; title?: string; id?: string } | null {
    const url = text(meta, `${prefix}_shared_post_url`);
    const title = text(meta, `${prefix}_shared_post_title`);
    const id = text(meta, `${prefix}_shared_post_id`);
    return url || title || id ? { url, title, id } : null;
}

const LIKE_STICKER_IDS = new Set(['369239263222822', '369239343222814', '369239383222810']);

export function readStickerId(meta: MetaMetadata, prefix: MetaPrefix): string | null {
    return text(meta, `${prefix}_sticker_id`) ?? null;
}

export function isLikeSticker(stickerId: string | null | undefined): boolean {
    return !!stickerId && LIKE_STICKER_IDS.has(stickerId);
}

export type MessengerSentVia = 'vozko' | 'meta_business_suite' | 'external_app' | 'unknown';

const SENT_VIA: MessengerSentVia[] = ['vozko', 'meta_business_suite', 'external_app', 'unknown'];

export function readSentVia(meta: MetaMetadata): MessengerSentVia | null {
    const value = text(meta, 'facebook_sent_via');
    return value && (SENT_VIA as string[]).includes(value) ? (value as MessengerSentVia) : null;
}

export function readPostback(meta: MetaMetadata): { payload: string; title?: string } | null {
    const payload = text(meta, 'facebook_postback_payload');
    return payload ? { payload, title: text(meta, 'facebook_postback_title') } : null;
}

export function readStory(meta: MetaMetadata, prefix: MetaPrefix): string | undefined {
    return text(meta, `${prefix}_story_url`) ?? text(meta, `${prefix}_story_mention_url`);
}
