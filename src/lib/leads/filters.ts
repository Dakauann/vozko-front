
import { cepDigits } from '@/lib/address/cep';
import { LEAD_MEMORY_CATEGORIES } from '@/lib/lead-memories/types';
import {
    countFilterPredicates,
    emptyCrmFilter,
    filterPredicates,
    isEmptyCrmFilter,
    keyedFilterField,
    predicateAddress,
    removeFilterPredicate,
    type CrmFilter,
    type CrmFilterPredicate,
} from '@/lib/crm/board';
import {
    readableFields,
    optionTone,
    type CustomFieldDefinition,
    type CustomFieldType,
} from '@/lib/crm/custom-fields';
import { precisionLabelKey } from '@/lib/maps/precision';
import { PRECISIONS } from '@/lib/maps/types';
import type { ToneKey } from '@/lib/tones/tones';
import { LEAD_FAMILY_KINDS, LEAD_REFERRAL_KINDS, type LeadGeoStatus } from '@/lib/leads/types';

export const LEAD_FILTER_INVALID = 'lead_filter_invalid';

export const LEAD_FILTER_FIELD = {
    query: 'query',
    name: 'name',
    number: 'number',
    email: 'email',
    nickname: 'nickname',
    age: 'age',
    birthday: 'birthday',
    birthDate: 'birth_date',
    source: 'source',
    hasIdentity: 'has_identity',
    blocked: 'blocked',
    optedOut: 'opted_out',
    whatsappOptIn: 'whatsapp_opt_in',
    zip: 'zip',
    city: 'city',
    district: 'district',
    state: 'state',
    hasAddress: 'has_address',
    geoPrecision: 'geo_precision',
    geoStatus: 'geo_status',
    geoPlacement: 'geo_placement',
    area: 'area',
    areaApproximate: 'area_approximate',
    relationKind: 'relation_kind',
    relativesCount: 'relatives_count',
    referredCount: 'referred_count',
    referredBy: 'referred_by',
    owner: 'owner',
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
    custom: 'custom',
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
    | 'address'
    | 'family'
    | 'owner'
    | 'engagement'
    | 'campaigns'
    | 'crm'
    | 'memories'
    | 'custom';

export type LeadRuntimeOptions =
    | 'campaigns'
    | 'stages'
    | 'labels'
    | 'owners'
    | 'cities'
    | 'districts';

export type LeadFilterEntry = 'zip' | 'lead';

export type LeadFacetKey = 'memoryCategories' | 'channels' | 'campaignStatuses' | 'sources';

export interface LeadFilterOption {
    value: string;
    labelKey?: string;
    label?: string;
    color?: string;
    tone?: ToneKey;
}

export interface LeadFilterSides {
    true: string;
    false: string;
}

export interface LeadFilterFieldSpec {
    field: LeadFilterField;
    control: LeadFilterControl;
    group: LeadFilterGroup;
    labelKey: string;
    options?: LeadFilterOption[];
    runtimeOptions?: LeadRuntimeOptions;
    facetKey?: LeadFacetKey;
    sides?: LeadFilterSides;
    presence?: LeadFilterSides;
    entry?: LeadFilterEntry;
    readsAddresses?: boolean;
}

export interface LeadCustomFilterSpec {
    field: string;
    control: LeadFilterControl;
    group: 'custom';
    label: string;
    options?: LeadFilterOption[];
}

export const LEAD_CHANNELS = [
    'whatsapp',
    'unofficial_whatsapp',
    'telegram',
    'instagram',
    'facebook',
    'webchat',
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

export const LEAD_BIRTHDAY_WINDOWS = ['today', 'this_week', 'this_month'] as const;

export const LEAD_SOURCES = ['manual', 'import', 'channel'] as const;

export const LEAD_GEO_STATUSES: readonly LeadGeoStatus[] = [
    'pending',
    'located',
    'approximate',
    'not_found',
    'ambiguous',
    'unavailable',
    'quota_exceeded',
    'refused',
];

export const LEAD_GEO_PLACEMENTS = [
    'on_map',
    'approximate',
    'without_address',
    'not_found',
    'pending',
    'quota_exceeded',
    'refused',
] as const;

export type LeadGeoPlacement = (typeof LEAD_GEO_PLACEMENTS)[number];

export const LEAD_STATES = [
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
    'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const;

const OPTIONS_PATH = 'leadsPage.filters.options';

function translatedOptions(values: readonly string[], path: string): LeadFilterOption[] {
    return values.map((value) => ({ value, labelKey: `${path}.${value}` }));
}

function sides(labelKey: string): LeadFilterSides {
    return { true: `${OPTIONS_PATH}.${labelKey}.true`, false: `${OPTIONS_PATH}.${labelKey}.false` };
}

export const LEAD_FILTER_FIELDS: LeadFilterFieldSpec[] = [
    { field: LEAD_FILTER_FIELD.name, control: 'text', group: 'identity', labelKey: 'name' },
    { field: LEAD_FILTER_FIELD.number, control: 'text', group: 'identity', labelKey: 'number' },
    { field: LEAD_FILTER_FIELD.email, control: 'text', group: 'identity', labelKey: 'email' },
    { field: LEAD_FILTER_FIELD.nickname, control: 'text', group: 'identity', labelKey: 'nickname' },
    { field: LEAD_FILTER_FIELD.age, control: 'number', group: 'identity', labelKey: 'age' },
    {
        field: LEAD_FILTER_FIELD.birthday,
        control: 'enum',
        group: 'identity',
        labelKey: 'birthday',
        options: translatedOptions(LEAD_BIRTHDAY_WINDOWS, `${OPTIONS_PATH}.birthday`),
    },
    { field: LEAD_FILTER_FIELD.birthDate, control: 'date', group: 'identity', labelKey: 'birthDate' },
    {
        field: LEAD_FILTER_FIELD.source,
        control: 'enum',
        group: 'identity',
        labelKey: 'source',
        facetKey: 'sources',
        options: translatedOptions(LEAD_SOURCES, 'leadDetail.contact.sources'),
    },
    { field: LEAD_FILTER_FIELD.hasIdentity, control: 'boolean', group: 'identity', labelKey: 'hasIdentity', sides: sides('hasIdentity') },
    { field: LEAD_FILTER_FIELD.blocked, control: 'boolean', group: 'identity', labelKey: 'blocked', sides: sides('blocked') },
    { field: LEAD_FILTER_FIELD.optedOut, control: 'boolean', group: 'identity', labelKey: 'optedOut', sides: sides('optedOut') },
    { field: LEAD_FILTER_FIELD.whatsappOptIn, control: 'boolean', group: 'identity', labelKey: 'whatsappOptIn', sides: sides('whatsappOptIn') },

    { field: LEAD_FILTER_FIELD.zip, control: 'idset', group: 'address', labelKey: 'zip', entry: 'zip', readsAddresses: true },
    { field: LEAD_FILTER_FIELD.city, control: 'idset', group: 'address', labelKey: 'city', runtimeOptions: 'cities' },
    { field: LEAD_FILTER_FIELD.district, control: 'idset', group: 'address', labelKey: 'district', runtimeOptions: 'districts' },
    {
        field: LEAD_FILTER_FIELD.state,
        control: 'enum',
        group: 'address',
        labelKey: 'state',
        options: LEAD_STATES.map((value) => ({ value, label: value })),
    },
    { field: LEAD_FILTER_FIELD.hasAddress, control: 'boolean', group: 'address', labelKey: 'hasAddress', sides: sides('hasAddress') },
    {
        field: LEAD_FILTER_FIELD.geoPrecision,
        control: 'enum',
        group: 'address',
        labelKey: 'geoPrecision',
        readsAddresses: true,
        options: PRECISIONS.map((value) => ({ value, labelKey: `leadMap.${precisionLabelKey(value)}` })),
    },
    {
        field: LEAD_FILTER_FIELD.geoStatus,
        control: 'enum',
        group: 'address',
        labelKey: 'geoStatus',
        readsAddresses: true,
        options: translatedOptions(LEAD_GEO_STATUSES, `${OPTIONS_PATH}.geoStatus`),
    },
    {
        field: LEAD_FILTER_FIELD.geoPlacement,
        control: 'enum',
        group: 'address',
        labelKey: 'geoPlacement',
        readsAddresses: true,
        options: translatedOptions(LEAD_GEO_PLACEMENTS, `${OPTIONS_PATH}.geoPlacement`),
    },

    {
        field: LEAD_FILTER_FIELD.relationKind,
        control: 'enum',
        group: 'family',
        labelKey: 'relationKind',
        options: translatedOptions([...LEAD_FAMILY_KINDS, ...LEAD_REFERRAL_KINDS], 'leadSheet.family.kinds'),
    },
    { field: LEAD_FILTER_FIELD.relativesCount, control: 'number', group: 'family', labelKey: 'relativesCount' },
    { field: LEAD_FILTER_FIELD.referredCount, control: 'number', group: 'family', labelKey: 'referredCount' },
    { field: LEAD_FILTER_FIELD.referredBy, control: 'idset', group: 'family', labelKey: 'referredBy', entry: 'lead' },

    {
        field: LEAD_FILTER_FIELD.owner,
        control: 'idset',
        group: 'owner',
        labelKey: 'owner',
        runtimeOptions: 'owners',
        presence: sides('ownerPresence'),
    },

    {
        field: LEAD_FILTER_FIELD.channel,
        control: 'enum',
        group: 'engagement',
        labelKey: 'channel',
        facetKey: 'channels',
        options: translatedOptions(LEAD_CHANNELS, `${OPTIONS_PATH}.channel`),
    },
    { field: LEAD_FILTER_FIELD.windowOpen, control: 'boolean', group: 'engagement', labelKey: 'windowOpen', sides: sides('windowOpen') },
    { field: LEAD_FILTER_FIELD.lastActivityAt, control: 'date', group: 'engagement', labelKey: 'lastActivityAt' },
    { field: LEAD_FILTER_FIELD.createdAt, control: 'date', group: 'engagement', labelKey: 'createdAt' },
    { field: LEAD_FILTER_FIELD.updatedAt, control: 'date', group: 'engagement', labelKey: 'updatedAt' },

    { field: LEAD_FILTER_FIELD.campaign, control: 'idset', group: 'campaigns', labelKey: 'campaign', runtimeOptions: 'campaigns' },
    {
        field: LEAD_FILTER_FIELD.campaignStatus,
        control: 'enum',
        group: 'campaigns',
        labelKey: 'campaignStatus',
        facetKey: 'campaignStatuses',
        options: translatedOptions(LEAD_CAMPAIGN_STATUSES, `${OPTIONS_PATH}.campaignStatus`),
    },
    { field: LEAD_FILTER_FIELD.campaignCount, control: 'number', group: 'campaigns', labelKey: 'campaignCount' },

    { field: LEAD_FILTER_FIELD.stage, control: 'idset', group: 'crm', labelKey: 'stage', runtimeOptions: 'stages' },
    { field: LEAD_FILTER_FIELD.label, control: 'idset', group: 'crm', labelKey: 'label', runtimeOptions: 'labels' },

    {
        field: LEAD_FILTER_FIELD.memoryCategory,
        control: 'enum',
        group: 'memories',
        labelKey: 'memoryCategory',
        facetKey: 'memoryCategories',
        options: translatedOptions(LEAD_MEMORY_CATEGORIES, `${OPTIONS_PATH}.memoryCategory`),
    },
    {
        field: LEAD_FILTER_FIELD.memoryAuthor,
        control: 'enum',
        group: 'memories',
        labelKey: 'memoryAuthor',
        options: translatedOptions(LEAD_MEMORY_AUTHORS, `${OPTIONS_PATH}.memoryAuthor`),
    },
    { field: LEAD_FILTER_FIELD.memoryText, control: 'text', group: 'memories', labelKey: 'memoryText' },
    { field: LEAD_FILTER_FIELD.memoryCount, control: 'number', group: 'memories', labelKey: 'memoryCount' },
    { field: LEAD_FILTER_FIELD.memoryUpdatedAt, control: 'date', group: 'memories', labelKey: 'memoryUpdatedAt' },
];

export const LEAD_FILTER_GROUP_ORDER: LeadFilterGroup[] = [
    'identity',
    'address',
    'family',
    'owner',
    'engagement',
    'campaigns',
    'crm',
    'memories',
    'custom',
];

export const LEAD_ZIP_FILTER_MAX = 200;

export const LEAD_REFERRER_FILTER_MAX = 20;

export interface ZipFilterEntries {
    values: string[];
    invalid: string[];
}

export function zipFilterEntries(text: string): ZipFilterEntries {
    const values: string[] = [];
    const invalid: string[] = [];
    for (const piece of text.split(/[\s,;]+/)) {
        if (!piece) continue;
        const digits = cepDigits(piece);
        if (!digits) invalid.push(piece);
        else if (!values.includes(digits)) values.push(digits);
    }
    return { values, invalid };
}

export function leadFilterFieldSpecs(viewer: { readsAddresses: boolean }): LeadFilterFieldSpec[] {
    return LEAD_FILTER_FIELDS.filter((spec) => !spec.readsAddresses || viewer.readsAddresses);
}

export function leadFilterSpec(
    field: string,
): LeadFilterFieldSpec | undefined {
    return LEAD_FILTER_FIELDS.find((spec) => spec.field === field);
}

export function leadQuickFilterFields(classificationField: string | undefined): string[] {
    return [
        LEAD_FILTER_FIELD.district,
        LEAD_FILTER_FIELD.city,
        ...(classificationField ? [classificationField] : []),
        LEAD_FILTER_FIELD.owner,
    ];
}

const CUSTOM_FIELD_CONTROL: Record<CustomFieldType, LeadFilterControl> = {
    text: 'text',
    number: 'number',
    date: 'date',
    boolean: 'boolean',
    select: 'enum',
    multiselect: 'enum',
};

export function customFieldFilterField(definition: Pick<CustomFieldDefinition, 'key'>): string {
    return keyedFilterField(LEAD_FILTER_FIELD.custom, definition.key);
}

export function customFieldFilterSpecs(definitions: readonly CustomFieldDefinition[]): LeadCustomFilterSpec[] {
    return readableFields(definitions).map((definition) => {
        const spec: LeadCustomFilterSpec = {
            field: customFieldFilterField(definition),
            control: CUSTOM_FIELD_CONTROL[definition.type],
            group: 'custom',
            label: definition.label,
        };
        if (spec.control === 'enum') {
            spec.options = (definition.options ?? []).map((option) => {
                const tone = optionTone(definition, option);
                return tone ? { value: option, label: option, tone } : { value: option, label: option };
            });
        }
        return spec;
    });
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

const CUSTOM_PREDICATE_ORDER = LEAD_FILTER_FIELDS.length;

export function activeLeadPredicates(filter: CrmFilter): CrmFilterPredicate[] {
    const order = new Map<string, number>(
        LEAD_FILTER_FIELDS.map((spec, index) => [spec.field, index]),
    );
    const rank = (predicate: CrmFilterPredicate) =>
        order.get(predicateAddress(predicate)) ?? CUSTOM_PREDICATE_ORDER;
    return [...filterPredicates(filter)].sort((a, b) => rank(a) - rank(b));
}

export {
    countFilterPredicates as countLeadFilters,
    emptyCrmFilter as emptyLeadFilter,
    isEmptyCrmFilter as isEmptyLeadFilter,
    predicateAddress as leadPredicateAddress,
    removeFilterPredicate as removeLeadPredicate,
};
export type { CrmFilter as LeadFilter, CrmFilterPredicate as LeadFilterPredicate };
