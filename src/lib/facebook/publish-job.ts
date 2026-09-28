import type { FacebookPublishJob, FacebookPublishJobStatus } from '@/lib/facebook/types';

export const PUBLISH_JOB_POLL_MS = 2500;

export type PublishJobOutcome = 'pending' | 'published' | 'scheduled' | 'failed' | 'ambiguous';

export function isTerminalJob(status: FacebookPublishJobStatus): boolean {
    return status === 'PUBLISHED' || status === 'SCHEDULED' || status === 'FAILED';
}

export function jobOutcome(job: FacebookPublishJob): PublishJobOutcome {
    switch (job.status) {
        case 'PUBLISHED':
            return 'published';
        case 'SCHEDULED':
            return 'scheduled';
        case 'FAILED':
            return job.error?.ambiguous ? 'ambiguous' : 'failed';
        default:
            return 'pending';
    }
}
