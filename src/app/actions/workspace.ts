import type {
    AvailablePermission,
    MemberPermission,
    PermissionEntry,
    ResourceAssignment,
    ResourceType,
    Workspace,
    WorkspaceInvite,
    WorkspaceMember,
    WorkspaceRole,
} from "@/lib/workspace/types";
import { REF_COOKIE_NAME } from "@/lib/affiliate/ref-cookie.client";
import {
    clearClientCookie,
    readClientCookie,
    setClientCookie,
} from "@/lib/browser/client-cookie";

import { apiClient } from "@/lib/api/browser-client";

const WORKSPACE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export async function setActiveWorkspaceAction(
    workspaceId: string
): Promise<{ success: boolean }> {
    setClientCookie("workspaceId", workspaceId, WORKSPACE_COOKIE_MAX_AGE_SECONDS);
    return { success: true };
}

export async function listWorkspacesAction(): Promise<{
    workspaces: Workspace[];
    error?: string;
}> {
    const response = await apiClient<
        Workspace[] | { items: Workspace[]; page: number; page_size: number; total_items: number; total_pages: number }
    >("/workspaces", { method: "GET" });

    if (response.error) {
        return { workspaces: [], error: response.error.message };
    }

    const raw = response.data;
    const workspaces = Array.isArray(raw)
        ? raw
        : (raw as { items?: Workspace[] })?.items ?? [];

    return { workspaces };
}

export async function getWorkspaceAction(
    workspaceId: string
): Promise<{ workspace: Workspace | null; error?: string }> {
    const response = await apiClient<Workspace>(`/workspaces/${workspaceId}`, {
        method: "GET",
    });

    if (response.error)
        return { workspace: null, error: response.error.message };
    return { workspace: response.data ?? null };
}

export async function createWorkspaceAction(
    name: string
): Promise<{ workspace: Workspace | null; error?: string }> {
    const referralCode = readClientCookie(REF_COOKIE_NAME)?.trim() || "";
    const body = referralCode ? { name, referralCode } : { name };

    const response = await apiClient<Workspace>("/workspaces", {
        method: "POST",
        body: JSON.stringify(body),
        headers: referralCode ? { "X-Affiliate-Ref": referralCode } : undefined,
    });

    if (response.error)
        return { workspace: null, error: response.error.message };

    if (referralCode && response.data) {
        clearClientCookie(REF_COOKIE_NAME);
    }

    return { workspace: response.data ?? null };
}

export async function updateWorkspaceAction(
    workspaceId: string,
    name: string
): Promise<{ workspace: Workspace | null; error?: string }> {
    const response = await apiClient<Workspace>(`/workspaces/${workspaceId}`, {
        method: "PUT",
        body: JSON.stringify({ name }),
    });

    if (response.error)
        return { workspace: null, error: response.error.message };
    return { workspace: response.data ?? null };
}

export async function inviteMemberAction(
    workspaceId: string,
    email: string,
    role: WorkspaceRole,
    permissions?: PermissionEntry[]
): Promise<{ invite: WorkspaceInvite | null; error?: string }> {
    const body: Record<string, unknown> = { email, role };
    if (permissions && permissions.length > 0) {
        body.permissions = permissions;
    }

    const response = await apiClient<WorkspaceInvite>(
        `/workspaces/${workspaceId}/members/invite`,
        {
            method: "POST",
            body: JSON.stringify(body),
        }
    );

    if (response.error)
        return { invite: null, error: response.error.message };
    return { invite: response.data ?? null };
}

export async function listMyInvitesAction(): Promise<{
    invites: WorkspaceInvite[];
    error?: string;
}> {
    const response = await apiClient<WorkspaceInvite[]>("/workspaces/invites", {
        method: "GET",
    });

    if (response.error)
        return { invites: [], error: response.error.message };
    return { invites: response.data ?? [] };
}

export async function listWorkspaceInvitesAction(
    workspaceId: string
): Promise<{ invites: WorkspaceInvite[]; error?: string }> {
    const response = await apiClient<WorkspaceInvite[]>(
        `/workspaces/${workspaceId}/invites`,
        { method: "GET" }
    );

    if (response.error)
        return { invites: [], error: response.error.message };
    return { invites: response.data ?? [] };
}

export async function acceptInviteAction(
    inviteToken: string
): Promise<{ member: WorkspaceMember | null; error?: string }> {
    const response = await apiClient<WorkspaceMember>("/workspaces/invites/accept", {
        method: "POST",
        body: JSON.stringify({ token: inviteToken }),
    });

    if (response.error)
        return { member: null, error: response.error.message };
    return { member: response.data ?? null };
}

