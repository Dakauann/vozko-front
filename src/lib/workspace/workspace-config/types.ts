import type { WorkingHoursSpec } from "@/lib/working-hours/types";

export type RouletteMode = "online" | "last_seen";

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
    /**
     * Como a roleta escolhe o atendente.
     * - "online": distribui só entre quem está conectado agora (padrão, comportamento histórico).
     * - "last_seen": distribui entre todos que estiveram online dentro da janela.
     *
     * União fechada de propósito: um modo novo no backend vira erro de
     * compilação aqui, em vez de um card que não sabe o que mostrar.
     */
    rouletteMode: RouletteMode;
    /** Horas desde a última vez online para continuar na roleta (1..168). Padrão: 48. */
    rouletteLastSeenWindowHours: number;
    /** Reatribuir conversa que o dono não abriu. Só age no modo "last_seen". */
    rouletteRescueEnabled: boolean;
    /** Prazo do dono para abrir ou responder, em minutos (1..1440). Padrão: 15. */
    rouletteRescueAfterMinutes: number;
    /**
     * Escala semanal do workspace. Ausente = sem horário configurado, ou seja,
     * operação 24h — o comportamento de sempre.
     */
    workingHours?: WorkingHoursSpec | null;
    updatedBy: string;
    updatedAt: string;
    createdAt: string;
}

