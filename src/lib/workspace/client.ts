"use client";

import { apiClient } from "@/lib/api/browser-client";
import type {
    AvailablePermission,
    CustomRole,
    Feature,
    MemberPermission,
    PermissionEntry,
    PermissionRisk,
    ResourceAction,
    RolePreset,
    ResourceAssignment,
    ResourceType,
    ScopeRule,
    Workspace,
    WorkspaceInvite,
    WorkspaceMember,
    WorkspaceRole,
} from "@/lib/workspace/types";


export async function fetchWorkspaces(opts?: {
    search?: string;
    memberEmail?: string;
    page?: number;
    pageSize?: number;
}): Promise<{
    workspaces: Workspace[];
    page?: number;
    pageSize?: number;
    totalItems?: number;
    totalPages?: number;
    error?: string;
}> {
    const params = new URLSearchParams();
    if (opts?.search) params.set("search", opts.search);
    if (opts?.memberEmail) params.set("member_email", opts.memberEmail);
    if (opts?.page) params.set("page", String(opts.page));
    if (opts?.pageSize) params.set("pageSize", String(opts.pageSize));
    const qs = params.toString();
    const endpoint = `/workspaces${qs ? `?${qs}` : ""}`;

    const { data, error } = await apiClient<
        | Workspace[]
        | {
              items?: Workspace[];
              page?: number;
              page_size?: number;
              total_items?: number;
              total_pages?: number;
          }
    >(endpoint, { method: "GET" });

    if (error) {
        return { workspaces: [], error: error.message || "Failed to fetch workspaces" };
    }

    if (Array.isArray(data)) {
        return { workspaces: data };
    }

    const paginated = data ?? {};
    return {
        workspaces: paginated.items ?? [],
        page: paginated.page ?? 1,
        pageSize: paginated.page_size ?? 20,
        totalItems: paginated.total_items ?? 0,
        totalPages: paginated.total_pages ?? 1,
    };
}


export async function fetchWorkspace(workspaceId: string): Promise<{
    workspace: Workspace | null;
    error?: string;
}> {
    const { data, error } = await apiClient<Workspace>(`/workspaces/${workspaceId}`, {
        method: "GET",
    });

    if (error) {
        return { workspace: null, error: error.message || "Failed to fetch workspace" };
    }

    return { workspace: data ?? null };
}


export async function createWorkspace(name: string): Promise<{
    workspace: Workspace | null;
    error?: string;
}> {
    const { data, error } = await apiClient<Workspace>("/workspaces", {
        method: "POST",
        body: JSON.stringify({ name }),
    });

    if (error) {
        return { workspace: null, error: error.message || "Failed to create workspace" };
    }

    return { workspace: data ?? null };
}


export async function updateWorkspace(
    workspaceId: string,
    options: { name?: string },
): Promise<{
    workspace: Workspace | null;
    error?: string;
}> {
    const { data, error } = await apiClient<Workspace>(`/workspaces/${workspaceId}`, {
        method: "PUT",
        body: JSON.stringify({ name: options.name }),
    });

    if (error) {
        return { workspace: null, error: error.message || "Failed to update workspace" };
    }

    return { workspace: data ?? null };
}


export async function fetchMembers(workspaceId: string): Promise<{
    members: WorkspaceMember[];
    error?: string;
}> {
    const { data, error } = await apiClient<WorkspaceMember[]>(
        `/workspaces/${workspaceId}/members`,
        { method: "GET" },
    );

    if (error) {
        return { members: [], error: error.message || "Failed to fetch members" };
    }

    return { members: data ?? [] };
}


export async function removeMember(workspaceId: string, userId: string): Promise<{
    error?: string;
}> {
    const { error } = await apiClient<{ message: string }>(
        `/workspaces/${workspaceId}/members/${userId}`,
        { method: "DELETE" },
    );

    if (error) {
        return { error: error.message || "Failed to remove member" };
    }

    return {};
}


