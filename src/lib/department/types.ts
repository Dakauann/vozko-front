import type { WorkingHoursSpec } from "@/lib/working-hours/types";

export interface Department {
    id: string;
    workspaceId: string;
    name: string;
    description?: string;
    memberCount?: number;
    /** Escala própria do departamento. Ausente = herda a do workspace. */
    workingHours?: WorkingHoursSpec | null;
    createdAt: string;
    updatedAt: string;
}

export interface DepartmentMember {
    id: string;
    departmentId: string;
    memberId: string;
    userId?: string;
    email?: string;
    username?: string;
    role?: string;
    createdAt: string;
}
