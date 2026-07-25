export interface PreChatField {
    name: string;
    label: string;
    type: 'text' | 'email' | 'textarea' | 'select';
    required: boolean;
    options?: string[];
}

export interface SupportInbox {
    id: string;
    workspaceId: string;
    name: string;
    agentId?: string | null;
    enableAgentResponses: boolean;
    greetingMessage?: string;
    widgetColor?: string;
    allowedOrigins: string[];
    preChatFields?: PreChatField[];
    archived: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface SupportInboxListMeta {
    page: number;
    pageSize: number;
    totalPages: number;
    totalItems: number;
}

export interface SupportInboxPayload {
    name: string;
    agentId?: string | null;
    enableAgentResponses: boolean;
    greetingMessage?: string;
    widgetColor?: string;
    allowedOrigins: string[];
    preChatFields?: PreChatField[];
}
