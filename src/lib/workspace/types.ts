export type WorkspaceRole = "owner" | "admin" | "member";

export type ResourceType =
    | "agents"
    | "whatsapp_campaigns"
    | "whatsapp_templates"
    | "message_shortcuts"
    | "business_phones"
    | "stages"
    | "stage_groups"
    | "labels"
    | "balance"
    | "conversations"
    | "media"
    | "leads"
    | "analysis"
    | "sip_trunks"
    | "call_queues"
    | "call_history"
    | "branches"
    | "call_recordings"
    | "whatsapp_flows"
    | "members"
    | "assignments"
    | "attendance"
    | "attendance_targets"
    | "reports"
    | "usage"
    | "issues"
    | "roles"
    | "workflows"
    | "departments"
    | "call_session"
    | "affiliate"
    | "plans"
    | "short_links"
    | "instagram_accounts"
    | "facebook_pages"
    | "audience"
    | "telegram_accounts"
    | "unofficial_whatsapp_instances"
    | "unofficial_whatsapp_campaigns"
    | "mcp"
    | "knowledge_bases"
    | "calendar"
    | "ai_chat";

export type ResourceAction =
    | "create"
    | "read"
    | "read_details"
    | "update"
    | "delete"
    | "start"
    | "stop"
    | "assign"
    | "send"
    | "reopen"
    | "view_others"
    | "roulette"
    | "use"
    | "list_members"
    | "block"
    | "call"
    | "transfer";

export interface Workspace {
    id: string;
    ownerId: string;
    name: string;
    isDefault: boolean;
    memberCount?: number;
    ownerName?: string;
    ownerEmail?: string;
    currentUserRole?: WorkspaceRole;
    planName?: string;
    subscriptionStatus?: string;
    createdAt: string;
    updatedAt: string;
}

export interface WorkspaceMember {
    id: string;
    workspaceId: string;
    userId: string;
    role: WorkspaceRole;
    roleId?: string;
    roleName?: string;
    email: string;
    username: string;
    createdAt: string;
    updatedAt: string;
}

export interface WorkspaceInvite {
    id: string;
    workspaceId: string;
    inviterId: string;
    email: string;
    role: WorkspaceRole;
    roleId?: string;
    roleName?: string;
    status: "pending" | "accepted" | "declined" | "expired";
    token?: string;
    permissions?: PermissionEntry[];
    departmentIds?: string[];
    expiresAt: string;
    createdAt: string;
    updatedAt: string;
    workspaceName: string;
    inviterEmail: string;
}

export interface MemberPermission {
    id: string;
    memberId: string;
    resource: ResourceType;
    action: ResourceAction;
    createdAt: string;
}

export type PermissionRiskKind =
    | "spends_balance"
    | "contacts_customers"
    | "manages_access"
    | "changes_billing"
    | "deletes_data"
    | "sensitive_data"
    | "changes_automation"
    | "connects_accounts";

export interface PermissionRisk {
    kind: PermissionRiskKind;
    level: "high" | "medium";
    description: string;
}

export interface AvailablePermission {
    resource: ResourceType;
    actions: ResourceAction[];
    actionDescriptions?: Record<string, string>;
    dependencies?: Record<string, PermissionEntry[]>;
    risks?: Record<string, PermissionRisk[]>;
}

export interface ResourceAssignment {
    id: string;
    workspaceId: string;
    resourceType: ResourceType;
    resourceId: string;
    memberId: string;
    createdAt: string;
    memberEmail: string;
    memberUsername: string;
}

export interface PermissionEntry {
    resource: ResourceType;
    action: ResourceAction;
}

export type ScopeRule = "departments" | "assigned_conversations";

export interface FeatureCapability {
    key: string;
    description: string;
    requires: PermissionEntry[];
    managersOnly: boolean;
    screens: string[];
}

export interface Feature {
    key: string;
    name: string;
    location: string;
    description: string;
    scopes: ScopeRule[];
    capabilities: FeatureCapability[];
}

export interface CustomRole {
    id: string;
    workspaceId: string;
    name: string;
    description: string;
    permissions: PermissionEntry[];
    createdAt: string;
    updatedAt: string;
}
