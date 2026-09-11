
import { apiClient } from "@/lib/api/browser-client";
import type { Department, DepartmentMember } from "@/lib/department/types";
import type { WorkingHoursSpec } from "@/lib/working-hours/types";


export async function fetchDepartments(): Promise<{
    departments: Department[];
    error?: string;
}> {
    const res = await apiClient<Department[]>("/departments", { method: "GET" });
    if (res.error) {
        return { departments: [], error: res.error.message || "Failed to fetch departments" };
    }
    return { departments: res.data ?? [] };
}


export async function createDepartment(
    name: string,
    description?: string,
): Promise<{ department: Department | null; error?: string }> {
    const res = await apiClient<Department>("/departments", {
        method: "POST",
        body: JSON.stringify({ name, description }),
    });
    if (res.error) {
        return { department: null, error: res.error.message || "Failed to create department" };
    }
    return { department: res.data ?? null };
}


/**
 * `workingHours` tem três estados e os três chegam ao servidor:
 * não passar deixa a escala como está, `null` remove a escala própria (o
 * departamento volta a herdar a do workspace) e um documento substitui.
 * Por isso ele só entra no corpo quando o chamador realmente passou algo.
 */
export async function updateDepartment(
    id: string,
    name: string,
    description?: string,
    workingHours?: WorkingHoursSpec | null,
): Promise<{ department: Department | null; error?: string }> {
    const body: Record<string, unknown> = { name, description };
    if (workingHours !== undefined) {
        body.workingHours = workingHours;
    }
    const res = await apiClient<Department>(`/departments/${id}`, {
        method: "PUT",
        body: JSON.stringify(body),
    });
    if (res.error) {
        return { department: null, error: res.error.message || "Failed to update department" };
    }
    return { department: res.data ?? null };
}


export async function deleteDepartment(
    id: string,
): Promise<{ error?: string }> {
    const res = await apiClient<{ deleted: boolean }>(`/departments/${id}`, {
        method: "DELETE",
    });
    if (res.error) {
        return { error: res.error.message || "Failed to delete department" };
    }
    return {};
}


export async function fetchDepartmentMembers(
    departmentId: string,
): Promise<{ members: DepartmentMember[]; error?: string }> {
    const res = await apiClient<DepartmentMember[]>(`/departments/${departmentId}/members`, {
        method: "GET",
    });
    if (res.error) {
        return { members: [], error: res.error.message || "Failed to fetch members" };
    }
    return { members: res.data ?? [] };
}


export async function addDepartmentMember(
    departmentId: string,
    memberId: string,
): Promise<{ member: DepartmentMember | null; error?: string }> {
    const res = await apiClient<DepartmentMember>(`/departments/${departmentId}/members`, {
        method: "POST",
        body: JSON.stringify({ memberId }),
    });
    if (res.error) {
        return { member: null, error: res.error.message || "Failed to add member" };
    }
    return { member: res.data ?? null };
}


export async function removeDepartmentMember(
    departmentId: string,
    memberId: string,
): Promise<{ error?: string }> {
    const res = await apiClient<{ removed: boolean }>(
        `/departments/${departmentId}/members/${memberId}`,
        { method: "DELETE" },
    );
    if (res.error) {
        return { error: res.error.message || "Failed to remove member" };
    }
    return {};
}

/**
 * What the CALLER can see, and why.
 *
 * Departments are a scope, not a permission, and the interaction between the
 * two is invisible from either screen: a member with a completely unrestricted
 * role sees nothing the moment the workspace has a department they are not in.
 * The server resolves this on every request already; this is the only endpoint
 * that reports it back.
 *
 * It carries facts about the caller alone, never department names or anyone
 * else's membership, which is why it needs no permission to read. The member
 * who most needs the answer is the one with the least access.
 */
export interface DepartmentScope {
    workspaceUsesDepartments: boolean;
    memberDepartmentCount: number;
    restrictedToOwnDepartments: boolean;
    /** Restricted AND in no department, therefore seeing nothing at all. */
    blockedByMissingDepartment: boolean;
}

export const NO_DEPARTMENT_SCOPE: DepartmentScope = {
    workspaceUsesDepartments: false,
    memberDepartmentCount: 0,
    restrictedToOwnDepartments: false,
    blockedByMissingDepartment: false,
};

export async function fetchDepartmentScope(): Promise<{
    scope: DepartmentScope;
    error?: string;
}> {
    const res = await apiClient<DepartmentScope>("/departments/scope", { method: "GET" });
    if (res.error) {
        // Falling back to "nothing to explain" keeps a failed call from
        // telling a member their access is broken when it is not.
        return { scope: NO_DEPARTMENT_SCOPE, error: res.error.message };
    }
    return { scope: res.data ?? NO_DEPARTMENT_SCOPE };
}
