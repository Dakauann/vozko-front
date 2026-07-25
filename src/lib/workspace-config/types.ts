export interface WorkspaceConfig {
    id: string;
    workspaceId: string;
    campaignSpamProtectionDays: number;
    skipAdminAssignment: boolean;
    autoCloseEnabled?: boolean;
    autoCloseIdleAfterHours?: number;
    updatedBy?: string;
    createdAt: string;
    updatedAt: string;
}
