export interface AgentToolBindings {
    [tool: string]: string;
}

export interface AgentMetadata {
    [key: string]: unknown;
}

export interface RAGConfig {
    maxCharacters?: number;
    maxChunks?: number;
    minScore?: number;
    numCandidates?: number;
    contextWindow?: number;
    maxChunksPerDoc?: number;
}

export interface AgentVariable {
    name: string;
    description?: string;
    defaultValue?: string;
}

export interface AgentVariableInfo {
    name: string;
    description?: string;
    defaultValue?: string;
    required: boolean;
    usedIn: {
        messagingPrompt: boolean;
        initialMessage: boolean;
    };
}

export interface Agent {
    id: string;
    name: string;
    description: string;
    initialMessage: string;
    useInitialMessage: boolean;
    messagingPrompt: string;
    messagingModel: string;
    avatarUrl: string;
    tags: string[];
    metadata: AgentMetadata;
    internalTools: ToolBinding[];
    toolBindings: AgentToolBindings;
    provider: string;
    externalId: string;
    isActive: boolean;
    archived: boolean;
    ragEnabled: boolean;
    ragConfig?: RAGConfig;
    whatsappTemplateId?: string;
    businessPhoneId?: string;
    departmentId?: string | null;
    createdAt: string;
    updatedAt: string;
    mediaIds: string[];
    mcpCollectionIds: string[];
    variables: AgentVariable[];
}

export interface AgentToolParameter {
    type: string;
    description: string;
    displayName: string;
    displayDescription: string;
    required?: boolean;
    example?: string;
}

export type ToolVisibility = "messaging" | "post_conversation";
export type AgentToolCategory = "agent_utility" | "messaging" | "agent_action" | "payment"

export interface ToolConfigSchemaField {
    type: "string" | "number" | "boolean" | "object" | "array";
    description: string;
    displayName?: string;
    displayDescription?: string;
    defaultValue?: unknown;
    options?: Array<{ value: string; label: string }>;
    required: boolean;
}

export interface AgentToolDefinition {
    name: string;
    displayName: string;
    description: string;
    displayDescription: string;
    parameters: Record<string, AgentToolParameter>;
    required: string[] | null;
    visibility: ToolVisibility[];
    category: AgentToolCategory;
    requiresConfig: boolean;
    requiredConfig?: string[];
    configSchema?: Record<string, ToolConfigSchemaField>;
}

export type AgentToolsResponse = AgentToolDefinition[];

export interface ToolConfig {
    [key: string]: unknown;
}

export interface ToolBinding {
    name: string;
    visibility?: ToolVisibility[];
    config?: ToolConfig;
}

export interface CreateAgentPayload {
    name: string;
    initialMessage?: string;
    useInitialMessage?: boolean;
    messagingPrompt?: string;
    description?: string;
    messagingModel: string;
    provider: string;
    internalTools: ToolBinding[];
    tags?: string[];
    metadata?: Record<string, string>;
    isActive?: boolean;
    avatarUrl?: string;
    whatsappTemplateId?: string;
    businessPhoneId?: string;
    mediaIds?: string[];
    mcpCollectionIds?: string[];
    ragEnabled?: boolean;
    ragConfig?: RAGConfig;
    variables?: AgentVariable[];
}

export interface UpdateAgentPayload extends CreateAgentPayload {
    isActive: boolean;
}

export interface ModelPricingInfo {
    id: string;
    name: string;
    promptPrice: number;
    completionPrice: number;
    /** OpenRouter model creation time (Unix seconds). Powers the "New" badge. */
    created?: number;
    /** Maximum context window in tokens. */
    contextLength?: number;
}

export interface AgentOptions {
    providers: { id: string; name: string }[];
    messaging: string[];
    defaults: {
        messagingModel: string;
    };
    modelPricing?: ModelPricingInfo[];
}

export interface AgentListMeta {
    page: number;
    pageSize: number;
    totalPages: number;
    totalItems: number;
}

export interface AgentListItem {
    id: string;
    workspaceId: string;
    departmentId?: string | null;
    name: string;
    avatarUrl: string;
    tags: string[];
    provider: string;
    messagingModel: string;
    isActive: boolean;
    archived: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface AgentListParams {
    page?: number;
    pageSize?: number;
    search?: string;
    sort?: string;
}

export interface AgentListResponse {
    data?: AgentListItem[];
    agents?: AgentListItem[];
    items?: AgentListItem[];
    meta?: AgentListMeta;
}