export async function updateMemberRole(
    workspaceId: string,
    userId: string,
    role: WorkspaceRole
): Promise<{
    member: WorkspaceMember | null;
    error?: string;
}> {
    const { data, error } = await apiClient<WorkspaceMember>(
        `/workspaces/${workspaceId}/members/${userId}/role`,
        {
            method: "PUT",
            body: JSON.stringify({ role }),
        },
    );

    if (error) {
        return { member: null, error: error.message || "Failed to update member role" };
    }

    return { member: data ?? null };
}


export async function inviteMember(
    workspaceId: string,
    email: string,
    role?: WorkspaceRole,
    roleId?: string,
    departmentIds?: string[],
): Promise<{
    invite: WorkspaceInvite | null;
    error?: string;
}> {
    void departmentIds;
    const body: Record<string, unknown> = { email };
    if (role) body.role = role;
    if (roleId) body.roleId = roleId;

    const { data, error } = await apiClient<WorkspaceInvite>(
        `/workspaces/${workspaceId}/members/invite`,
        {
            method: "POST",
            body: JSON.stringify(body),
        },
    );

    if (error) {
        return { invite: null, error: error.message || "Failed to invite member" };
    }

    return { invite: data ?? null };
}


export async function fetchWorkspaceInvites(workspaceId: string): Promise<{
    invites: WorkspaceInvite[];
    error?: string;
}> {
    const { data, error } = await apiClient<WorkspaceInvite[]>(
        `/workspaces/${workspaceId}/invites`,
        { method: "GET" },
    );

    if (error) {
        return { invites: [], error: error.message || "Failed to fetch invites" };
    }

    return { invites: data ?? [] };
}


export async function fetchMyInvites(): Promise<{
    invites: WorkspaceInvite[];
    error?: string;
}> {
    const { data, error } = await apiClient<WorkspaceInvite[]>("/workspaces/invites", {
        method: "GET",
    });

    if (error) {
        return { invites: [], error: error.message || "Failed to fetch invites" };
    }

    return { invites: data ?? [] };
}


export async function acceptInvite(inviteToken: string): Promise<{
    member: WorkspaceMember | null;
    error?: string;
}> {
    const { data, error } = await apiClient<WorkspaceMember>("/workspaces/invites/accept", {
        method: "POST",
        body: JSON.stringify({ token: inviteToken }),
    });

    if (error) {
        return { member: null, error: error.message || "Failed to accept invite" };
    }

    return { member: data ?? null };
}


export async function declineInvite(inviteId: string): Promise<{
    error?: string;
}> {
    const { error } = await apiClient<{ message: string }>(
        `/workspaces/invites/${inviteId}/decline`,
        { method: "POST" },
    );

    if (error) {
        return { error: error.message || "Failed to decline invite" };
    }

    return {};
}


export async function cancelInvite(
    workspaceId: string,
    inviteId: string
): Promise<{
    error?: string;
}> {
    const { error } = await apiClient<{ message: string }>(
        `/workspaces/${workspaceId}/invites/${inviteId}`,
        { method: "DELETE" },
    );

    if (error) {
        return { error: error.message || "Failed to cancel invite" };
    }

    return {};
}


export async function fetchMemberPermissions(
    workspaceId: string,
    userId: string
): Promise<{
    permissions: MemberPermission[];
    error?: string;
}> {
    const { data, error } = await apiClient<MemberPermission[]>(
        `/workspaces/${workspaceId}/members/${userId}/permissions`,
        { method: "GET" },
    );

    if (error) {
        return { permissions: [], error: error.message || "Failed to fetch permissions" };
    }

    return { permissions: data ?? [] };
}


