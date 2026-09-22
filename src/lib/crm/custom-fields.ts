
export type CustomFieldType =
    | 'text'
    | 'number'
    | 'date'
    | 'boolean'
    | 'select'
    | 'multiselect';

export interface CustomFieldDefinition {
    id: string;
    workspaceId: string;
    objectType: string;
    key: string;
    label: string;
    type: CustomFieldType;
    options?: string[];
    required: boolean;
    position: number;
    createdAt: string;
    updatedAt: string;
}

export interface CustomFieldInput {
    objectType: string;
    key: string;
    label: string;
    type: CustomFieldType;
    options?: string[];
    required?: boolean;
    position?: number;
}

export function customFieldTypeHasOptions(type: CustomFieldType): boolean {
    return type === 'select' || type === 'multiselect';
}
