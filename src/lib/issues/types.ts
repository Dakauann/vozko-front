export type IssueStatus = "open" | "in_progress" | "closed";

export interface Issue {
    id: string;
    workspaceId: string;
    title: string;
    description: string;
    imageUrls?: string[];
    status: IssueStatus;
    createdAt: number;
    updatedAt: number;
    closedAt?: number;
}

export interface IssueResponse {
    id: string;
    issueId: string;
    authorId: string;
    body: string;
    imageUrl?: string;
    createdAt: number;
}

export interface IssueListMeta {
    page: number;
    pageSize: number;
    totalPages: number;
    totalItems: number;
}

export interface IssueListParams {
    workspaceId?: string;
    page?: number;
    pageSize?: number;
    status?: IssueStatus | "all";
    search?: string;
    sortBy?: string;
    sortDir?: "asc" | "desc";
}

export interface CreateIssuePayload {
    title: string;
    description: string;
    imageUrls?: string[];
}

export interface CreateIssueResponsePayload {
    body: string;
    imageUrl?: string;
}
