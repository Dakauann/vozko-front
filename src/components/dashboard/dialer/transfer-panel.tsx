"use client";

import {
  ArrowsLeftRight,
  Check,
  Phone,
  PhoneSlash,
  SpinnerGap,
  X,
} from "@phosphor-icons/react";
import type {
  DialerTransferKind,
  IncomingTransferOffer,
  OutgoingTransferState,
} from "@/lib/dialer/transfer-types";
import { useCallback, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { DialerPresenceEntry } from "@/hooks/use-dialer-ws";
import type { WorkspaceMember } from "@/lib/workspace/types";
import {
  buildDialerRoster,
  sortWithinGroup,
  type RosterMember,
} from "@/lib/dialer/presence-roster";
import { EndpointBadges, RosterAvatar } from "./presence-bits";
import { cn } from "@/lib/utils";

interface TransferPanelProps {
  outgoingTransfer: OutgoingTransferState | null;
  members: WorkspaceMember[];
  presence: DialerPresenceEntry[];
  selfUserId: string;
  refreshTargets?: () => void;
  initiate: (
    targetUserId: string,
    kind: DialerTransferKind,
    note?: string,
  ) => void;
  completeAttended: (transferId: string) => void;
  cancelAttended: (transferId: string, reason?: string) => void;
  enabled: boolean;
  canTransfer?: boolean;
  canListMembers?: boolean;
  /** The workspace has the call queue enabled: a BLIND transfer to a busy
   *  colleague parks the caller in that agent's camp-on line instead of failing. */
  queueEnabled?: boolean;
}

function TransferMemberItem({
  member,
  busyLabel,
  queueLabel,
  browserLabel,
  branchLabel,
  campOn,
  onPick,
}: {
  member: RosterMember;
  busyLabel: string;
  queueLabel: string;
  browserLabel: string;
  branchLabel: string;
  // campOn: this busy member can still be picked because a blind transfer will
  // queue the caller for them (workspace queue enabled + blind kind).
  campOn: boolean;
  onPick: (userId: string) => void;
}) {
  const isBusy = member.status !== "available";
  const selectable = !isBusy || campOn;
  return (
    <CommandItem
      value={`${member.name} ${member.userId}`}
      disabled={!selectable}
      onSelect={() => onPick(member.userId)}
      className={cn(
        "flex items-center gap-2.5 py-1.5",
        !selectable && "opacity-60",
      )}
    >
      <RosterAvatar member={member} />
      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">
        {member.name}
      </span>
      {!isBusy ? (
        <EndpointBadges
          member={member}
          browserLabel={browserLabel}
          branchLabel={branchLabel}
        />
      ) : campOn ? (
        <span className="shrink-0 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
          {queueLabel}
        </span>
      ) : (
        <span className="shrink-0 text-[11px] text-muted-foreground">
          {busyLabel}
        </span>
      )}
    </CommandItem>
  );
}

export function TransferPanel({
  outgoingTransfer,
  members,
  presence,
  selfUserId,
  refreshTargets,
  initiate,
  completeAttended,
  cancelAttended,
  enabled,
  canTransfer = true,
  canListMembers = true,
  queueEnabled = false,
}: TransferPanelProps) {
  const tp = useTranslations("persistentDialer.presence");
  const t = useTranslations("persistentDialer.transfer");
  const [picking, setPicking] = useState(false);
  const [kind, setKind] = useState<DialerTransferKind>("blind");
  const [manualTargetId, setManualTargetId] = useState("");

  // Camp-on: only a BLIND transfer can queue a caller for a busy agent (an
  // attended transfer needs the target free right now to consult), and only when
  // the workspace queue is enabled.
  const campOn = queueEnabled && kind === "blind";

  const roster = useMemo(
    () => buildDialerRoster(presence, members, selfUserId),
    [presence, members, selfUserId],
  );
  const nameByUserId = useMemo(
    () => new Map(roster.map((r) => [r.userId, r.name])),
    [roster],
  );
  const available = useMemo(
    () => sortWithinGroup(roster.filter((r) => r.status === "available" && !r.isSelf)),
    [roster],
  );
  const busy = useMemo(
    () => sortWithinGroup(roster.filter((r) => r.status === "busy" && !r.isSelf)),
    [roster],
  );
  const hasTransferable = available.length + busy.length > 0;

  const handleOpenPicker = useCallback(() => {
    setKind("blind");
    setPicking(true);
    refreshTargets?.();
  }, [refreshTargets]);

  const handlePick = useCallback(
    (userId: string) => {
      initiate(userId, kind);
      setPicking(false);
    },
    [initiate, kind],
  );

  if (outgoingTransfer?.stage === "consulting") {
    const targetName =
      nameByUserId.get(outgoingTransfer.targetUserId) ?? t("fallbackName");
    return (
      <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 space-y-2">
        <div className="flex items-center gap-2 text-xs font-medium text-amber-700">
          <SpinnerGap weight="bold" className="h-3.5 w-3.5 animate-spin" />
          {t("consulting", { name: targetName })}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => cancelAttended(outgoingTransfer.transferId)}
            className="rounded-lg"
          >
            <X className="h-3.5 w-3.5" />
            {t("cancel")}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => completeAttended(outgoingTransfer.transferId)}
            className="rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
          >
            <Check weight="bold" className="h-3.5 w-3.5" />
            {t("complete")}
          </Button>
        </div>
      </div>
    );
  }

  if (outgoingTransfer?.stage === "pending_offer") {
    const targetName =
      nameByUserId.get(outgoingTransfer.targetUserId) ?? t("fallbackName");
    const isAttended = outgoingTransfer.kind === "attended";
    return (
      <div className="rounded-lg border border-sky-500/40 bg-sky-500/5 p-3 space-y-2">
        <div className="flex items-center gap-2 text-xs font-medium text-sky-700">
          <SpinnerGap weight="bold" className="h-3.5 w-3.5 animate-spin" />
          {t("waitingAccept", { name: targetName })}{" "}
          {isAttended ? t("parenAttended") : t("parenBlind")}…
        </div>
        <p className="text-[10px] text-sky-700/80 leading-tight">
          {t("blindMusicHint")}
        </p>
        <div className={cn("grid gap-2", isAttended ? "grid-cols-2" : "grid-cols-1")}>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              cancelAttended(outgoingTransfer.transferId, "initiator_cancelled")
            }
            className="rounded-lg"
          >
            <X className="h-3.5 w-3.5" />
            {t("cancel")}
          </Button>
          {isAttended ? (
            <Button
              type="button"
              size="sm"
              onClick={() => completeAttended(outgoingTransfer.transferId)}
              className="rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
              title={t("completeNowTitle")}
            >
              <Check weight="bold" className="h-3.5 w-3.5" />
              {t("completeNow")}
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  if (picking) {
    return (
      <div className="rounded-lg border border-border bg-card p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-foreground">
            {t("pickerHeader")}
          </span>
          <button
            type="button"
            onClick={() => {
              setPicking(false);
              setManualTargetId("");
            }}
            className="text-muted-foreground hover:text-foreground"
            aria-label={t("close")}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-1 text-[11px]">
          <button
            type="button"
            onClick={() => setKind("blind")}
            className={cn(
              "rounded-md border px-2 py-1 font-medium",
              kind === "blind"
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:bg-muted",
            )}
          >
            {t("blind")}
          </button>
          <button
            type="button"
            onClick={() => setKind("attended")}
            className={cn(
              "rounded-md border px-2 py-1 font-medium",
              kind === "attended"
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:bg-muted",
            )}
          >
            {t("attended")}
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground leading-tight">
          {kind === "blind"
            ? campOn
              ? t("blindHintCampOn")
              : t("blindHint")
            : t("attendedHint")}
        </p>

        {/* When the user lacks dialer:list_members the backend will not
            return a roster, so we drop into a manual-entry mode. They
            still have dialer:transfer (otherwise the CTA would be
            hidden) and need a way to invoke initiate against a known
            target_user_id. */}
        {!canListMembers ? (
          <div className="space-y-1.5">
            <label
              htmlFor="transfer-target-id"
              className="text-[10px] font-medium text-muted-foreground"
            >
              {t("targetIdLabel")}
            </label>
            <input
              id="transfer-target-id"
              type="text"
              value={manualTargetId}
              onChange={(e) => setManualTargetId(e.target.value)}
              placeholder="user_id"
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <Button
              type="button"
              size="sm"
              onClick={() => {
                const id = manualTargetId.trim();
                if (!id) return;
                handlePick(id);
                setManualTargetId("");
              }}
              disabled={!manualTargetId.trim()}
              className="w-full rounded-lg"
            >
              <ArrowsLeftRight weight="bold" className="h-3.5 w-3.5" />
              {t("transfer")}
            </Button>
          </div>
        ) : (
          <TooltipProvider delayDuration={300}>
            <Command className="rounded-md border border-border/60 bg-background/50">
              <CommandInput
                placeholder={t("searchPlaceholder")}
                className="h-8 text-xs"
              />
              <CommandList className="max-h-52">
                <CommandEmpty className="py-3 text-center text-[11px] text-muted-foreground">
                  {hasTransferable
                    ? t("emptyFiltered")
                    : t("emptyNone")}
                </CommandEmpty>
                {available.length > 0 ? (
                  <CommandGroup heading={tp("group.available")}>
                    {available.map((m) => (
                      <TransferMemberItem
                        key={m.userId}
                        member={m}
                        busyLabel={tp("group.busy")}
                        queueLabel={t("queueLabel")}
                        browserLabel={tp("endpoint.browser")}
                        branchLabel={tp("endpoint.branch")}
                        campOn={campOn}
                        onPick={handlePick}
                      />
                    ))}
                  </CommandGroup>
                ) : null}
                {busy.length > 0 ? (
                  <CommandGroup heading={campOn ? t("busyQueueHeading", { busy: tp("group.busy") }) : tp("group.busy")}>
                    {busy.map((m) => (
                      <TransferMemberItem
                        key={m.userId}
                        member={m}
                        busyLabel={tp("group.busy")}
                        queueLabel={t("queueLabel")}
                        browserLabel={tp("endpoint.browser")}
                        branchLabel={tp("endpoint.branch")}
                        campOn={campOn}
                        onPick={handlePick}
                      />
                    ))}
                  </CommandGroup>
                ) : null}
              </CommandList>
            </Command>
          </TooltipProvider>
        )}
      </div>
    );
  }

  if (!canTransfer) return null;
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleOpenPicker}
      disabled={!enabled}
      className="w-full rounded-lg"
    >
      <ArrowsLeftRight weight="bold" className="h-3.5 w-3.5" />
      {t("transfer")}
    </Button>
  );
}

