// Client-safe types for workspace-defined custom fields (opportunities today,
// leads/conversations later). Mirrors domain/customfield.Definition. Fetch calls
// live in app/actions/custom-fields.ts.

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
    objectType: string; // "opportunity" | "conversation" | "lead"
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
