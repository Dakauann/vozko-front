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

/**
 * The one place a number's state becomes something an operator can read.
 *
 * Three surfaces ask the same question — the list row, the detail header and the
 * inbox composer — and three inline ternaries would eventually disagree about
 * whether a restricted-but-connected number counts as healthy. It does not, and
 * that case is the one most likely to be missed: the session is live, messages
 * arrive, and outbound silently fails.
 *
 * Per DESIGN.md §9 the state is carried by the MARK, never by a wash behind its
 * own hue: one neutral ground, and the ink and glyph do the work. The telegram
 * screens still use solid semantic fills; they predate the rule and are in the
 * review queue, so this deliberately does not copy them.
 */

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
  /** Compact drops the label and keeps the mark, for dense table rows. */
  compact?: boolean;
  className?: string;
}

/**
 * The status chip.
 *
 * One `bg-muted` ground for every state; only the glyph and the ink change. That
 * is what lets all six states clear AA on a single known background instead of
 * each needing its own tuned wash — and what stops six distinct problems from
 * reading as six shades of one thing.
 */
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
        "text-[11px] font-semibold leading-none",
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

/**
 * The restriction panel.
 *
 * This is the last warning before a ban, and the only state where a countdown is
 * meaningful — every other refusal on this channel has no clock. The provider's
 * own wording is shown verbatim rather than paraphrased: it describes something
 * the customer can verify in their own WhatsApp, and rewording it would drift
 * from what they read there.
 */
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
        // A neutral ground with a warning-ink mark, not an amber wash: amber is
        // the hue most at risk of collapsing into this product's orange brand.
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

/**
 * The channel's standing disclosure.
 *
 * PRODUCT.md principle 3 requires platform limits to be surfaced plainly rather
 * than hidden, and this channel's limit is the largest in the product: it is an
 * unofficial linked-device connection, and Meta can disable the number. The
 * disclosure appears before the QR on connect and again on the number's own
 * page, because an operator who reads it once at setup is not the operator who
 * later loads a forty-thousand-row list.
 */
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
