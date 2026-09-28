import type {
    FacebookConnectResult,
    FacebookConnectStatus,
    FacebookPageConnectOutcome,
    FacebookPageOutcome,
} from '@/lib/facebook/types';

export const FACEBOOK_POPUP_SOURCE = 'fb-business-login';
export const FACEBOOK_PAGES_PATH = '/dashboard/facebook-pages';

const STATUSES: FacebookConnectStatus[] = ['connected', 'partial', 'error', 'cancelled'];

function isStatus(value: unknown): value is FacebookConnectStatus {
    return typeof value === 'string' && (STATUSES as string[]).includes(value);
}

function toOutcome(raw: unknown): FacebookPageConnectOutcome | null {
    if (!raw || typeof raw !== 'object') return null;
    const entry = raw as Record<string, unknown>;
    if (typeof entry.fbPageId !== 'string' || typeof entry.outcome !== 'string') return null;
    return {
        id: typeof entry.id === 'string' ? entry.id : undefined,
        fbPageId: entry.fbPageId,
        name: typeof entry.name === 'string' ? entry.name : '',
        outcome: entry.outcome as FacebookPageOutcome,
        missing: Array.isArray(entry.missing) ? entry.missing.filter((m): m is string => typeof m === 'string') : [],
        warning: typeof entry.warning === 'string' ? entry.warning : undefined,
    };
}

export function connectResultFromMessage(data: Record<string, unknown>): FacebookConnectResult | null {
    if (!isStatus(data.status)) return null;
    const pages = Array.isArray(data.pages) ? data.pages.map(toOutcome).filter((p): p is FacebookPageConnectOutcome => p !== null) : [];
    return {
        status: data.status,
        reason: typeof data.reason === 'string' ? data.reason : undefined,
        pages,
    };
}

function count(raw: string | null): number | undefined {
    if (raw === null) return undefined;
    const value = Number.parseInt(raw, 10);
    return Number.isNaN(value) ? undefined : value;
}

export function connectResultFromQuery(params: URLSearchParams): FacebookConnectResult | null {
    const status = params.get('facebook');
    if (!isStatus(status)) return null;
    return {
        status,
        connected: count(params.get('connected')),
        skipped: count(params.get('skipped')),
        reason: params.get('reason') ?? undefined,
    };
}

export function isConnectedOutcome(outcome: FacebookPageOutcome): boolean {
    return outcome === 'connected' || outcome === 'reconnected';
}
