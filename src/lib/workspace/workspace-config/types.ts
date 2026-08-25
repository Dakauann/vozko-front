export type WorkspaceConfig = {
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
    /** Encerrar conversas automaticamente após silêncio do cliente. Padrão: true. */
    autoCloseEnabled: boolean;
    /** Horas de silêncio após a última mensagem do atendente/IA (1..168). Padrão: 24. */
    autoCloseIdleAfterHours: number;
    /** Encerrar por inatividade absoluta (qualquer lado). Padrão: true. */
    autoCloseMaxAgeEnabled: boolean;
    /** Horas sem qualquer mensagem (24..2160 / até 90 dias). Padrão: 168 (7d). */
    autoCloseMaxAgeAfterHours: number;
    updatedBy: string;
    updatedAt: string;
    createdAt: string;
}

