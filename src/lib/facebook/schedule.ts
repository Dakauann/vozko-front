import type { FacebookPublishKind } from '@/lib/facebook/types';

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

export const MIN_SCHEDULE_LEAD_MS = 10 * MINUTE_MS;
export const MAX_SCHEDULE_LEAD_MS = 75 * DAY_MS;
export const MAX_VIDEO_SCHEDULE_LEAD_MS = 180 * DAY_MS;

export type ScheduleProblem = 'invalid' | 'tooSoon' | 'tooFar' | 'notSchedulable';

export function maxScheduleLeadMs(kind: FacebookPublishKind): number {
    return kind === 'video' ? MAX_VIDEO_SCHEDULE_LEAD_MS : MAX_SCHEDULE_LEAD_MS;
}

export function scheduleProblem(kind: FacebookPublishKind, at: Date, now: Date): ScheduleProblem | null {
    if (kind === 'story') return 'notSchedulable';
    const time = at.getTime();
    if (Number.isNaN(time)) return 'invalid';
    const lead = time - now.getTime();
    if (lead < MIN_SCHEDULE_LEAD_MS) return 'tooSoon';
    if (lead > maxScheduleLeadMs(kind)) return 'tooFar';
    return null;
}
