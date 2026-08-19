/**
 * The leads filter model.
 *
 * This is the client half of one shared contract: the predicates built here are
 * `crmfilter` predicates (domain/crmfilter on the backend), carried in the same
 * base64-JSON `filter` parameter the CRM board already uses, and compiled to SQL
 * by the lead descriptor. Nothing here invents a leads-only filter language —
 * the CrmFilter helpers in @/lib/crm/board are reused verbatim.
 *
 * The catalogue below therefore has exactly one job: say which fields the LEAD
 * object supports and how each one should be rendered. It is the single list the
 * filter bar, the active-chips row and the URL codec all read.
 */

import {
    LEAD_MEMORY_CATEGORIES,
    type LeadMemoryCategory,
} from '@/lib/lead-memories/types';
import {
    countFilterPredicates,
    emptyCrmFilter,
    filterPredicates,
    isEmptyCrmFilter,
    removeFilterPredicate,
    type CrmFilter,
    type CrmFilterPredicate,
} from '@/lib/crm/board';

/** Field ids, mirroring domain/crmfilter's registry for the lead object. */
export const LEAD_FILTER_FIELD = {
    query: 'query',
    name: 'name',
    number: 'number',
    age: 'age',
    blocked: 'blocked',
    channel: 'channel',
    campaign: 'campaign',
    campaignStatus: 'campaign_status',
    campaignCount: 'campaign_count',
    windowOpen: 'window_open',
    stage: 'stage',
    label: 'label',
    memoryCategory: 'memory_category',
    memoryAuthor: 'memory_author',
    memoryText: 'memory_text',
    memoryCount: 'memory_count',
    memoryUpdatedAt: 'memory_updated_at',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    lastActivityAt: 'last_activity_at',
} as const;

export type LeadFilterField =
    (typeof LEAD_FILTER_FIELD)[keyof typeof LEAD_FILTER_FIELD];

/**
 * How a field is presented.
 *
 * - `text`     one free-text box (contains)
 * - `enum`     a checklist of known values (in)
 * - `idset`    a checklist of ids fetched at runtime — campaigns, stages, labels
 * - `number`   a min/max pair (gte/lte)
 * - `date`     a from/to pair (gte/lte)
 * - `boolean`  yes / no / any (is_true / is_false)
 * - `presence` has any / has none (is_set / is_empty)
 */
export type LeadFilterControl =
    | 'text'
    | 'enum'
    | 'idset'
    | 'number'
    | 'date'
    | 'boolean'
    | 'presence';

/** The group a field belongs to in the filter panel. */
export type LeadFilterGroup =
    | 'identity'
    | 'engagement'
    | 'campaigns'
    | 'crm'
    | 'memories';

export interface LeadFilterOption {
    value: string;
    /** i18n key under `leadsPage.filters.options`, when the values are static. */
    labelKey?: string;
    label?: string;
    color?: string;
}

export interface LeadFilterFieldSpec {
    field: LeadFilterField;
    control: LeadFilterControl;
    group: LeadFilterGroup;
    /** i18n key under `leadsPage.filters.fields`. */
    labelKey: string;
    /** Static options for `enum` controls. */
    options?: LeadFilterOption[];
    /**
     * Facet bucket this control's counts come from, when the server publishes
     * one. Keeps the badge and the predicate reading the same vocabulary.
     */
    facetKey?: 'memoryCategories' | 'channels' | 'campaignStatuses';
}

/** The channels a lead can exist on, mirroring the backend's channel union. */
export const LEAD_CHANNELS = [
    'whatsapp',
    'unofficial_whatsapp',
    'telegram',
    'instagram',
] as const;

export type LeadChannel = (typeof LEAD_CHANNELS)[number];

/**
 * WhatsApp campaign delivery outcomes, as stored on whatsapp_campaign_entries.
 * `FAILED` is the one operators segment on most: it is the retry list.
 */
export const LEAD_CAMPAIGN_STATUSES = [
    'PENDING',
    'SENT',
    'DELIVERED',
    'READ',
    'FAILED',
] as const;

/** Who wrote a memory, mirroring domain/actor.Kind. */
export const LEAD_MEMORY_AUTHORS = ['ai', 'human', 'system'] as const;

