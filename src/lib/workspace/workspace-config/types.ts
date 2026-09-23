import type { WorkingHoursSpec } from "@/lib/working-hours/types";

export type RouletteMode = "online" | "last_seen";

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
    skipAdminAssignment: boolean;
    autoCloseEnabled: boolean;
    autoCloseIdleAfterHours: number;
    autoCloseMaxAgeEnabled: boolean;
    autoCloseMaxAgeAfterHours: number;
    rouletteMode: RouletteMode;
    rouletteLastSeenWindowHours: number;
    rouletteRescueEnabled: boolean;
    rouletteRescueAfterMinutes: number;
    workingHours?: WorkingHoursSpec | null;
    outcomeCapture?: OutcomeCaptureSpec | null;
    updatedBy: string;
    updatedAt: string;
    createdAt: string;
}

