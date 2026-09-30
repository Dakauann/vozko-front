"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { ArrowLeft, Headset, SpinnerGap, UserCircle } from "@/components/icons";
import { CALL_ACTION } from "@/components/calls/call-card";
import ElevatedTextarea from "@/components/elevated-design/elevated-textarea";
import { listTransferQueuesAction } from "@/app/actions/call-routing";
import { useCallSession } from "@/contexts/call-session-context";
import { availableColleagues, MAX_TRANSFER_NOTES, type TransferTarget } from "@/lib/call-session/transfer";
import type { QueueTarget } from "@/lib/call-routing/types";
import { cn } from "@/lib/utils";

const QUEUE_REFRESH_MS = 5_000;

type TargetKind = TransferTarget["kind"];

interface CallTransferPanelProps {
  onClose: () => void;
}

export function CallTransferPanel({ onClose }: CallTransferPanelProps) {
  const t = useTranslations("calling.transfer");
  const { transfer, transferCall, cancelTransfer, presence, selfUserId } = useCallSession();
  const [kind, setKind] = useState<TargetKind>("member");
  const [chosen, setChosen] = useState<TransferTarget | null>(null);
  const [notes, setNotes] = useState("");
  const [queues, setQueues] = useState<QueueTarget[] | null>(null);

  const colleagues = useMemo(() => availableColleagues(presence, selfUserId), [presence, selfUserId]);

  const loadQueues = useCallback(() => {
    void listTransferQueuesAction().then((result) => setQueues(result.queues));
  }, []);

  useEffect(() => {
    loadQueues();
    const timer = setInterval(loadQueues, QUEUE_REFRESH_MS);
    return () => clearInterval(timer);
  }, [loadQueues]);

  if (transfer?.status === "ringing") {
    return (
      <div className="flex flex-col items-center px-4 pb-5 pt-6 text-center" role="status" aria-live="polite">
        <SpinnerGap className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
        <p className="mt-3 text-sm font-semibold text-foreground">{t("ringing", { name: transfer.targetName ?? t("colleague") })}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t("callerHolds")}</p>
        <button
          type="button"
          onClick={cancelTransfer}
          className={cn(CALL_ACTION, "mt-5 border border-control-edge text-foreground hover:bg-muted")}
        >
          {t("cancel")}
        </button>
      </div>
    );
  }

  const submit = () => {
    if (!chosen) return;
    transferCall(chosen, notes);
    onClose();
  };

  const pick = (next: TargetKind) => {
    setKind(next);
    setChosen(null);
  };

  return (
    <div className="flex min-h-0 flex-col">
      <div className="flex items-center gap-2 px-4 pt-3">
        <button
          type="button"
          onClick={onClose}
          aria-label={t("back")}
          title={t("back")}
          className="inline-flex h-7 w-7 items-center justify-center rounded-[--radius] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h3 className="text-sm font-semibold text-foreground">{t("title")}</h3>
      </div>

      <div role="tablist" aria-label={t("title")} className="mx-4 mt-3 grid grid-cols-2 rounded-[--radius] border border-border p-0.5">
        {(["member", "queue"] as const).map((option) => (
          <button
            key={option}
            type="button"
            role="tab"
            aria-selected={kind === option}
            onClick={() => pick(option)}
            className={cn(
              "h-8 rounded-[calc(var(--radius)-2px)] text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              kind === option ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t(`kinds.${option}`)}
          </button>
        ))}
      </div>

      <div role="radiogroup" aria-label={t(`kinds.${kind}`)} className="mx-4 mt-2 max-h-48 space-y-1 overflow-y-auto">
        {kind === "member" ? (
          colleagues.length === 0 ? (
            <p className="rounded-[--radius] border border-dashed border-border px-3 py-3 text-center text-xs text-muted-foreground">{t("noColleagues")}</p>
          ) : (
            colleagues.map((colleague) => (
              <TargetRow
                key={colleague.userId}
                selected={chosen?.kind === "member" && chosen.userId === colleague.userId}
                onSelect={() => setChosen({ kind: "member", userId: colleague.userId })}
                icon={<UserCircle className="h-4 w-4" aria-hidden />}
                title={colleague.username ?? colleague.userId}
              />
            ))
          )
        ) : queues === null ? (
          <p className="px-3 py-3 text-center text-xs text-muted-foreground">{t("loadingQueues")}</p>
        ) : queues.length === 0 ? (
          <p className="rounded-[--radius] border border-dashed border-border px-3 py-3 text-center text-xs text-muted-foreground">{t("noQueues")}</p>
        ) : (
          queues.map((queue) => (
            <TargetRow
              key={queue.id}
              selected={chosen?.kind === "queue" && chosen.queueId === queue.id}
              onSelect={() => setChosen({ kind: "queue", queueId: queue.id })}
              icon={<Headset className="h-4 w-4" aria-hidden />}
              title={queue.name}
              detail={t("queueLoad", { waiting: queue.waiting, ready: queue.ready })}
            />
          ))
        )}
      </div>

      <div className="px-4 pt-3">
        <ElevatedTextarea
          label={t("notes")}
          placeholder={t("notesPlaceholder")}
          value={notes}
          maxLength={MAX_TRANSFER_NOTES}
          onChange={(event) => setNotes(event.target.value)}
          autoResize
          maxHeight={120}
        />
        <p className="mt-1 text-right text-2xs tabular-nums text-muted-foreground">
          {notes.length}/{MAX_TRANSFER_NOTES}
        </p>
      </div>

      <div className="px-4 pb-4 pt-2">
        <button
          type="button"
          onClick={submit}
          disabled={!chosen}
          className={cn(CALL_ACTION, "bg-primary text-primary-foreground shadow-button hover:bg-primary-hover disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100 disabled:shadow-none")}
        >
          {t(kind === "member" ? "transferToColleague" : "transferToQueue")}
        </button>
        <p className="mt-2 text-xs text-muted-foreground">{t(kind === "member" ? "memberHint" : "queueHint")}</p>
      </div>
    </div>
  );
}

function TargetRow({
  selected,
  onSelect,
  icon,
  title,
  detail,
}: {
  selected: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  title: string;
  detail?: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-3 rounded-[--radius] border px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected ? "border-primary bg-muted" : "border-transparent hover:bg-muted",
      )}
    >
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">{title}</span>
        {detail ? <span className="block text-2xs text-muted-foreground">{detail}</span> : null}
      </span>
    </button>
  );
}
