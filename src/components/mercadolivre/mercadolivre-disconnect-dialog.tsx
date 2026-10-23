"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { disconnectMercadoLivreAccountAction } from "@/app/actions/mercadolivre";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { MercadoLivreAccount } from "@/lib/mercadolivre/types";

import { useMercadoLivreError } from "./use-mercadolivre-error";
import { usePurgeDate } from "@/components/channels/use-purge-date";

export function MercadoLivreDisconnectDialog({
  account,
  open,
  onOpenChange,
  onDisconnected,
}: {
  account: MercadoLivreAccount | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDisconnected: () => void;
}) {
  const t = useTranslations("mercadolivre.disconnect");
  const describeError = useMercadoLivreError();
  const purgeDate = usePurgeDate();

  const disconnect = async () => {
    if (!account) return;
    const result = await disconnectMercadoLivreAccountAction(account.id);
    if ("error" in result) {
      toast.error(t("title"), { description: describeError(result) });
      return;
    }
    if (result.disconnected.warning) {
      toast.error(t("title"), { description: t("revokeFailed") });
    } else {
      toast(t("title"), { description: t("done", { name: account.displayName, date: purgeDate(result.disconnected.purgeAfter) }) });
    }
    onDisconnected();
  };

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      tone="danger"
      title={t("title")}
      description={t("body", { name: account?.displayName ?? "" })}
      confirmLabel={t("action")}
      onConfirm={disconnect}
    />
  );
}
