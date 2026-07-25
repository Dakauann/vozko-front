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
    | "branches"
    | "call_recordings"
    | "whatsapp_flows"
    | "members"
    | "assignments"
    | "attendance"
    | "usage"
    | "support_inboxes"
    | "issues"
    | "roles"
    | "workflows"
    | "departments"
    | "dialer"
    | "affiliate"
    | "plans"
    | "short_links"
    | "mcp";

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
    | "transfer"
    | "list_members"
    | "block"
    | "call";

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

export interface AvailablePermission {
    resource: ResourceType;
    actions: ResourceAction[];
    actionDescriptions?: Record<string, string>;
    dependencies?: Record<string, PermissionEntry[]>;
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

export interface CustomRole {
    id: string;
    workspaceId: string;
    name: string;
    description: string;
    permissions: PermissionEntry[];
    createdAt: string;
    updatedAt: string;
}
