export interface Department {
    id: string;
    workspaceId: string;
    name: string;
    description?: string;
    memberCount?: number;
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
