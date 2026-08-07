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
    /** O que o cliente ouve em espera durante transferências:
     *  "" (padrão do sistema), "builtin:<key>" (faixa inclusa) ou o id de uma
     *  música enviada pelo workspace (media hold_music). */
    holdMusicTrack: string;
    /** Fila de espera (ACD): quando o destino de uma transferência (ou o
     *  departamento) está ocupado, o cliente aguarda em fila em vez de ouvir
     *  ocupado. Os limites garantem que ninguém espera para sempre. */
    queueEnabled: boolean;
    /** Tempo máximo de espera em segundos (0 = padrão do servidor). */
    queueMaxWaitSeconds: number;
    /** Máximo de chamadas simultâneas na fila (0 = padrão do servidor). */
    queueMaxLength: number;
    /** Ação ao esgotar o tempo: "hangup" (aviso + encerrar) ou "recall"
     *  (retornar ao atendente que iniciou). */
    queueOverflow: QueueOverflowAction;
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

export type QueueOverflowAction = "hangup" | "recall";

export type BuiltinHoldTrack = {
    key: string;
    label: string;
}