export async function setMemberPermissions(
    workspaceId: string,
    userId: string,
    permissions: PermissionEntry[]
): Promise<{
    permissions: MemberPermission[];
    error?: string;
}> {
    const { data, error } = await apiClient<MemberPermission[]>(
        `/workspaces/${workspaceId}/members/${userId}/permissions`,
        {
            method: "PUT",
            body: JSON.stringify({ permissions }),
        },
    );

    if (error) {
        return { permissions: [], error: error.message || "Failed to set permissions" };
    }

    return { permissions: data ?? [] };
}


export async function fetchAvailablePermissions(): Promise<{
    permissions: AvailablePermission[];
    features: Feature[];
    rolePresets: RolePreset[];
    error?: string;
}> {
    const { data, error } = await apiClient<{
        permissions?: Array<{
            resource: string;
            actions?: string[];
            actionDescriptions?: Record<string, string>;
            dependencies?: Record<string, Array<{ resource: string; action: string }>>;
            risks?: Record<string, PermissionRisk[]>;
        }>;
        features?: Array<{
            key: string;
            name: string;
            location: string;
            description: string;
            scopes?: ScopeRule[];
            capabilities?: Array<{
                key: string;
                description: string;
                requires?: PermissionEntry[];
                managersOnly?: boolean;
                screens?: string[];
            }>;
        }>;
        rolePresets?: Array<{
            key: string;
            name?: string;
            description?: string;
            highlights?: string[];
            capabilities?: string[];
            permissions?: PermissionEntry[];
        }>;
    }>("/workspaces/permissions", { method: "GET" });

    if (error) {
        return { permissions: [], features: [], rolePresets: [], error: error.message || "Failed to fetch permissions" };
    }

    const items = data?.permissions ?? [];
    const permissions: AvailablePermission[] = items.map((item) => ({
        resource: item.resource as AvailablePermission["resource"],
        actions: (item.actions ?? []) as ResourceAction[],
        ...(item.actionDescriptions && Object.keys(item.actionDescriptions).length > 0 && {
            actionDescriptions: item.actionDescriptions,
        }),
        ...(item.dependencies && Object.keys(item.dependencies).length > 0 && {
            dependencies: item.dependencies as AvailablePermission["dependencies"],
        }),
        ...(item.risks && Object.keys(item.risks).length > 0 && { risks: item.risks }),
    }));

    const features: Feature[] = (data?.features ?? []).map((feature) => ({
        key: feature.key,
        name: feature.name,
        location: feature.location,
        description: feature.description,
        scopes: feature.scopes ?? [],
        capabilities: (feature.capabilities ?? []).map((capability) => ({
            key: capability.key,
            description: capability.description,
            requires: capability.requires ?? [],
            managersOnly: capability.managersOnly ?? false,
            screens: capability.screens ?? [],
        })),
    }));

    const rolePresets: RolePreset[] = (data?.rolePresets ?? []).map((preset) => ({
        key: preset.key,
        name: preset.name ?? preset.key,
        description: preset.description ?? "",
        highlights: preset.highlights ?? [],
        capabilities: preset.capabilities ?? [],
        permissions: preset.permissions ?? [],
    }));

    return { permissions, features, rolePresets };
}


export async function assignResource(
    workspaceId: string,
    resourceType: ResourceType,
    resourceId: string,
    memberUserId: string
): Promise<{
    assignment: ResourceAssignment | null;
    error?: string;
}> {
    const { data, error } = await apiClient<ResourceAssignment>(
        `/workspaces/${workspaceId}/assignments`,
        {
            method: "POST",
            body: JSON.stringify({ resourceType, resourceId, memberUserId }),
        },
    );

    if (error) {
        return { assignment: null, error: error.message || "Failed to assign resource" };
    }

    return { assignment: data ?? null };
}


export async function unassignResource(
    workspaceId: string,
    resourceType: ResourceType,
    resourceId: string,
    userId: string
): Promise<{
    error?: string;
}> {
    const { error } = await apiClient<{ message: string }>(
        `/workspaces/${workspaceId}/assignments/${resourceType}/${resourceId}/members/${userId}`,
        { method: "DELETE" },
    );

    if (error) {
        return { error: error.message || "Failed to unassign resource" };
    }

    return {};
}


