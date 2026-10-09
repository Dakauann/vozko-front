import type { InboxEntry, WhatsAppCampaignTypeFilter } from '@/lib/conversations/types';

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

const KEYED_FIELD_SEPARATOR = ':';

export interface CrmFilterTarget {
    field: string;
    key?: string;
}

export function keyedFilterField(field: string, key: string): string {
    return `${field}${KEYED_FIELD_SEPARATOR}${key}`;
}

export function filterTarget(address: string): CrmFilterTarget {
    const at = address.indexOf(KEYED_FIELD_SEPARATOR);
    if (at < 0) return { field: address };
    return { field: address.slice(0, at), key: address.slice(at + 1) };
}

export function predicateAddress(predicate: CrmFilterPredicate): string {
    return predicate.key ? keyedFilterField(predicate.field, predicate.key) : predicate.field;
}

function targets(predicate: CrmFilterPredicate, address: string): boolean {
    return predicateAddress(predicate) === address;
}

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
            (p) => targets(p, field) && p.operator === operator,
        )?.values ?? []
    );
}

export function hasFilterPredicate(
    filter: CrmFilter | null | undefined,
    field: string,
    operator: string,
): boolean {
    return filterPredicates(filter).some(
        (p) => targets(p, field) && p.operator === operator,
    );
}

export function withFilterPredicate(
    filter: CrmFilter | null | undefined,
    field: string,
    operator: string,
    values: string[],
    options?: { valueless?: boolean; key?: string },
): CrmFilter {
    const address = options?.key ? keyedFilterField(field, options.key) : field;
    const target = filterTarget(address);
    const next = filterPredicates(filter).filter(
        (p) => !(targets(p, address) && p.operator === operator),
    );
    if (options?.valueless || values.length > 0) {
        next.push({
            field: target.field,
            ...(target.key ? { key: target.key } : {}),
            operator,
            values,
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
            (p) => !(targets(p, field) && (operator === undefined || p.operator === operator)),
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
    whatsappCampaignType?: WhatsAppCampaignTypeFilter;
    owners?: CrmBoardOwner[];
    page?: number;
    pageSize?: number;
    sortField?: string;
    sortOrder?: string;
}

export interface FetchCrmEntriesParams {
    filter?: CrmFilter;
    whatsappCampaignType?: WhatsAppCampaignTypeFilter;
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

export type CrmSelectionMode = 'ids' | 'all_matching' | 'everyone';

export interface CrmBulkInput {
    action: CrmBulkActionType;
    value: string;
    mode: CrmSelectionMode;
    targets?: CrmBulkTarget[];
    filter?: CrmFilter;
    expectedCount?: number;
    fingerprint?: string;
    excludeIds?: string[];
}

export interface CrmBulkCount {
    matched: number;
    fingerprint: string;
}

export interface CrmBulkFailure {
    entryId: string;
    error: string;
}

export interface CrmBulkResult {
    succeeded: number;
    failed: CrmBulkFailure[];
    matched?: number;
    eligible?: number;
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

export type FilterParam =
    | { status: 'empty'; filter: CrmFilter }
    | { status: 'valid'; filter: CrmFilter }
    | { status: 'invalid' };

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringList(value: unknown): value is string[] {
    return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function predicateOf(value: unknown): CrmFilterPredicate | null {
    if (!isRecord(value)) return null;
    const { field, key, operator, values } = value;
    if (typeof field !== 'string' || typeof operator !== 'string') return null;
    if (key !== undefined && typeof key !== 'string') return null;
    if (values !== undefined && !isStringList(values)) return null;
    return { field, ...(key !== undefined ? { key } : {}), operator, values: values ?? [] };
}

function groupOf(value: unknown): CrmFilterGroup | null {
    if (!isRecord(value) || !Array.isArray(value.predicates)) return null;
    const conjunction = value.conjunction;
    if (conjunction !== 'and' && conjunction !== 'or') return null;
    const predicates = value.predicates.map(predicateOf);
    if (predicates.some((predicate) => predicate === null)) return null;
    return { conjunction, predicates: predicates as CrmFilterPredicate[] };
}

function filterOf(value: unknown): CrmFilter | null {
    if (!isRecord(value) || !Array.isArray(value.groups)) return null;
    const groups = value.groups.map(groupOf);
    if (groups.some((group) => group === null)) return null;
    return { groups: groups as CrmFilterGroup[] };
}

export function crmFilterFromValue(value: unknown): CrmFilter | null {
    return filterOf(value);
}

export function parseFilterParam(param: string | null | undefined): FilterParam {
    if (!param) return { status: 'empty', filter: emptyCrmFilter };
    let decoded: unknown;
    try {
        decoded = JSON.parse(decodeBase64(param));
    } catch {
        return { status: 'invalid' };
    }
    const filter = filterOf(decoded);
    if (!filter) return { status: 'invalid' };
    return { status: isEmptyCrmFilter(filter) ? 'empty' : 'valid', filter };
}

export function decodeFilterParam(param: string | null | undefined): CrmFilter {
    const parsed = parseFilterParam(param);
    return parsed.status === 'invalid' ? emptyCrmFilter : parsed.filter;
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
