import type { InboxEntry } from '@/lib/conversations/types';

export type CrmFilterConjunction = 'and' | 'or';

export interface CrmFilterPredicate {
    field: string;
    key?: string;
    operator: string;
    values: string[];
}

export interface CrmFilterGroup {
    conjunction: CrmFilterConjunction;
    predicates: CrmFilterPredicate[];
}

export interface CrmFilter {
    groups: CrmFilterGroup[];
}

export const emptyCrmFilter: CrmFilter = { groups: [] };


export function filterPredicates(
    filter: CrmFilter | null | undefined,
): CrmFilterPredicate[] {
    if (!filter) return [];
    return filter.groups.flatMap((g) => g.predicates ?? []);
}

export function filterFromPredicates(list: CrmFilterPredicate[]): CrmFilter {
    if (list.length === 0) return emptyCrmFilter;
    return { groups: [{ conjunction: 'and', predicates: list }] };
}

export function readFilterValues(
    filter: CrmFilter | null | undefined,
    field: string,
    operator: string,
): string[] {
    return (
        filterPredicates(filter).find(
            (p) => p.field === field && p.operator === operator,
        )?.values ?? []
    );
}

export function hasFilterPredicate(
    filter: CrmFilter | null | undefined,
    field: string,
    operator: string,
): boolean {
    return filterPredicates(filter).some(
        (p) => p.field === field && p.operator === operator,
    );
}

export function withFilterPredicate(
    filter: CrmFilter | null | undefined,
    field: string,
    operator: string,
    values: string[],
    options?: { valueless?: boolean; key?: string },
): CrmFilter {
    const next = filterPredicates(filter).filter(
        (p) => !(p.field === field && p.operator === operator),
    );
    if (options?.valueless || values.length > 0) {
        next.push({
            field,
            operator,
            values,
            ...(options?.key ? { key: options.key } : {}),
        });
    }
    return filterFromPredicates(next);
}

export function removeFilterPredicate(
    filter: CrmFilter | null | undefined,
    field: string,
    operator?: string,
): CrmFilter {
    return filterFromPredicates(
        filterPredicates(filter).filter(
            (p) => !(p.field === field && (operator === undefined || p.operator === operator)),
        ),
    );
}

export function countFilterPredicates(
    filter: CrmFilter | null | undefined,
): number {
    return filterPredicates(filter).length;
}

export type CrmGroupBy = 'stage' | 'label' | 'owner' | 'none';

export interface CrmBoardOwner {
    id: string;
    name: string;
}

export interface CrmBoardEntry {
    EntryID: string;
    EntryType: string;
    CampaignID?: string;
    CampaignName?: string;
    LeadID?: string;
    LeadName?: string;
    LeadNumber?: string;
    BusinessPhoneID?: string;
    UnreadCount?: number;
    LastMessageText?: string;
    LastMessageType?: string;
    LastMessageAt?: string;
    LastMessageFrom?: string;
    HasMedia?: boolean;
    MediaType?: string;
    TotalMatches?: number;
    AssignedUserID?: string;
}

export interface CrmColumn {
    id: string;
    name: string;
    color?: string;
    total: number;
    entries: CrmBoardEntry[] | null;
}

export interface CrmBoard {
    groupBy: string;
    columns: CrmColumn[];
}

export interface FetchCrmBoardParams {
    groupBy: CrmGroupBy;
    pipelineId?: string;
    filter?: CrmFilter;
    owners?: CrmBoardOwner[];
    page?: number;
    pageSize?: number;
    sortField?: string;
    sortOrder?: string;
}

export interface FetchCrmEntriesParams {
    filter?: CrmFilter;
    sortField?: string;
    sortOrder?: string;
    page?: number;
    pageSize?: number;
}

export interface CrmEntriesResult {
    entries: CrmBoardEntry[];
    total: number;
}

export type CrmBulkActionType =
    | 'move_stage'
    | 'move_funnel'
    | 'assign'
    | 'add_label'
    | 'remove_label';

export interface CrmBulkTarget {
    entryId: string;
    entryType: string;
}

export interface CrmBulkInput {
    action: CrmBulkActionType;
    targets: CrmBulkTarget[];
    value: string;
    filter?: CrmFilter;
}

export interface CrmBulkFailure {
    entryId: string;
    error: string;
}

export interface CrmBulkResult {
    succeeded: number;
    failed: CrmBulkFailure[];
    matched?: number;
    truncated?: boolean;
}

export function encodeBase64(value: string): string {
    if (typeof Buffer !== 'undefined') {
        return Buffer.from(value, 'utf-8').toString('base64');
    }
    return btoa(unescape(encodeURIComponent(value)));
}

function decodeBase64(value: string): string {
    if (typeof Buffer !== 'undefined') {
        return Buffer.from(value, 'base64').toString('utf-8');
    }
    return decodeURIComponent(escape(atob(value)));
}

export function isEmptyCrmFilter(filter: CrmFilter | null | undefined): boolean {
    if (!filter || filter.groups.length === 0) return true;
    return filter.groups.every((g) => g.predicates.length === 0);
}

export function encodeFilterParam(filter: CrmFilter | null | undefined): string {
    if (isEmptyCrmFilter(filter)) return '';
    return encodeBase64(JSON.stringify(filter));
}

export function decodeFilterParam(param: string | null | undefined): CrmFilter {
    if (!param) return emptyCrmFilter;
    try {
        const parsed = JSON.parse(decodeBase64(param)) as CrmFilter;
        if (parsed && Array.isArray(parsed.groups)) return parsed;
    } catch {
    }
    return emptyCrmFilter;
}

export function boardEntryToInboxEntry(e: CrmBoardEntry): InboxEntry {
    return {
        entry_id: e.EntryID,
        entry_type: (e.EntryType as InboxEntry['entry_type']) ?? 'whatsapp',
        lead_id: e.LeadID,
        lead_name: e.LeadName ?? '',
        lead_number: e.LeadNumber ?? '',
        unread_count: e.UnreadCount ?? 0,
        last_message_preview: e.LastMessageText ?? '',
        last_message_at: e.LastMessageAt ?? '',
        last_message_type: (e.LastMessageType as InboxEntry['last_message_type']) ?? 'user_message',
        last_message_sender: e.LastMessageFrom ?? '',
        last_message_sender_avatar: '',
        window_open: false,
        window_expires_at: null,
        business_phone_id: e.BusinessPhoneID ?? '',
        stage: null,
        campaign_id: e.CampaignID,
        campaign_name: e.CampaignName,
        total_matches: e.TotalMatches ?? 0,
    };
}
