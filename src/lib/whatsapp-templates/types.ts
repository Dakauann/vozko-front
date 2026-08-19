export type TemplateStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAUSED' | 'DISABLED';
export type TemplateCategory = 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
export type ComponentType = 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS' | 'CALL_PERMISSION_REQUEST';
export type HeaderFormat = 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'LOCATION' | 'GIF';
export type ButtonType = 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER' | 'COPY_CODE';
export type ParameterFormat = 'positional' | 'named';
export type UsabilityStatus = 'ready' | 'missing_header_media' | 'not_approved';

export interface TemplateButton {
    type: ButtonType;
    text: string;
    url?: string;
    phone_number?: string;
    example?: string | string[];
}

export interface TemplateComponentExample {
    body_text?: string[][];
    body_text_named_params?: Array<{ param_name: string; example: string }>;
    header_text?: string[];
    header_text_named_params?: Array<{ param_name: string; example: string }>;
    header_handle?: string[];
}

export interface TemplateComponent {
    type: ComponentType;
    format?: HeaderFormat;
    text?: string;
    parameters?: string[];
    buttons?: TemplateButton[];
    example?: TemplateComponentExample;
}

export interface WhatsAppTemplate {
    id: string;
    externalId: string;
    wabaId?: string;
    /** Business/WABA name, joined server-side so the client renders it inline. */
    wabaName?: string;
    name: string;
    language: string;
    category: TemplateCategory;
    status: TemplateStatus;
    rejectedReason?: string;
    parameterFormat?: ParameterFormat;
    components: TemplateComponent[];
    headerMediaUrl?: string | null;
    headerMediaId?: string | null;
    usabilityStatus?: UsabilityStatus;
    usabilityMessage?: string;
    createdAt: string;
    updatedAt: string;
}

export interface TemplateListMeta {
    page: number;
    pageSize: number;
    totalPages: number;
    totalItems: number;
}

export interface TemplateAccess {
    id: string;
    workspaceId: string;
    templateId: string;
    grantedBy: string;
    createdAt: string;
    workspace?: {
        id: string;
        name: string;
    };
    grantor?: {
        id: string;
        name: string;
        email: string;
    };
}

export interface TemplateAccessMeta {
    page: number;
    pageSize: number;
    totalPages: number;
    totalItems: number;
}

export interface TemplateAccessListPayload {
    items: TemplateAccess[];
    page?: number;
    pageSize?: number;
    totalPages?: number;
    totalItems?: number;
    page_size?: number;
    total_pages?: number;
    total_items?: number;
    page_number?: number;
}

export interface TemplateListResponse {
    data?: WhatsAppTemplate[];
    items?: WhatsAppTemplate[];
    templates?: WhatsAppTemplate[];
    meta?: TemplateListMeta;
}

export interface TemplateAccessListResponse {
    data?: TemplateAccessListPayload;
    items?: TemplateAccess[];
    meta?: TemplateAccessMeta;
}

export interface CreateTemplatePayload {
    businessPhoneId: string;
    name: string;
    language?: string;
    category: TemplateCategory;
    parameterFormat?: ParameterFormat;
    components: TemplateComponent[];
    headerMediaUrl?: string;
}

export interface UpdateHeaderMediaPayload {
    headerMediaUrl: string | null;
}


export interface TemplateListParams {
    wabaId?: string;
    businessPhoneId?: string;
    status?: TemplateStatus;
    category?: TemplateCategory;
    language?: string;
    search?: string;
    page?: number;
    pageSize?: number;
}
