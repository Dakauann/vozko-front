export const FACEBOOK_ERROR_CODES = [
    'reconnect_required',
    'facebook_busy',
    'app_not_approved',
    'page_restricted',
    'facebook_rejected',
    'capability_denied',
    'thread_owned_elsewhere',
    'text_too_long',
    'comment_not_ours',
    'post_not_editable',
    'kind_unavailable',
    'delete_not_permitted',
    'invalid_post',
    'reel_limit',
    'profile_rate_limited',
    'private_reply_used',
    'private_reply_expired',
    'private_reply_deadline_unknown',
    'invalid_rule',
    'already_linked',
    'forbidden',
] as const;

export type FacebookErrorCode = (typeof FACEBOOK_ERROR_CODES)[number];

export function facebookErrorKey(code: string | undefined): string | null {
    if (!code || !(FACEBOOK_ERROR_CODES as readonly string[]).includes(code)) return null;
    return `errors.${code}`;
}
