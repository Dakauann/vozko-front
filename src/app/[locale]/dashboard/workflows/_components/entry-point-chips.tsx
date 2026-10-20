"use client";

import { memo, useMemo, type ReactNode } from "react";
import { useLocale, useNow, useTranslations } from "next-intl";

import {
  ArrowBendUpLeft,
  ChatCircle,
  ChatCircleDots,
  ClockCountdown,
  FileText,
  Kanban,
  Megaphone,
  PhoneCall,
  Play,
  Question,
  Robot,
  WebhooksLogo,
  type Icon,
} from "@/components/icons";
import ElevatedButton from "@/components/elevated-design/button";
import { EmptyValue } from "@/components/elevated-design/empty-value";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { relativeSince } from "@/lib/format/relative-since";
import { entryPointCopy, shownChannels, type EntryPointCopy, type EntryPointFix } from "@/lib/workflows/entry-points";
import type { EntryPoint, EntryPointKind } from "@/lib/workflows/types";
import { webhookOutcomeLabel, webhookReasonLabel } from "@/lib/workflows/webhook-delivery";
import { cn } from "@/lib/utils";

const KIND_ICONS: Record<EntryPointKind, Icon> = {
  message_received: ChatCircleDots,
  first_message: ChatCircle,
  webhook: WebhooksLogo,
  form_submitted: FileText,
  agent_call: Robot,
  campaign_sent: Megaphone,
  stage_added: Kanban,
  no_reply: ClockCountdown,
  call_received: PhoneCall,
  manual: Play,
  lead_exit: ArrowBendUpLeft,
};

const LAST_CALL_TICK_MS = 60_000;

export function EntryReadinessDot({ ready, className }: { ready: boolean; className?: string }) {
  return <span aria-hidden className={cn("h-1.5 w-1.5 shrink-0 rounded-full", ready ? "bg-healthy" : "bg-destructive", className)} />;
}

export function useEntryPointText() {
  const t = useTranslations("workflowsPage.entryPoints");
  return useMemo(
    () => ({
      label: (copy: EntryPointCopy) => t(copy.labelKey),
      status: (copy: EntryPointCopy) => (copy.ready ? t("ready") : t("blocked", { reason: t(copy.reasonKey ?? "reasons.unknown") })),
      inline: (copy: EntryPointCopy) => (copy.inlineKey ? t(copy.inlineKey, { reason: t(copy.reasonKey ?? "reasons.unknown") }) : null),
      fix: (copy: EntryPointCopy) => (copy.fixKey ? t(copy.fixKey) : null),
    }),
    [t],
  );
}

export function EntryLastCall({ at }: { at?: string }) {
  const t = useTranslations("workflowsPage.entryPoints");
  const locale = useLocale();
  const now = useNow({ updateInterval: LAST_CALL_TICK_MS });
  const ago = relativeSince(at, now, locale);
  return <>{ago ? t("lastCall", { ago }) : t("noCall")}</>;
}

function fixAllowed(fix: EntryPointFix, canUpdate: boolean): boolean {
  return fix.kind === "link" || fix.kind === "open_node" || canUpdate;
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="space-y-0.5 text-xs text-foreground">{children}</div>
    </div>
  );
}

function NamedState({ name, note }: { name: string; note?: string | null }) {
  return (
    <p className="flex items-center gap-1.5">
      {name ? <span className="truncate">{name}</span> : <EmptyValue />}
      {note && <span className="text-muted-foreground">{note}</span>}
    </p>
  );
}

function EntryDetails({ entry }: { entry: EntryPoint }) {
  const t = useTranslations("workflowsPage.entryPoints");
  const details = entry.details;
  if (!details) return null;
  const channels = shownChannels(details);
  return (
    <>
      {details.webhook && (
        <>
          <DetailRow label={t("details.authMode")}>
            <p>{t.has(`authModes.${details.webhook.authMode}`) ? t(`authModes.${details.webhook.authMode}`) : <EmptyValue />}</p>
          </DetailRow>
          <DetailRow label={t("details.method")}>
            <p>{details.webhook.method || <EmptyValue />}</p>
          </DetailRow>
        </>
      )}
      {(details.anyForm || (details.forms?.length ?? 0) > 0) && (
        <DetailRow label={t("details.forms")}>
          {details.anyForm && <p>{t("details.anyForm")}</p>}
          {details.forms?.map((form) => (
            <NamedState
              key={form.id}
              name={form.name}
              note={form.missing ? t("details.missing") : form.active ? null : t("details.inactive")}
            />
          ))}
        </DetailRow>
      )}
      {(details.agents?.length ?? 0) > 0 && (
        <DetailRow label={t("details.agents")}>
          {details.agents!.map((agent) => (
            <NamedState key={agent.id} name={agent.name} note={agent.active ? null : t("details.inactive")} />
          ))}
        </DetailRow>
      )}
      {channels.length > 0 && (
        <DetailRow label={t("details.channels")}>
          {channels.map((channel) => (
            <NamedState
              key={`${channel.kind}:${channel.id}`}
              name={channel.name}
              note={!channel.workflowEnabled ? t("details.flowsOff") : t.has(`channelKinds.${channel.kind}`) ? t(`channelKinds.${channel.kind}`) : null}
            />
          ))}
        </DetailRow>
      )}
      {(details.leadExits?.length ?? 0) > 0 && (
        <DetailRow label={t("details.leadExits")}>
          {details.leadExits!.map((exit, index) => (
            <div key={`${exit.source}:${exit.id ?? index}:${exit.button}`}>
              <NamedState name={exit.name} />
              <p className="text-muted-foreground">
                {`${t(exit.source === "campaign" ? "details.campaign" : "details.template")} · ${t("details.button", { button: exit.button })}`}
              </p>
            </div>
          ))}
        </DetailRow>
      )}
    </>
  );
}

