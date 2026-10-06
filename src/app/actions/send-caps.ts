import { apiClient } from "@/lib/api/browser-client";
import type {
    SendCapActionError,
    SendCapChange,
    SendCapListing,
    SendCapUnlockTarget,
} from "@/lib/balance/send-cap-types";

export async function adminListSendCapsAction(): Promise<{
    listing: SendCapListing | null;
    error?: SendCapActionError;
}> {
    const response = await apiClient<SendCapListing>("/admin/send-caps", { method: "GET" });
    if (response.error) {
        return { listing: null, error: { message: response.error.message, code: response.error.code } };
    }
    return { listing: response.data ?? null };
}

export async function adminSetSendCapAction(
    workspaceId: string,
    limit: number,
    cycleDay?: number,
): Promise<{ change: SendCapChange | null; error?: SendCapActionError }> {
    const response = await apiClient<SendCapChange>(`/admin/send-caps/${encodeURIComponent(workspaceId)}`, {
        method: "PUT",
        body: JSON.stringify({ limit, cycleDay }),
    });
    if (response.error) {
        return { change: null, error: { message: response.error.message, code: response.error.code } };
    }
    return { change: response.data ?? null };
}

export async function adminUnlockSendCapAction(
    workspaceId: string,
    target: SendCapUnlockTarget,
    code: string,
): Promise<{ change: SendCapChange | null; error?: SendCapActionError }> {
    const body = target.kind === "remove" ? { removeCap: true, code } : { limit: target.limit, cycleDay: target.cycleDay, code };
    const response = await apiClient<SendCapChange>(
        `/admin/send-caps/${encodeURIComponent(workspaceId)}/unlock`,
        { method: "POST", body: JSON.stringify(body) },
    );
    if (response.error) {
        return { change: null, error: { message: response.error.message, code: response.error.code } };
    }
    return { change: response.data ?? null };
}
