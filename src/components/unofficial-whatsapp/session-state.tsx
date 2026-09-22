"use client";

import {
  CheckCircle,
  Clock,
  DeviceMobile,
  Prohibit,
  ShieldWarning,
  WifiSlash,
} from "@/components/icons";
import {
  instanceIssue,
  type InstanceIssue,
  type UnofficialWhatsAppInstance,
} from "@/lib/unofficial-whatsapp/types";

import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";


const ISSUE_INK: Record<Exclude<InstanceIssue, null>, string> = {
  banned: "text-destructive-ink",
  restricted: "text-warning-ink",
  disconnected: "text-destructive-ink",
  "awaiting-scan": "text-info-ink",
  provisioning: "text-muted-foreground",
  "provision-failed": "text-destructive-ink",
};

const ISSUE_ICON: Record<Exclude<InstanceIssue, null>, typeof CheckCircle> = {
  banned: Prohibit,
  restricted: ShieldWarning,
  disconnected: WifiSlash,
  "awaiting-scan": DeviceMobile,
  provisioning: Clock,
  "provision-failed": ShieldWarning,
};

export function sessionStateKey(instance: UnofficialWhatsAppInstance): string {
  return instanceIssue(instance) ?? "live";
}

interface SessionStateProps {
  instance: UnofficialWhatsAppInstance;
  compact?: boolean;
  className?: string;
}

export function SessionState({ instance, compact = false, className }: SessionStateProps) {
  const t = useTranslations("unofficialWhatsapp");
  const issue = instanceIssue(instance);

  const ink = issue ? ISSUE_INK[issue] : "text-healthy-ink";
  const Icon = issue ? ISSUE_ICON[issue] : CheckCircle;
  const label = t(`state.${sessionStateKey(instance)}`);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[--radius] bg-muted px-2 py-1",
        "text-2xs font-semibold leading-none",
        ink,
        className,
      )}
      title={instance.statusReason || label}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {!compact && <span>{label}</span>}
      {compact && <span className="sr-only">{label}</span>}
    </span>
  );
}

export function RestrictionNotice({
  instance,
  className,
}: {
  instance: UnofficialWhatsAppInstance;
  className?: string;
}) {
  const t = useTranslations("unofficialWhatsapp");
  const { restriction } = instance;

  if (!restriction?.active) return null;

  const hasQuota = (restriction.totalQuota ?? 0) > 0;

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border border-border bg-muted p-4",
        className,
      )}
      role="status"
    >
      <ShieldWarning className="mt-0.5 h-5 w-5 shrink-0 text-warning-ink" aria-hidden />
      <div className="min-w-0 space-y-1">
        <p className="text-sm font-semibold text-warning-ink">{t("restriction.title")}</p>
        {restriction.message && (
          <p className="text-sm text-muted-foreground">{restriction.message}</p>
        )}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-xs text-muted-foreground">
          {hasQuota && (
            <span>
              {t("restriction.quota")}{" "}
              <span className="readout font-semibold text-foreground">
                {restriction.usedQuota ?? 0}/{restriction.totalQuota}
              </span>
            </span>
          )}
          {restriction.until && (
            <span>
              {t("restriction.until")}{" "}
              <span className="readout font-semibold text-foreground">
                {new Date(restriction.until).toLocaleString()}
              </span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function UnofficialNotice({ className }: { className?: string }) {
  const t = useTranslations("unofficialWhatsapp");

  return (
    <div className={cn("rounded-lg border border-border bg-muted p-4", className)}>
      <div className="flex items-start gap-3">
        <ShieldWarning className="mt-0.5 h-5 w-5 shrink-0 text-warning-ink" aria-hidden />
        <div className="space-y-2">
          <p className="text-sm font-semibold text-foreground">{t("disclosure.title")}</p>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            <li>{t("disclosure.unofficial")}</li>
            <li>{t("disclosure.ban")}</li>
            <li>{t("disclosure.business")}</li>
            <li>{t("disclosure.session")}</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
