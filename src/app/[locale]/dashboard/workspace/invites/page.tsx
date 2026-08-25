"use client";

import * as React from "react";

import { Buildings, Check, Envelope, X } from "@/components/icons";
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
      <div className="border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <Envelope
            className="h-[18px] w-[18px] text-muted-foreground"
            weight="fill"
          />
          <h1 className="font-display text-xl font-semibold leading-tight tracking-[0.01em] text-foreground">
            {t("title")}
          </h1>
        </div>
        <p className="mt-0.5 text-sm leading-snug text-muted-foreground">
          {t("subtitle")}
        </p>
      </div>

      {error && (
        <div className="rounded-[--radius] bg-muted border border-border px-4 py-3 text-sm text-destructive-ink">
          {error}
        </div>
      )}

      {invites.length === 0 ? (
        <div className="rounded-[--radius] border border-dashed border-border bg-muted px-6 py-10 text-center">
          <Envelope
            className="mx-auto h-10 w-10 text-muted-foreground"
            weight="fill"
          />
          <p className="mt-3 text-sm text-muted-foreground">{t("noInvites")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {invites.map((invite) => (
            <div
              key={invite.id}
              className="rounded-[--radius] border border-border bg-card p-5 shadow-sm"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-[--radius] bg-primary text-primary-foreground">
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
                    className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
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