export async function fetchResourceAssignments(
    workspaceId: string,
    resourceType: ResourceType,
    resourceId: string
): Promise<{
    assignments: ResourceAssignment[];
    error?: string;
}> {
    const { data, error } = await apiClient<ResourceAssignment[]>(
        `/workspaces/${workspaceId}/assignments/${resourceType}/${resourceId}`,
        { method: "GET" },
    );

    if (error) {
        return { assignments: [], error: error.message || "Failed to fetch assignments" };
    }

    return { assignments: data ?? [] };
}


export async function fetchCustomRoles(workspaceId: string): Promise<{
    roles: CustomRole[];
    error?: string;
}> {
    const { data, error } = await apiClient<{ roles?: Array<Omit<CustomRole, "linked"> & { linked?: boolean }> }>(
        `/workspaces/${workspaceId}/roles`,
        { method: "GET" },
    );

    if (error) {
        return { roles: [], error: error.message || "Failed to fetch roles" };
    }

    return { roles: (data?.roles ?? []).map(normalizeRole) };
}

function normalizeRole(role: Omit<CustomRole, "linked"> & { linked?: boolean }): CustomRole {
    return { ...role, permissions: role.permissions ?? [], linked: role.linked ?? false };
}

export async function createCustomRole(
    workspaceId: string,
    input: {
        name: string;
        description?: string;
        permissions: PermissionEntry[];
        presetKey?: string;
        linked?: boolean;
    }
): Promise<{
    role: CustomRole | null;
    error?: string;
    code?: string;
}> {
    const { data, error } = await apiClient<Omit<CustomRole, "linked"> & { linked?: boolean }>(`/workspaces/${workspaceId}/roles`, {
        method: "POST",
        body: JSON.stringify({
            name: input.name,
            description: input.description,
            permissions: input.permissions,
            presetKey: input.presetKey,
            linked: input.linked,
        }),
    });

    if (error) {
        return { role: null, error: error.message || "Failed to create role", code: error.code };
    }

    return { role: data ? normalizeRole(data) : null };
}

export async function updateCustomRole(
    workspaceId: string,
    roleId: string,
    updates: { name?: string; description?: string; permissions?: PermissionEntry[]; linked?: boolean }
): Promise<{
    role: CustomRole | null;
    error?: string;
    code?: string;
}> {
    const { data, error } = await apiClient<Omit<CustomRole, "linked"> & { linked?: boolean }>(
        `/workspaces/${workspaceId}/roles/${roleId}`,
        {
            method: "PUT",
            body: JSON.stringify({
                name: updates.name,
                description: updates.description,
                permissions: updates.permissions,
                linked: updates.linked,
            }),
        },
    );

    if (error) {
        return { role: null, error: error.message || "Failed to update role", code: error.code };
    }

    return { role: data ? normalizeRole(data) : null };
}

export async function deleteCustomRole(
    workspaceId: string,
    roleId: string
): Promise<{
    error?: string;
}> {
    const { error } = await apiClient<{ message: string }>(
        `/workspaces/${workspaceId}/roles/${roleId}`,
        { method: "DELETE" },
    );

    if (error) {
        return { error: error.message || "Failed to delete role" };
    }

    return {};
}

export async function assignCustomRole(
    workspaceId: string,
    userId: string,
    roleId: string
): Promise<{
    member: WorkspaceMember | null;
    error?: string;
}> {
    const { data, error } = await apiClient<WorkspaceMember>(
        `/workspaces/${workspaceId}/members/${userId}/assign-role`,
        {
            method: "PUT",
            body: JSON.stringify({ roleId }),
        },
    );

    if (error) {
        return { member: null, error: error.message || "Failed to assign role" };
    }

    return { member: data ?? null };
}