export async function declineInviteAction(
    inviteId: string
): Promise<{ error?: string }> {
    const response = await apiClient<{ message: string }>(
        `/workspaces/invites/${inviteId}/decline`,
        { method: "POST" }
    );

    if (response.error)
        return { error: response.error.message };
    return {};
}

export async function cancelInviteAction(
    workspaceId: string,
    inviteId: string
): Promise<{ error?: string }> {
    const response = await apiClient<{ message: string }>(
        `/workspaces/${workspaceId}/invites/${inviteId}`,
        { method: "DELETE" }
    );

    if (response.error)
        return { error: response.error.message };
    return {};
}

export async function listMembersAction(
    workspaceId: string
): Promise<{ members: WorkspaceMember[]; error?: string }> {
    const response = await apiClient<WorkspaceMember[]>(
        `/workspaces/${workspaceId}/members`,
        { method: "GET" }
    );

    if (response.error)
        return { members: [], error: response.error.message };
    return { members: response.data ?? [] };
}

export interface MemberDepartmentRef {
    id: string;
    name: string;
}

export interface AssignableMember extends WorkspaceMember {
    departments?: MemberDepartmentRef[];
}

export interface AssignableMembersResult {
    members: AssignableMember[];
    page: number;
    pageSize: number;
    totalPages: number;
    totalItems: number;
    error?: string;
}

/**
 * Lists workspace members the caller may assign/transfer a conversation to,
 * scoped server-side by department access, with server-side search +
 * pagination. Each member carries its (visible) departments so the UI can
 * bucket the picker by department.
 */
export async function listAssignableMembersAction(
    workspaceId: string,
    opts?: { search?: string; page?: number; pageSize?: number }
): Promise<AssignableMembersResult> {
    const empty: AssignableMembersResult = {
        members: [],
        page: 1,
        pageSize: 0,
        totalPages: 0,
        totalItems: 0,
    };

    const params = new URLSearchParams();
    const search = opts?.search?.trim();
    if (search) params.set("search", search);
    if (opts?.page) params.set("page", String(opts.page));
    if (opts?.pageSize) params.set("pageSize", String(opts.pageSize));
    const qs = params.toString();
    const path = `/workspaces/${workspaceId}/members/assignable${qs ? `?${qs}` : ""}`;

    const response = await apiClient<{
        data: AssignableMember[];
        meta: {
            page: number;
            pageSize: number;
            totalPages: number;
            totalItems: number;
        };
    }>(path, { method: "GET" });

    if (response.error) return { ...empty, error: response.error.message };

    const payload = response.data;
    return {
        members: payload?.data ?? [],
        page: payload?.meta?.page ?? 1,
        pageSize: payload?.meta?.pageSize ?? 0,
        totalPages: payload?.meta?.totalPages ?? 0,
        totalItems: payload?.meta?.totalItems ?? 0,
    };
}

export async function removeMemberAction(
    workspaceId: string,
    userId: string
): Promise<{ error?: string }> {
    const response = await apiClient<{ message: string }>(
        `/workspaces/${workspaceId}/members/${userId}`,
        { method: "DELETE" }
    );

    if (response.error)
        return { error: response.error.message };
    return {};
}

export async function updateMemberRoleAction(
    workspaceId: string,
    userId: string,
    role: WorkspaceRole
): Promise<{ member: WorkspaceMember | null; error?: string }> {
    const response = await apiClient<WorkspaceMember>(
        `/workspaces/${workspaceId}/members/${userId}/role`,
        {
            method: "PUT",
            body: JSON.stringify({ role }),
        }
    );

    if (response.error)
        return { member: null, error: response.error.message };
    return { member: response.data ?? null };
}

export async function listAvailablePermissionsAction(): Promise<{
    permissions: AvailablePermission[];
    error?: string;
}> {
    const response = await apiClient<AvailablePermission[]>("/workspaces/permissions", {
        method: "GET",
    });

    if (response.error)
        return { permissions: [], error: response.error.message };
    return { permissions: response.data ?? [] };
}

export async function getMemberPermissionsAction(
    workspaceId: string,
    userId: string
): Promise<{ permissions: MemberPermission[]; error?: string }> {
    const response = await apiClient<MemberPermission[]>(
        `/workspaces/${workspaceId}/members/${userId}/permissions`,
        { method: "GET" }
    );

    if (response.error)
        return { permissions: [], error: response.error.message };
    return { permissions: response.data ?? [] };
}

