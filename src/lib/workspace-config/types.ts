export interface WorkspaceConfig {
    id: string;
    workspaceId: string;
    campaignSpamProtectionDays: number;
    /**
     * How many unofficial WhatsApp numbers this workspace may connect before
     * buying more. PLATFORM-ADMIN only: readable everywhere so a workspace can
     * be told why its connect button is disabled, writable only through the
     * /admin config route.
     */
    includedUnofficialWhatsAppInstances?: number;
    skipAdminAssignment: boolean;
    autoCloseEnabled?: boolean;
    autoCloseIdleAfterHours?: number;
    updatedBy?: string;
    createdAt: string;
    updatedAt: string;
}
