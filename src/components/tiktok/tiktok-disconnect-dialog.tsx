"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { disconnectTiktokAccountAction } from "@/app/actions/tiktok";
import { usePurgeDate } from "@/components/channels/use-purge-date";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { TiktokAccount } from "@/lib/tiktok/types";

import { useTiktokError } from "./use-tiktok-error";

export function TiktokDisconnectDialog({
  account,
  open,
  onOpenChange,
  onDisconnected,
}: {
  account: TiktokAccount | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDisconnected: () => void;
}) {
  const t = useTranslations("tiktok.disconnect");
  const describeError = useTiktokError();
  const purgeDate = usePurgeDate();

  const disconnect = async () => {
    if (!account) return;
    const result = await disconnectTiktokAccountAction(account.id);
    if ("error" in result) {
      toast.error(t("title"), { description: describeError(result) });
      return;
    }
    if (result.disconnected.warning) {
      toast.error(t("title"), { description: t("revokeFailed") });
    } else {
      toast(t("title"), { description: t("done", { name: account.username, date: purgeDate(result.disconnected.purgeAfter) }) });
    }
    onDisconnected();
  };

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      tone="danger"
      title={t("title")}
      description={t("body", { name: account?.username ?? "" })}
      confirmLabel={t("action")}
      onConfirm={disconnect}
    />
  );
}
