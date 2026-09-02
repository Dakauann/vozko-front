import type { InboxEntry } from '@/lib/conversations/types';

// crmfilter.Filter shape (mirrors domain/crmfilter on the backend). A filter is a
// set of groups; each group ANDs/ORs its predicates and the groups combine with
// AND. An empty filter means "no constraint" (the whole workspace-global view).
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

// ── Predicate helpers ────────────────────────────────────────────────────────
// A filter bar is a set of controls that each own one (field, operator) pair,
// and every one of them needs to read its current values, replace them, or drop
// them. These live here rather than inside a bar component because there is now
// more than one bar (conversations, opportunities, leads) and three private
// copies of "how do I find my predicate" is three chances for them to disagree
// about what an empty value means.

/** Every predicate across every group, flattened. */
export function filterPredicates(
    filter: CrmFilter | null | undefined,
): CrmFilterPredicate[] {
    if (!filter) return [];
    return filter.groups.flatMap((g) => g.predicates ?? []);
}

/**
 * Rebuild a filter from a flat predicate list.
 *
 * Every predicate lands in ONE `and` group, which is the semantics a bar of
 * independent controls implies: each control narrows the result further. A
 * control that needs OR (several values of the same field) expresses it with an
 * `in` predicate, not with a second group.
 */
export function filterFromPredicates(list: CrmFilterPredicate[]): CrmFilter {
    if (list.length === 0) return emptyCrmFilter;
    return { groups: [{ conjunction: 'and', predicates: list }] };
}

/** The values currently held by one (field, operator) pair, or []. */
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

/** True when a (field, operator) pair is present, regardless of its values. */
export function hasFilterPredicate(
    filter: CrmFilter | null | undefined,
    field: string,
    operator: string,
): boolean {
    return filterPredicates(filter).some(
        (p) => p.field === field && p.operator === operator,
    );
}

/**
 * Replace — or, when `values` is empty and the operator takes values, clear —
 * the predicate for a (field, operator) pair.
 *
 * Value-less operators (`is_set`, `is_empty`, `is_true`, `is_false`) are set by
 * passing an empty array with `valueless: true`; that distinction is why this
 * cannot just test `values.length`.
 */
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

/** Drop one (field, operator) pair, or every predicate on a field. */
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

/** How many constraints are active — the number on the "filters" badge. */
export function countFilterPredicates(
    filter: CrmFilter | null | undefined,
): number {
    return filterPredicates(filter).length;
}

// The board axis. `none` collapses into a single "Todos" column.
export type CrmGroupBy = 'stage' | 'label' | 'owner' | 'none';

// One owner-axis column supplied by the caller (the frontend already knows the
// assignable member list).
export interface CrmBoardOwner {
    id: string;
    name: string;
}

// EntryWithLastMessage as serialized by the Go board handler. That struct has no
// json tags, so Go emits its field names verbatim (PascalCase). We only type the
// fields the funnel cards actually read.
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
    // The entry's inbox owner (responsável), hydrated by the board read model from
    // inbox_assignment. Empty/absent when unassigned.
    AssignedUserID?: string;
}

export interface CrmColumn {
    id: string;
    name: string;
    color?: string;
    total: number;
    // Go serializes an empty column's entries (a nil slice) as null, so callers
    // must coalesce (`col.entries ?? []`) before iterating.
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

// Params for the flat list read path (GET /crm/entries), driven by the same
// CrmFilter the board uses. SortField is the backend's small whitelist
// ('' → last message, 'created' → created_at); SortOrder is 'asc' | 'desc'.
export interface FetchCrmEntriesParams {
    filter?: CrmFilter;
    sortField?: string;
    sortOrder?: string;
    page?: number;
    pageSize?: number;
}

// GET /crm/entries payload: a page of entries plus the unpaginated total.
export interface CrmEntriesResult {
    entries: CrmBoardEntry[];
    total: number;
}

// POST /crm/bulk contract. One Action + Value fans out over every Target.
export type CrmBulkActionType =
    | 'move_stage'
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
    // stageId (move_stage), userId (assign) or labelId (add/remove_label).
    value: string;
    /**
     * Apply to EVERY entry the filter matches, not just the ones the client can
     * name. Used when `targets` is empty; the server re-runs this filter under
     * the caller's own scope rather than trusting a client-supplied id list, so
     * a view showing 340 rows can be moved in one request without paging through
     * them to collect ids.
     */
    filter?: CrmFilter;
}

export interface CrmBulkFailure {
    entryId: string;
    error: string;
}

// Aggregated fan-out outcome mirrored from crmbulk.BulkResult (Go).
export interface CrmBulkResult {
    succeeded: number;
    failed: CrmBulkFailure[];
    // Filter-addressed bulk only: how many the filter matched, and whether the
    // server's per-request cap stopped short of all of them.
    matched?: number;
    truncated?: boolean;
}

// The backend accepts the filter as (optionally base64-encoded) JSON. We base64
// it so the JSON braces never need query-string escaping.
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

// True when the filter carries no constraint at all. Used to keep URLs clean
// (an empty filter is omitted rather than encoded).
export function isEmptyCrmFilter(filter: CrmFilter | null | undefined): boolean {
    if (!filter || filter.groups.length === 0) return true;
    return filter.groups.every((g) => g.predicates.length === 0);
}

// Compact URL encoding for a CrmFilter (base64 JSON). Returns '' for an empty
// filter so it can be dropped from the query string.
export function encodeFilterParam(filter: CrmFilter | null | undefined): string {
    if (isEmptyCrmFilter(filter)) return '';
    return encodeBase64(JSON.stringify(filter));
}

// Inverse of encodeFilterParam. Any malformed value degrades to the empty
// filter rather than throwing so a hand-edited URL never breaks the board.
export function decodeFilterParam(param: string | null | undefined): CrmFilter {
    if (!param) return emptyCrmFilter;
    try {
        const parsed = JSON.parse(decodeBase64(param)) as CrmFilter;
        if (parsed && Array.isArray(parsed.groups)) return parsed;
    } catch {
        // fall through
    }
    return emptyCrmFilter;
}

// Adapt a board entry (Go EntryWithLastMessage JSON) into the InboxEntry shape the
// existing funnel cards render. Only the fields present on the board payload are
// populated; the rest fall back to inert defaults.
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
