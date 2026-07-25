
export type AgentMCPAuthMode = "none" | "api_key" | "oauth2";

export type AgentMCPBindingStatus =
    | "pending"
    | "connected"
    | "disconnected"
    | "revoked"
    | "error";

export type AgentMCPTransport = "streamable-http";

export interface AgentMCPCatalogEntry {
    key: string;
    displayName: string;
    description: string;
    authMode: AgentMCPAuthMode;
    scopes?: string[];
}

export interface AgentMCPBuiltinBinding {
    id: string;
    workspaceId: string;
    serverKey: string;
    displayName: string;
    label: string;
    status: AgentMCPBindingStatus;
}

export interface AgentMCPRemoteServer {
    id: string;
    workspaceId: string;
    name: string;
    url: string;
    transport: AgentMCPTransport | string;
    status: AgentMCPBindingStatus;
    authMode?: AgentMCPAuthMode;
}

export interface RegisterRemoteInput {
    name: string;
    url: string;
    authMode: AgentMCPAuthMode;
    apiKey?: string;
}

export interface StartOAuthOutput {
    authorizeUrl: string;
    state: string;
}


export type AgentMCPCollectionMemberKind = "builtin" | "remote";

export interface AgentMCPCollectionMember {
    kind: AgentMCPCollectionMemberKind;
    refId: string;
}

export interface AgentMCPCollection {
    id: string;
    workspaceId: string;
    name: string;
    description: string;
    members: AgentMCPCollectionMember[];
    createdAt: string;
    updatedAt: string;
}

export interface CollectionInput {
    name: string;
    description?: string;
    members: AgentMCPCollectionMember[];
}
