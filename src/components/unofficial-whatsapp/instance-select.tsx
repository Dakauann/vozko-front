"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";

import { listInstancesAction } from "@/app/actions/unofficial-whatsapp";
import type { ElevatedCommandOption } from "@/components/elevated-design/elevated-command-select";
import { Warning } from "@/components/icons";
import { usePaginatedSelect } from "@/hooks/use-paginated-select";
import { instanceUnusable, type InstanceIssue, type UnofficialWhatsAppInstance } from "@/lib/unofficial-whatsapp/types";
import { cn } from "@/lib/utils";

const INSTANCES_PAGE = 20;

export function useUnofficialInstanceSelect() {
  const t = useTranslations("unofficialWhatsappCampaigns");
  const [failed, setFailed] = useState(false);
  const select = usePaginatedSelect<UnofficialWhatsAppInstance>({
    fetchFn: useCallback(async (page: number, search: string) => {
      const result = await listInstancesAction(page, INSTANCES_PAGE, search || undefined);
      setFailed(Boolean(result.error));
      return { items: result.instances ?? [], totalPages: result.meta.totalPages };
    }, []),
    mapOption: useCallback(
      (instance: UnofficialWhatsAppInstance): ElevatedCommandOption => ({
        value: instance.id,
        label: instance.sessionLive ? instance.displayName : `${instance.displayName} · ${t("form.numberOffline")}`,
      }),
      [t],
    ),
  });
  return { ...select, failed };
}

export function InstanceIssueLine({ issue, className }: { issue: InstanceIssue; className?: string }) {
  const t = useTranslations("unofficialWhatsappCampaigns");
  if (!issue) return null;
  return (
    <p
      className={cn(
        "flex items-center gap-1.5 text-xs font-semibold",
        instanceUnusable(issue) ? "text-destructive-ink" : "text-warning-ink",
        className,
      )}
    >
      <Warning className="h-3.5 w-3.5" weight="fill" aria-hidden />
      {t(`numberIssue.${issue}`)}
    </p>
  );
}
