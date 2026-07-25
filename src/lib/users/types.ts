export type UserRole = 'admin' | 'user';

export type CustomerType = 'individual' | 'company';

export interface User {
    id: string;
    username: string;
    email: string;
    picture?: string | null;
    role: UserRole;
    customerType: CustomerType;
    cpf?: string;
    cnpj?: string;
    emailVerified: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface ListUsersParams {
    page?: number;
    pageSize?: number;
    search?: string;
    role?: UserRole;
}

export interface ListUsersMeta {
    page: number;
    pageSize: number;
    totalPages: number;
    totalItems: number;
}

export interface ListUsersResponse {
    success: boolean;
    items: User[];
    page: number;
    page_size: number;
    total_items: number;
    total_pages: number;
}

export interface UserResponse {
    success: boolean;
    data: User;
}

export interface UpdateUserRolePayload {
    role: UserRole;
}

export interface UserApiError {
    success: false;
    error: {
        message: string;
        details?: Record<string, unknown>;
        fields?: Record<string, string>;
    };
}