interface IncomingOfferCardProps {
  offer: IncomingTransferOffer;
  initiatorName: string;
  accept: (transferId: string) => void;
  decline: (transferId: string, reason?: string) => void;
}

export function IncomingOfferCard({
  offer,
  initiatorName,
  accept,
  decline,
}: IncomingOfferCardProps) {
  const t = useTranslations("persistentDialer.transfer");
  return (
    <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 space-y-2">
      <div className="flex items-start gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-[hsl(var(--primary-hover))] text-primary-foreground shadow">
          <ArrowsLeftRight weight="bold" className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-foreground truncate">
            {t("wantsToTransfer", { name: initiatorName })}
          </p>
          <p className="text-[10px] text-muted-foreground leading-tight">
            {t("typeLabel")}{" "}
            {offer.kind === "attended"
              ? t("typeAttended")
              : t("typeBlind")}
          </p>
          {offer.note ? (
            <p className="text-[10px] text-muted-foreground mt-1 italic line-clamp-2">
              “{offer.note}”
            </p>
          ) : null}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => decline(offer.transferId)}
          className="rounded-lg"
        >
          <PhoneSlash weight="bold" className="h-3.5 w-3.5" />
          {t("decline")}
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={() => accept(offer.transferId)}
          className="rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
        >
          <Phone weight="fill" className="h-3.5 w-3.5" />
          {t("accept")}
        </Button>
      </div>
    </div>
  );
}
