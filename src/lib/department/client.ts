
import { apiClient } from "@/lib/api/browser-client";
import type { Department, DepartmentMember } from "@/lib/department/types";


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


export async function updateDepartment(
    id: string,
    name: string,
    description?: string,
): Promise<{ department: Department | null; error?: string }> {
    const res = await apiClient<Department>(`/departments/${id}`, {
        method: "PUT",
        body: JSON.stringify({ name, description }),
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
