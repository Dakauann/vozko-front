"use client";

import * as React from "react";

import { Buildings, Check, Envelope, X } from "@phosphor-icons/react";
import {
  acceptInviteAction,
  declineInviteAction,
  listMyInvitesAction,
} from "@/app/actions/workspace";

import type { WorkspaceInvite } from "@/lib/workspace/types";
import { useTranslations } from "next-intl";
import { useWorkspace } from "@/contexts/workspace-context";

export default function InvitesPage() {
  const t = useTranslations("workspaceInvites");
  const { refreshWorkspaces } = useWorkspace();
  const [invites, setInvites] = React.useState<WorkspaceInvite[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [processing, setProcessing] = React.useState<string | null>(null);
  const [error, setError] = React.useState("");

  const loadInvites = React.useCallback(async () => {
    setIsLoading(true);
    const result = await listMyInvitesAction();
    if (!result.error) setInvites(result.invites);
    setIsLoading(false);
  }, []);

  React.useEffect(() => {
    loadInvites();
  }, [loadInvites]);

  const handleAccept = async (invite: WorkspaceInvite) => {
    if (!invite.token) return;
    setProcessing(invite.id);
    setError("");
    const result = await acceptInviteAction(invite.token);
    if (result.error) {
      setError(result.error);
      setProcessing(null);
      return;
    }
    await refreshWorkspaces();
    await loadInvites();
    setProcessing(null);
  };

  const handleDecline = async (invite: WorkspaceInvite) => {
    setProcessing(invite.id);
    setError("");
    const result = await declineInviteAction(invite.id);
    if (result.error) {
      setError(result.error);
      setProcessing(null);
      return;
    }
    await loadInvites();
    setProcessing(null);
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="animate-pulse text-muted-foreground">
          {t("loading")}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-amber-500 text-white shadow-lg shadow-amber-200">
          <Envelope className="h-6 w-6" weight="fill" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {invites.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/50 p-12 text-center">
          <Envelope
            className="mx-auto h-10 w-10 text-slate-300"
            weight="fill"
          />
          <p className="mt-3 text-sm text-muted-foreground">{t("noInvites")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {invites.map((invite) => (
            <div
              key={invite.id}
              className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white">
                  <Buildings className="h-5 w-5" weight="fill" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    {invite.workspaceName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("invitedBy")} {invite.inviterEmail} &bull; {t("role")}:{" "}
                    {t(`roles.${invite.role}`)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("expires")}{" "}
                    {new Date(invite.expiresAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAccept(invite)}
                    disabled={processing === invite.id}
                    className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
                  >
                    <Check className="h-3.5 w-3.5" weight="bold" />
                    {t("accept")}
                  </button>
                  <button
                    onClick={() => handleDecline(invite)}
                    disabled={processing === invite.id}
                    className="flex items-center gap-1.5 rounded-lg bg-muted px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-border disabled:opacity-50 transition-colors"
                  >
                    <X className="h-3.5 w-3.5" weight="bold" />
                    {t("decline")}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