export async function setMemberPermissionsAction(
    workspaceId: string,
    userId: string,
    permissions: PermissionEntry[]
): Promise<{ permissions: MemberPermission[]; error?: string }> {
    const response = await apiClient<MemberPermission[]>(
        `/workspaces/${workspaceId}/members/${userId}/permissions`,
        {
            method: "PUT",
            body: JSON.stringify({ permissions }),
        }
    );

    if (response.error)
        return { permissions: [], error: response.error.message };
    return { permissions: response.data ?? [] };
}

export async function assignResourceAction(
    workspaceId: string,
    resourceType: ResourceType,
    resourceId: string,
    memberUserId: string
): Promise<{ assignment: ResourceAssignment | null; error?: string }> {
    const response = await apiClient<ResourceAssignment>(
        `/workspaces/${workspaceId}/assignments`,
        {
            method: "POST",
            body: JSON.stringify({ resourceType, resourceId, memberUserId }),
        }
    );

    if (response.error)
        return { assignment: null, error: response.error.message };
    return { assignment: response.data ?? null };
}

export async function unassignResourceAction(
    workspaceId: string,
    resourceType: ResourceType,
    resourceId: string,
    userId: string
): Promise<{ error?: string }> {
    const response = await apiClient<{ message: string }>(
        `/workspaces/${workspaceId}/assignments/${resourceType}/${resourceId}/members/${userId}`,
        { method: "DELETE" }
    );

    if (response.error)
        return { error: response.error.message };
    return {};
}

export async function listResourceAssignmentsAction(
    workspaceId: string,
    resourceType: ResourceType,
    resourceId: string
): Promise<{ assignments: ResourceAssignment[]; error?: string }> {
    const response = await apiClient<ResourceAssignment[]>(
        `/workspaces/${workspaceId}/assignments/${resourceType}/${resourceId}`,
        { method: "GET" }
    );

    if (response.error)
        return { assignments: [], error: response.error.message };
    return { assignments: response.data ?? [] };
}

export async function adminListAllWorkspacesAction(params: {
    search?: string;
    memberEmail?: string;
    page?: number;
    pageSize?: number;
}): Promise<{
    workspaces: Workspace[];
    meta: { page: number; pageSize: number; totalPages: number; totalItems: number };
    error?: string;
}> {
    const defaultMeta = { page: 1, pageSize: 10, totalPages: 1, totalItems: 0 };

    const queryParams = new URLSearchParams();
    if (params.search) queryParams.set("search", params.search);
    if (params.memberEmail) queryParams.set("member_email", params.memberEmail);
    if (params.page) queryParams.set("page", String(params.page));
    if (params.pageSize) queryParams.set("pageSize", String(params.pageSize));

    const qs = queryParams.toString();
    const url = `/workspaces${qs ? `?${qs}` : ""}`;

    const response = await apiClient<{
        items: Workspace[];
        page: number;
        page_size: number;
        total_items: number;
        total_pages: number;
    }>(url, { method: "GET" });

    if (response.error)
        return { workspaces: [], meta: defaultMeta, error: response.error.message };

    const data = response.data;
    return {
        workspaces: data?.items ?? [],
        meta: {
            page: data?.page ?? 1,
            pageSize: data?.page_size ?? 10,
            totalPages: data?.total_pages ?? 1,
            totalItems: data?.total_items ?? 0,
        },
    };
}

export async function adminListWorkspaceMembersAction(params: {
    workspaceId: string;
    page?: number;
    pageSize?: number;
}): Promise<{
    members: WorkspaceMember[];
    meta: { page: number; pageSize: number; total: number };
    error?: string;
}> {
    const defaultMeta = { page: 1, pageSize: 10, total: 0 };

    const queryParams = new URLSearchParams();
    if (params.page) queryParams.set("page", String(params.page));
    if (params.pageSize) queryParams.set("pageSize", String(params.pageSize));

    const qs = queryParams.toString();
    const url = `/admin/workspaces/${params.workspaceId}/members-paginated${qs ? `?${qs}` : ""}`;

    const response = await apiClient<{
        items: WorkspaceMember[];
        total: number;
        page: number;
        pageSize: number;
    }>(url, { method: "GET" });

    if (response.error)
        return { members: [], meta: defaultMeta, error: response.error.message };

    const data = response.data;
    return {
        members: data?.items ?? [],
        meta: {
            page: data?.page ?? 1,
            pageSize: data?.pageSize ?? 10,
            total: data?.total ?? 0,
        },
    };
}
