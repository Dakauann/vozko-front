export interface LoginCredentials {
    email: string;
    password: string;
}

export interface AuthTokens {
    accessToken: string;
    refreshToken: string;
}

export interface UserPlan {
    name: string;
    maxCallChannels: number;
}

export interface User {
    id: string;
    email: string;
    name?: string;
    picture?: string;
    role: string;
    emailVerified?: boolean;
    customerType: "company" | "individual";
    hasDocument?: boolean;
    document?: string;
    plan?: UserPlan;
}

export interface AuthResponse {
    accessToken: string;
    refreshToken: string;
    tokenType: string;
    userId: string;
    email: string;
    name?: string;
    picture?: string;
    role: string;
    customerType: "company" | "individual";
}

export interface RefreshTokenRequest {
    refreshToken: string;
}

