"use client";

import { useId, useMemo, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";

import { InCallPanel } from "@/components/calls/in-call-panel";
import { CallStatusLine } from "@/components/calls/call-card";
import { OutcomeOptions, type OutcomeOption } from "@/components/crm/OutcomeOptions";
import Button from "@/components/elevated-design/button";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { ElevatedSelect, ElevatedSelectItem } from "@/components/elevated-design/elevated-select";
import ElevatedTextarea from "@/components/elevated-design/elevated-textarea";
import { CalendarBlank, ChatCircle, Check, Family, Phone, PhoneCall } from "@/components/icons";
import { DetailRow, DetailRows } from "@/components/leads/detail/DetailRow";
import { Notice } from "@/components/ui/notice";
import { useCallSession } from "@/contexts/call-session-context";
import { useWorkspace } from "@/contexts/workspace-context";
import { useAccess } from "@/hooks/use-access";
import { formatCallDuration } from "@/hooks/use-call-clock";
import { useCallReadiness } from "@/hooks/use-call-readiness";
import { useDialBlockerReason } from "@/hooks/use-dial-blocker-reason";
import { useOutcomeCapture } from "@/hooks/use-outcome-capture";
import { Link } from "@/i18n/routing";
import { requestCall, useCallSurfaceClaim, useCallSurfaceOwner } from "@/lib/call-session/call-session-control";
import { CALLBACK_DISPOSITION, type CallList } from "@/lib/call-lists/types";
import { closeBlocker, listDialBlocker, reservationLive } from "@/lib/call-lists/work";
import { conversationHref, isEntryId, isEntryType } from "@/lib/conversations/deep-link";
import { callOutcome, dialerErrorCode } from "@/lib/dialer/dial-string";
import { pickTrunk, rememberTrunk, useRememberedTrunk } from "@/lib/dialer/dial-lines";
import { initials } from "@/lib/format/initials";
import { fromLocalDateTimeInput, toLocalDateTimeInput } from "@/lib/format/local-datetime";
import { pathForScreen } from "@/lib/navigation/routes";
import { formatPhoneForDisplay } from "@/lib/phone/display";
import { cn } from "@/lib/utils";

import { useCallListError, useCallListPhoneLabel } from "./CallListBits";
import { CallListQueue } from "./CallListQueue";
import { useCallListWork, type CallListWork, type WorkCard } from "./use-call-list-work";

const NOTE_MAX = 2000;

interface Draft {
  disposition: string;
  callbackAt: string;
  note: string;
}

const EMPTY_DRAFT: Draft = { disposition: "", callbackAt: "", note: "" };

export function CallListWorkArea({ list, userId }: { list: CallList; userId: string }) {
  const serving = list.status === "active";
  const work = useCallListWork({ listId: list.id, userId, serving });
  const shown = serving || work.card !== null;

  useCallSurfaceClaim("call_list", shown);

  return (
    <div className={cn("grid items-start gap-4", shown ? "lg:grid-cols-[1.25fr_1fr]" : null)}>
      {shown ? <CallListWorkPanel list={list} userId={userId} work={work} /> : null}
      <CallListQueue listId={list.id} userId={userId} />
    </div>
  );
}

function CallListWorkPanel({ list, userId, work }: { list: CallList; userId: string; work: CallListWork }) {
  const t = useTranslations("callLists");
  const errorText = useCallListError();
  const { callState } = useCallSession();
  const surfaceOwner = useCallSurfaceOwner();
  const { card, notice, failure, busy } = work;
  const otherCall = callState !== null && surfaceOwner === "call_list" && !work.ours;

  return (
    <section aria-labelledby="call-list-next-title" className="overflow-hidden rounded-[--radius] border border-border bg-card">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-4 py-3">
        <h2 id="call-list-next-title" className="font-display text-base font-semibold text-foreground">
          {t("next.title")}
        </h2>
        {card ? <ReservationMeta card={card} userId={userId} now={work.now} /> : null}
      </header>
      {otherCall ? (
        <div className="border-b border-border">
          <InCallPanel />
        </div>
      ) : null}
      <div className="grid gap-3 px-4 py-4">
        {card ? (
          <WorkItem key={card.item.id} card={card} list={list} work={work} />
        ) : work.serving ? (
          <div className="flex flex-col items-start gap-3">
            {busy === "restore" || busy === "next" ? (
              <p role="status" className="text-sm text-muted-foreground">
                {t("next.loading")}
              </p>
            ) : notice?.empty ? (
              <div role="status" className="space-y-1">
                <p className="text-sm font-medium text-foreground">{notice.more ? t("next.more") : t("next.empty")}</p>
                {notice.more ? null : <p className="text-xs text-muted-foreground">{t("next.emptyHint")}</p>}
              </div>
            ) : null}
            {notice && notice.refused > 0 ? <p className="text-xs text-muted-foreground">{t("next.refused", { count: notice.refused })}</p> : null}
            <Button
              variant={notice?.empty && !notice.more ? "secondary" : "primary"}
              title={t("next.start")}
              onClick={() => void work.claim()}
              disabled={busy !== null}
            />
          </div>
        ) : null}
        {failure ? (
          <p role="alert" className="text-sm text-destructive-ink">
            {errorText(failure)}
          </p>
        ) : null}
      </div>
    </section>
  );
}

function ReservationMeta({ card, userId, now }: { card: WorkCard; userId: string; now: Date }) {
  const t = useTranslations("callLists.next");
  const format = useFormatter();
  const until = card.item.reservedUntil ? new Date(card.item.reservedUntil) : null;
  if (!until || !reservationLive(card.item, userId, now)) return <span className="legend">{t("expired")}</span>;
  return <span className="legend">{t("reservedUntil", { time: format.dateTime(until, { timeStyle: "short" }) })}</span>;
}

function WorkItem({ card, list, work }: { card: WorkCard; list: CallList; work: CallListWork }) {
  const t = useTranslations("callLists");
  const tDialer = useTranslations("calling.dialer");
  const format = useFormatter();
  const reasonId = useId();
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id ?? "";
  const { canOpenPath } = useAccess();
  const { callState } = useCallSession();
  const surfaceOwner = useCallSurfaceOwner();
  const readiness = useCallReadiness();
  const phoneLabel = useCallListPhoneLabel();
  const { capture, loaded } = useOutcomeCapture(workspaceId || undefined);
  const { item, lead } = card;

  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [chosenTrunk, setChosenTrunk] = useState<string | null>(null);
  const remembered = useRememberedTrunk(workspaceId);
  const trunk = pickTrunk(card.trunks, chosenTrunk, remembered);

  const stage = work.stage;
  const dialBlocker = stage === "calling" ? "busy" : listDialBlocker({ readiness: readiness.blocker, trunks: card.trunks, trunkRefusal: card.trunkRefusal, trunk });
  const dialReason = useDialBlockerReason(dialBlocker);
  const blocker = closeBlocker({ item, anyLive: work.anyLive, disposition: draft.disposition, callbackAt: draft.callbackAt });
  const firstCall = !item.lastCallId && work.dial === null;

  const outcomes = useMemo<OutcomeOption[]>(() => {
    const catalogue = [...(capture?.outcomes ?? [])].sort((a, b) => a.position - b.position).map((o) => ({ code: o.code, label: o.label }));
    return [...catalogue, { code: CALLBACK_DISPOSITION, label: t("outcome.callback"), icon: <CalendarBlank /> }];
  }, [capture?.outcomes, t]);
  const noCatalogue = loaded && (capture?.outcomes?.length ?? 0) === 0;

  const dial = () => {
    if (dialBlocker || !trunk) return;
    const requestId = work.startDial(item);
    requestCall({ phoneNumber: item.phone, trunkId: trunk.id, leadId: item.leadId, callListItemId: item.id, requestId, label: trunk.name });
  };

  const save = async () => {
    if (blocker || work.busy) return;
    const callbackAt = draft.disposition === CALLBACK_DISPOSITION ? fromLocalDateTimeInput(draft.callbackAt)?.toISOString() : undefined;
    const note = draft.note.trim();
    const serving = work.serving;
    const saved = await work.close({ disposition: draft.disposition, ...(note ? { note } : {}), ...(callbackAt ? { callbackAt } : {}) });
    if (saved && !serving) toast.success(t("saved"));
  };

  const release = async () => {
    if (await work.release()) toast.success(t("released"));
  };

  const leadPath = pathForScreen("lead_detail", { leadId: item.leadId });
  const name = lead?.name || item.leadName;
  const area = [lead?.district, lead?.city].filter(Boolean).join(" · ");
  const showPanel = work.ours && callState !== null && surfaceOwner === "call_list";
  const notStartedCode = dialerErrorCode(work.ended?.reason ?? null);
  const notStartedCause = notStartedCode && notStartedCode !== "call_list_item_unavailable" && notStartedCode !== "dial_failed" ? notStartedCode : null;
  const interaction = card.lastInteraction;
  const conversationPath =
    interaction && isEntryId(interaction.entryId) && isEntryType(interaction.entryType) ? conversationHref(interaction.entryId, interaction.entryType) : null;
  const interactionText = interaction
    ? t("next.lastInteractionValue", { date: format.dateTime(new Date(interaction.at), { dateStyle: "short", timeStyle: "short" }) })
    : null;

  return (
    <>
      <div className="flex items-center gap-3">
        <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-foreground">
          {initials(name)}
        </span>
        <div className="min-w-0">
          <p className={cn("truncate font-display text-lg font-semibold", name ? "text-foreground" : "text-muted-foreground")}>{name || t("next.noName")}</p>
          {area ? <p className="truncate text-sm text-muted-foreground">{area}</p> : null}
        </div>
        {leadPath && canOpenPath(leadPath) ? (
          <Link href={leadPath} className="ml-auto shrink-0 text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
            {t("next.openLead")}
          </Link>
        ) : null}
      </div>

      {lead ? (
        <DetailRows>
          <DetailRow icon={<Family />} label={t("next.family")}>
            {t("next.familyCount", { count: lead.familyCount })}
          </DetailRow>
          <DetailRow icon={<ChatCircle />} label={t("next.lastInteraction")}>
            {interactionText && conversationPath ? (
              <Link
                href={conversationPath}
                title={t("next.openConversation")}
                className="underline-offset-2 hover:underline focus-visible:rounded-[--radius] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {interactionText}
              </Link>
            ) : interactionText ? (
              interactionText
            ) : (
              <span className="font-normal text-muted-foreground">{t("next.noInteraction")}</span>
            )}
          </DetailRow>
        </DetailRows>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-[--radius] border border-border px-3 py-2">
          <p className="text-xs text-muted-foreground">{t("next.number")}</p>
          <p className="font-mono text-sm text-foreground">{formatPhoneForDisplay(item.phone)}</p>
          <p className="text-xs text-muted-foreground">{phoneLabel(list)}</p>
        </div>
        {work.serving && card.trunks.length > 0 ? (
          <ElevatedSelect
            label={t("next.line")}
            aria-label={t("next.line")}
            value={trunk?.id ?? ""}
            onValueChange={(id) => {
              setChosenTrunk(id);
              if (workspaceId) rememberTrunk(workspaceId, id);
            }}
            disabled={stage === "calling"}
          >
            {card.trunks.map((option) => (
              <ElevatedSelectItem key={option.id} value={option.id}>
                {option.name}
              </ElevatedSelectItem>
            ))}
          </ElevatedSelect>
        ) : null}
      </div>

      {work.serving && stage !== "calling" ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={stage === "ended" ? "secondary" : "primary"}
            title={firstCall ? t("call.call") : t("call.again")}
            icon={<Phone className="h-4 w-4" />}
            iconVisible
            iconSide="left"
            aria-disabled={dialBlocker !== null}
            aria-describedby={dialReason ? `${reasonId}-dial` : undefined}
            onClick={dial}
          />
          {dialReason ? (
            <span id={`${reasonId}-dial`} className="text-xs text-muted-foreground">
              {dialReason}
            </span>
          ) : null}
        </div>
      ) : null}

      {stage === "calling" && !showPanel ? <p className="text-sm text-muted-foreground">{t("call.inDialer")}</p> : null}
      {showPanel ? (
        <div className="-mx-4 border-y border-border">
          <InCallPanel via={trunk?.name ?? null} />
        </div>
      ) : null}

      {stage === "ended" && !showPanel ? (
        <Notice tone="healthy" icon={<PhoneCall />} className="items-center">
          {work.ended?.reason ? (
            <CallStatusLine
              tone="ended"
              label={`${t("call.ended")} · ${tDialer(`outcome.${callOutcome(work.ended.reason)}`)}`}
              trailing={work.ended.durationSeconds ? formatCallDuration(work.ended.durationSeconds) : null}
            />
          ) : (
            <p className="text-sm font-medium text-foreground">{t("call.stamped")}</p>
          )}
          <p>{t("call.technical")}</p>
        </Notice>
      ) : null}
      {stage === "lost" ? (
        <Notice tone="warning">
          <p className="text-sm text-foreground">{item.closable ? t("call.lostStamped") : t("call.lostNotStamped")}</p>
        </Notice>
      ) : null}
      {stage === "notStarted" ? (
        <Notice tone="neutral">
          <p className="text-sm text-foreground">
            {work.ended?.reason === "call_list_item_unavailable" ? tDialer("errors.call_list_item_unavailable") : t("call.notStarted")}
          </p>
          {notStartedCause ? <p className="text-sm text-muted-foreground">{tDialer(`errors.${notStartedCause}`)}</p> : null}
        </Notice>
      ) : null}

      <div className="space-y-2">
        <p className="legend">{t("outcome.title")}</p>
        {noCatalogue ? (
          <p className="text-sm text-muted-foreground">{t("outcome.noCatalogue")}</p>
        ) : !loaded ? (
          <p className="text-sm text-muted-foreground">{t("outcome.loading")}</p>
        ) : (
          <OutcomeOptions
            label={t("outcome.title")}
            layout="chips"
            outcomes={outcomes}
            selected={draft.disposition}
            onSelect={(disposition) => {
              setDraft((current) => ({ ...current, disposition }));
              work.clearFailure();
            }}
            disabled={work.busy !== null}
          />
        )}
        {draft.disposition === CALLBACK_DISPOSITION ? (
          <ElevatedInput
            type="datetime-local"
            label={t("outcome.callbackAt")}
            placeholder=" "
            min={toLocalDateTimeInput(work.now)}
            value={draft.callbackAt}
            onChange={(event) => setDraft((current) => ({ ...current, callbackAt: event.target.value }))}
          />
        ) : null}
      </div>

      <ElevatedTextarea
        label={t("outcome.note")}
        placeholder=" "
        maxLength={NOTE_MAX}
        rows={2}
        value={draft.note}
        onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))}
      />

      <div className="flex flex-wrap items-center justify-end gap-2">
        {blocker ? (
          <span id={`${reasonId}-save`} className="mr-auto text-xs text-muted-foreground">
            {t(`blockers.${blocker}`)}
          </span>
        ) : null}
        <Button
          variant="ghost"
          title={work.busy === "release" ? t("releasing") : t("release")}
          onClick={() => void release()}
          disabled={work.busy !== null || stage === "calling"}
        />
        <Button
          variant="primary"
          title={work.busy === "close" ? t("saving") : work.serving ? t("save") : t("saveOnly")}
          icon={<Check className="h-4 w-4" weight="bold" />}
          iconVisible
          iconSide="left"
          aria-disabled={blocker !== null || work.busy !== null}
          aria-describedby={blocker ? `${reasonId}-save` : undefined}
          onClick={() => void save()}
        />
      </div>
    </>
  );
}
