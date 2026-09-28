import { scheduleProblem, type ScheduleProblem } from '@/lib/facebook/schedule';
import type { CreateFacebookPostPayload, FacebookMediaRef, FacebookPublishKind } from '@/lib/facebook/types';

export const MIN_ALBUM_PHOTOS = 2;
export const MAX_ALBUM_PHOTOS = 10;
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 1024 * 1024 * 1024;
export const MAX_REELS_PER_DAY = 30;
export const PHOTO_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/bmp', 'image/tiff'] as const;
export const VIDEO_MIME_TYPE = 'video/mp4';

export interface FacebookPostDraft {
    kind: FacebookPublishKind;
    message: string;
    link: string;
    media: FacebookMediaRef[];
    videoTitle: string;
    scheduledAt: Date | null;
}

export type ComposerProblem =
    | 'messageRequired'
    | 'linkInvalid'
    | 'photoCount'
    | 'albumCount'
    | 'photoType'
    | 'photoTooLarge'
    | 'videoCount'
    | 'videoType'
    | 'videoTooLarge'
    | 'storyCount'
    | 'storyNoText'
    | 'titleOnlyVideo'
    | `schedule${Capitalize<ScheduleProblem>}`;

export function isHttpsUrl(raw: string): boolean {
    try {
        const url = new URL(raw.trim());
        return url.protocol === 'https:' && url.host !== '';
    } catch {
        return false;
    }
}

function isVideo(media: FacebookMediaRef): boolean {
    return media.mimeType.toLowerCase().startsWith('video/');
}

function photoProblems(media: FacebookMediaRef[]): ComposerProblem[] {
    const problems = new Set<ComposerProblem>();
    for (const item of media) {
        if (!(PHOTO_MIME_TYPES as readonly string[]).includes(item.mimeType.toLowerCase())) problems.add('photoType');
        if (item.sizeBytes > MAX_PHOTO_BYTES) problems.add('photoTooLarge');
    }
    return [...problems];
}

function videoProblems(item: FacebookMediaRef): ComposerProblem[] {
    const problems: ComposerProblem[] = [];
    if (item.mimeType.toLowerCase() !== VIDEO_MIME_TYPE) problems.push('videoType');
    if (item.sizeBytes > MAX_VIDEO_BYTES) problems.push('videoTooLarge');
    return problems;
}

function kindProblems(draft: FacebookPostDraft): ComposerProblem[] {
    switch (draft.kind) {
        case 'text':
            return draft.message.trim() ? [] : ['messageRequired'];
        case 'link':
            return isHttpsUrl(draft.link) ? [] : ['linkInvalid'];
        case 'photo':
            return draft.media.length === 1 ? photoProblems(draft.media) : ['photoCount'];
        case 'album':
            return draft.media.length >= MIN_ALBUM_PHOTOS && draft.media.length <= MAX_ALBUM_PHOTOS
                ? photoProblems(draft.media)
                : ['albumCount'];
        case 'video':
        case 'reel':
            return draft.media.length === 1 ? videoProblems(draft.media[0]) : ['videoCount'];
        case 'story': {
            const problems: ComposerProblem[] = draft.message.trim() ? ['storyNoText'] : [];
            if (draft.media.length !== 1) return [...problems, 'storyCount'];
            const item = draft.media[0];
            return [...problems, ...(isVideo(item) ? videoProblems(item) : photoProblems([item]))];
        }
    }
}

export function composerProblems(draft: FacebookPostDraft, now: Date): ComposerProblem[] {
    const problems = kindProblems(draft);
    if (draft.videoTitle.trim() && draft.kind !== 'video') problems.push('titleOnlyVideo');
    if (draft.scheduledAt) {
        const problem = scheduleProblem(draft.kind, draft.scheduledAt, now);
        if (problem) problems.push(`schedule${problem.charAt(0).toUpperCase()}${problem.slice(1)}` as ComposerProblem);
    }
    return problems;
}

const USES_MEDIA: FacebookPublishKind[] = ['photo', 'album', 'video', 'reel', 'story'];

export function toCreatePayload(draft: FacebookPostDraft): CreateFacebookPostPayload {
    const payload: CreateFacebookPostPayload = { kind: draft.kind };
    const message = draft.message.trim();
    if (message && draft.kind !== 'story') payload.message = message;
    if (draft.kind === 'link') payload.link = draft.link.trim();
    if (USES_MEDIA.includes(draft.kind)) payload.media = draft.media;
    const title = draft.videoTitle.trim();
    if (title && draft.kind === 'video') payload.videoTitle = title;
    if (draft.scheduledAt) payload.scheduledPublishTime = draft.scheduledAt.toISOString();
    return payload;
}
