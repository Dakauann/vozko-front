import type {
    WorkspaceConfig,
    QueueOverflowAction
} from '@/lib/workspace/workspace-config/types';
import { apiClient } from "@/lib/api/browser-client";

export async function getWorkspaceConfigAction(workspaceId: string): Promise<{
    config: WorkspaceConfig | null;
    error?: string;
}> {
    const response = await apiClient<WorkspaceConfig>(`/workspaces/${workspaceId}/config`, {
        method: 'GET',
    });

    if (response.error) {
        return { config: null, error: response.error.message };
    }

    return { config: response.data ?? null };
}

export async function updateWorkspaceConfigAction(
    workspaceId: string,
    data: {
        skipAdminAssignment?: boolean;
        holdMusicTrack?: string;
        queueEnabled?: boolean;
        queueMaxWaitSeconds?: number;
        queueMaxLength?: number;
        queueOverflow?: QueueOverflowAction;
        autoCloseEnabled?: boolean;
        autoCloseIdleAfterHours?: number;
        autoCloseMaxAgeEnabled?: boolean;
        autoCloseMaxAgeAfterHours?: number;
    }
): Promise<{ config: WorkspaceConfig | null; error?: string }> {
    const response = await apiClient<WorkspaceConfig>(`/workspaces/${workspaceId}/config`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });

    if (response.error) {
        return { config: null, error: response.error.message };
    }

    return { config: response.data ?? null };
}

export async function fetchWorkspaceConfig(workspaceId: string): Promise<WorkspaceConfig | null> {
    const result = await getWorkspaceConfigAction(workspaceId);
    return result.config;
}

export async function adminUpdateWorkspaceConfigAction(
    workspaceId: string,
    // Every field optional and sent only when changed: the server reads an
    // absent field as "leave it alone", so posting the whole form would reset a
    // workspace's number allowance on an unrelated edit.
    data: {
        campaignSpamProtectionDays?: number;
        includedUnofficialWhatsAppInstances?: number;
    }
): Promise<{ config: WorkspaceConfig | null; error?: string }> {
    const response = await apiClient<WorkspaceConfig>(`/admin/workspaces/${workspaceId}/config`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });

    if (response.error) {
        return { config: null, error: response.error.message };
    }

    return { config: response.data ?? null };
}
