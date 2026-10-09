import { TONE_KEYS, isToneKey, type ToneKey } from '@/lib/tones/tones';

export type CustomFieldType =
    | 'text'
    | 'number'
    | 'date'
    | 'boolean'
    | 'select'
    | 'multiselect';

export type CustomFieldObjectType = 'opportunity' | 'lead';

export type CustomFieldTone = ToneKey;

export const CUSTOM_FIELD_TONES = TONE_KEYS;

export type CustomFieldRole = 'classification';

export interface CustomFieldDefinition {
    id: string;
    workspaceId: string;
    objectType: CustomFieldObjectType;
    key: string;
    label: string;
    type: CustomFieldType;
    options?: string[];
    optionTones?: Record<string, CustomFieldTone>;
    required: boolean;
    sensitive: boolean;
    legalBasis?: string;
    role?: CustomFieldRole;
    position: number;
    readable?: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface CustomFieldInput {
    objectType: CustomFieldObjectType;
    key: string;
    label: string;
    type: CustomFieldType;
    options?: string[];
    optionTones?: Record<string, CustomFieldTone>;
    required?: boolean;
    sensitive?: boolean;
    legalBasis?: string;
    role?: CustomFieldRole | '';
    position?: number;
}

export function customFieldTypeHasOptions(type: CustomFieldType): boolean {
    return type === 'select' || type === 'multiselect';
}

export function customFieldKey(label: string): string {
    return label
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
}

export function optionTone(field: CustomFieldDefinition, option: string): CustomFieldTone | undefined {
    const tone = field.optionTones?.[option];
    return isToneKey(tone) ? tone : undefined;
}

export function classificationField(fields: readonly CustomFieldDefinition[]): CustomFieldDefinition | undefined {
    return fields.find((field) => field.role === 'classification');
}

export function readableFields(fields: readonly CustomFieldDefinition[]): CustomFieldDefinition[] {
    return fields.filter((field) => field.readable === true);
}

export function readableClassificationField(fields: readonly CustomFieldDefinition[]): CustomFieldDefinition | undefined {
    const field = classificationField(fields);
    return field?.readable === true ? field : undefined;
}

export function isFilledValue(value: unknown): boolean {
    if (value === undefined || value === null) return false;
    if (typeof value === 'string') return value.trim() !== '';
    return !(Array.isArray(value) && value.length === 0);
}

export function toggleChoice(current: unknown, option: string, options: readonly string[]): string[] {
    const chosen = new Set(Array.isArray(current) ? current.filter((v): v is string => typeof v === 'string') : []);
    if (chosen.has(option)) chosen.delete(option);
    else chosen.add(option);
    return options.filter((candidate) => chosen.has(candidate));
}

export const CLASSIFICATION_PRESET_TONES = {
    positive: 'chart-2',
    negative: 'chart-5',
    toWin: 'chart-3',
    notInformed: 'neutral',
} as const satisfies Record<string, CustomFieldTone>;

export interface ClassificationPresetCopy {
    label: string;
    options: Record<keyof typeof CLASSIFICATION_PRESET_TONES, string>;
}

export function classificationPreset(copy: ClassificationPresetCopy): CustomFieldInput {
    const order = ['positive', 'negative', 'toWin', 'notInformed'] as const;
    const options = order.map((key) => copy.options[key]);
    const optionTones = Object.fromEntries(
        order.map((key) => [copy.options[key], CLASSIFICATION_PRESET_TONES[key]]),
    ) as Record<string, CustomFieldTone>;
    return {
        objectType: 'lead',
        key: customFieldKey(copy.label),
        label: copy.label,
        type: 'select',
        options,
        optionTones,
        required: false,
        sensitive: true,
        legalBasis: '',
        role: 'classification',
    };
}