export const LEAD_FILTER_FIELDS: LeadFilterFieldSpec[] = [
    // Identity ───────────────────────────────────────────────────────────────
    { field: LEAD_FILTER_FIELD.name, control: 'text', group: 'identity', labelKey: 'name' },
    { field: LEAD_FILTER_FIELD.number, control: 'text', group: 'identity', labelKey: 'number' },
    { field: LEAD_FILTER_FIELD.age, control: 'number', group: 'identity', labelKey: 'age' },
    { field: LEAD_FILTER_FIELD.blocked, control: 'boolean', group: 'identity', labelKey: 'blocked' },

    // Engagement ─────────────────────────────────────────────────────────────
    {
        field: LEAD_FILTER_FIELD.channel,
        control: 'enum',
        group: 'engagement',
        labelKey: 'channel',
        facetKey: 'channels',
        options: LEAD_CHANNELS.map((value) => ({ value, labelKey: `channel.${value}` })),
    },
    { field: LEAD_FILTER_FIELD.windowOpen, control: 'boolean', group: 'engagement', labelKey: 'windowOpen' },
    { field: LEAD_FILTER_FIELD.lastActivityAt, control: 'date', group: 'engagement', labelKey: 'lastActivityAt' },
    { field: LEAD_FILTER_FIELD.createdAt, control: 'date', group: 'engagement', labelKey: 'createdAt' },
    { field: LEAD_FILTER_FIELD.updatedAt, control: 'date', group: 'engagement', labelKey: 'updatedAt' },

    // Campaigns ──────────────────────────────────────────────────────────────
    { field: LEAD_FILTER_FIELD.campaign, control: 'idset', group: 'campaigns', labelKey: 'campaign' },
    {
        field: LEAD_FILTER_FIELD.campaignStatus,
        control: 'enum',
        group: 'campaigns',
        labelKey: 'campaignStatus',
        facetKey: 'campaignStatuses',
        options: LEAD_CAMPAIGN_STATUSES.map((value) => ({
            value,
            labelKey: `campaignStatus.${value}`,
        })),
    },
    { field: LEAD_FILTER_FIELD.campaignCount, control: 'number', group: 'campaigns', labelKey: 'campaignCount' },

    // CRM tags ───────────────────────────────────────────────────────────────
    { field: LEAD_FILTER_FIELD.stage, control: 'idset', group: 'crm', labelKey: 'stage' },
    { field: LEAD_FILTER_FIELD.label, control: 'idset', group: 'crm', labelKey: 'label' },

    // Memories ───────────────────────────────────────────────────────────────
    {
        field: LEAD_FILTER_FIELD.memoryCategory,
        control: 'enum',
        group: 'memories',
        labelKey: 'memoryCategory',
        facetKey: 'memoryCategories',
        options: LEAD_MEMORY_CATEGORIES.map((value: LeadMemoryCategory) => ({
            value,
            labelKey: `memoryCategory.${value}`,
        })),
    },
    {
        field: LEAD_FILTER_FIELD.memoryAuthor,
        control: 'enum',
        group: 'memories',
        labelKey: 'memoryAuthor',
        options: LEAD_MEMORY_AUTHORS.map((value) => ({
            value,
            labelKey: `memoryAuthor.${value}`,
        })),
    },
    { field: LEAD_FILTER_FIELD.memoryText, control: 'text', group: 'memories', labelKey: 'memoryText' },
    { field: LEAD_FILTER_FIELD.memoryCount, control: 'number', group: 'memories', labelKey: 'memoryCount' },
    { field: LEAD_FILTER_FIELD.memoryUpdatedAt, control: 'date', group: 'memories', labelKey: 'memoryUpdatedAt' },
];

export const LEAD_FILTER_GROUP_ORDER: LeadFilterGroup[] = [
    'identity',
    'engagement',
    'campaigns',
    'crm',
    'memories',
];

export function leadFilterSpec(
    field: string,
): LeadFilterFieldSpec | undefined {
    return LEAD_FILTER_FIELDS.find((spec) => spec.field === field);
}

// The control-level read/write helpers are generic over any CrmFilter, so they
// live in @/lib/filters/controls and are re-exported here for callers that
// think in terms of leads.
export {
    readBoolean,
    readBound,
    readPresence,
    readSet,
    readText,
    toggleInSet,
    withBoolean,
    withBound,
    withPresence,
    withSet,
    withText,
    type RangeBound as LeadRangeBound,
} from '@/lib/filters/controls';

/**
 * Every active predicate, in catalogue order, for the chips row.
 *
 * Ordering by the catalogue rather than by insertion keeps the chips stable
 * while the operator edits: a row that reshuffles itself on every keystroke is
 * unreadable and impossible to click.
 */
export function activeLeadPredicates(filter: CrmFilter): CrmFilterPredicate[] {
    const order = new Map(
        LEAD_FILTER_FIELDS.map((spec, index) => [spec.field as string, index]),
    );
    return [...filterPredicates(filter)].sort(
        (a, b) => (order.get(a.field) ?? 99) - (order.get(b.field) ?? 99),
    );
}

export {
    countFilterPredicates as countLeadFilters,
    emptyCrmFilter as emptyLeadFilter,
    isEmptyCrmFilter as isEmptyLeadFilter,
    removeFilterPredicate as removeLeadPredicate,
};
export type { CrmFilter as LeadFilter, CrmFilterPredicate as LeadFilterPredicate };