function LastOutcome({ entry }: { entry: EntryPoint }) {
  const t = useTranslations("workflowsPage.entryPoints");
  const tWebhook = useTranslations("workflowRuns.webhook");
  if (!entry.lastOutcome) return null;
  const outcome = webhookOutcomeLabel(entry.lastOutcome, tWebhook).label;
  const reason = webhookReasonLabel(entry.lastReason, tWebhook);
  return <p className="text-xs text-muted-foreground">{t("lastOutcome", { outcome: reason ? `${outcome} · ${reason}` : outcome })}</p>;
}

export function EntryPointCard({
  entry,
  canUpdate,
  onFix,
}: {
  entry: EntryPoint;
  canUpdate: boolean;
  onFix: (fix: EntryPointFix) => void;
}) {
  const text = useEntryPointText();
  const copy = entryPointCopy(entry);
  const fixLabel = text.fix(copy);
  const fix = copy.fix && fixLabel && fixAllowed(copy.fix, canUpdate) ? copy.fix : null;
  return (
    <div className="space-y-2.5" onClick={(event) => event.stopPropagation()}>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">{text.label(copy)}</p>
        <p className="flex items-center gap-1.5 text-xs text-foreground">
          <EntryReadinessDot ready={copy.ready} />
          <span>{text.status(copy)}</span>
        </p>
      </div>
      <EntryDetails entry={entry} />
      <div className="space-y-0.5">
        <p className="text-xs text-muted-foreground">
          <EntryLastCall at={entry.lastReceivedAt} />
        </p>
        <LastOutcome entry={entry} />
      </div>
      {fix && fixLabel && <ElevatedButton variant="outline-subtle" size="sm" title={fixLabel} onClick={() => onFix(fix)} />}
    </div>
  );
}

function EntryPointChip({
  entry,
  canUpdate,
  onFix,
}: {
  entry: EntryPoint;
  canUpdate: boolean;
  onFix: (fix: EntryPointFix) => void;
}) {
  const text = useEntryPointText();
  const copy = entryPointCopy(entry);
  const KindIcon = KIND_ICONS[entry.kind] ?? Question;
  return (
    <HoverCard openDelay={150} closeDelay={100}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          aria-label={`${text.label(copy)}: ${text.status(copy)}`}
          onClick={(event) => event.stopPropagation()}
          className="inline-flex h-6 items-center gap-1 rounded-[--radius] border border-border bg-card px-1.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <KindIcon size={13} weight="bold" />
          <EntryReadinessDot ready={copy.ready} />
        </button>
      </HoverCardTrigger>
      <HoverCardContent align="start" className="w-72">
        <EntryPointCard entry={entry} canUpdate={canUpdate} onFix={onFix} />
      </HoverCardContent>
    </HoverCard>
  );
}

function EntryPointChipsView({
  entries,
  canUpdate,
  onFix,
  className,
}: {
  entries: readonly EntryPoint[] | undefined;
  canUpdate: boolean;
  onFix: (fix: EntryPointFix) => void;
  className?: string;
}) {
  const t = useTranslations("workflowsPage.entryPoints");
  if (!entries) return <EmptyValue className="text-sm" />;
  if (entries.length === 0) return <span className="text-xs text-muted-foreground">{t("none")}</span>;
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1", className)}>
      {entries.map((entry, index) => (
        <EntryPointChip key={`${entry.kind}:${entry.nodeId ?? index}`} entry={entry} canUpdate={canUpdate} onFix={onFix} />
      ))}
    </span>
  );
}

export const EntryPointChips = memo(EntryPointChipsView);
