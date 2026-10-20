import type { WorkingHoursSpec } from "@/lib/working-hours/types";

export type RouletteMode = "online" | "last_seen";

export type RouletteStrategy =
    | "round_robin"
    | "priority"
    | "weighted"
    | "least_busy"
    | "longest_idle"
    | "random"
    | "claim";

export type RouletteRecipient = {
    userId: string;
    tier: number;
    weight: number;
};

export type MetaPayer = "vozko" | "client";

export type OutcomeSpec = {
    code: string;
    label: string;
    isDurable: boolean;
    position: number;
};

export type OutcomeCaptureSpec = {
    enabled: boolean;
    enabledAt?: string | null;
    requireOnFinish: boolean;
    durableThreshold: number;
    outcomes: OutcomeSpec[];
    departmentIds?: string[];
};

export type WorkspaceConfig = {
    id: string;
    workspaceId: string;
    campaignSpamProtectionDays: number;
    includedUnofficialWhatsAppInstances?: number;
    metaPayer?: MetaPayer;
    skipAdminAssignment: boolean;
    autoCloseEnabled: boolean;
    autoCloseIdleAfterHours: number;
    autoCloseMaxAgeEnabled: boolean;
    autoCloseMaxAgeAfterHours: number;
    rouletteMode: RouletteMode;
    rouletteLastSeenWindowHours: number;
    rouletteRescueEnabled: boolean;
    rouletteRescueAfterMinutes: number;
    rouletteStrategy?: RouletteStrategy;
    rouletteMaxOpenPerMember?: number;
    rouletteRecipients?: RouletteRecipient[];
    workingHours?: WorkingHoursSpec | null;
    outcomeCapture?: OutcomeCaptureSpec | null;
    updatedBy: string;
    updatedAt: string;
    createdAt: string;
}

