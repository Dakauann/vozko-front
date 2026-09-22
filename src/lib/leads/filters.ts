
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

export type LeadFilterControl =
    | 'text'
    | 'enum'
    | 'idset'
    | 'number'
    | 'date'
    | 'boolean'
    | 'presence';

export type LeadFilterGroup =
    | 'identity'
    | 'engagement'
    | 'campaigns'
    | 'crm'
    | 'memories';

export interface LeadFilterOption {
    value: string;
    labelKey?: string;
    label?: string;
    color?: string;
}

export interface LeadFilterFieldSpec {
    field: LeadFilterField;
    control: LeadFilterControl;
    group: LeadFilterGroup;
    labelKey: string;
    options?: LeadFilterOption[];
    facetKey?: 'memoryCategories' | 'channels' | 'campaignStatuses';
}

export const LEAD_CHANNELS = [
    'whatsapp',
    'unofficial_whatsapp',
    'telegram',
    'instagram',
] as const;

export type LeadChannel = (typeof LEAD_CHANNELS)[number];

export const LEAD_CAMPAIGN_STATUSES = [
    'PENDING',
    'SENT',
    'DELIVERED',
    'READ',
    'FAILED',
] as const;

export const LEAD_MEMORY_AUTHORS = ['ai', 'human', 'system'] as const;

export const LEAD_FILTER_FIELDS: LeadFilterFieldSpec[] = [
    { field: LEAD_FILTER_FIELD.name, control: 'text', group: 'identity', labelKey: 'name' },
    { field: LEAD_FILTER_FIELD.number, control: 'text', group: 'identity', labelKey: 'number' },
    { field: LEAD_FILTER_FIELD.age, control: 'number', group: 'identity', labelKey: 'age' },
    { field: LEAD_FILTER_FIELD.blocked, control: 'boolean', group: 'identity', labelKey: 'blocked' },

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

    { field: LEAD_FILTER_FIELD.stage, control: 'idset', group: 'crm', labelKey: 'stage' },
    { field: LEAD_FILTER_FIELD.label, control: 'idset', group: 'crm', labelKey: 'label' },

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
