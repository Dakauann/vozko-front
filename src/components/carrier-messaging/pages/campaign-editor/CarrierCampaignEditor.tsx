"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { createCarrierCampaignAction, transitionCarrierCampaignAction, updateCarrierCampaignAction } from "@/app/actions/carrier-messaging";
import { listRcsSendersAction } from "@/app/actions/rcs";
import { listSmsRoutesAction } from "@/app/actions/sms";
import Button from "@/components/elevated-design/button";
import { ElevatedStepFlow, type ElevatedStepFlowStep } from "@/components/elevated-design/elevated-step-flow";
import { ArrowLeft, ArrowRight, CircleNotch, FloppyDisk } from "@/components/icons";
import type { SendMode } from "@/components/campaign-wizard/SendStep";
import type { RcsMediaPicker } from "@/components/rcs/composer/composer-context";
import { Notice } from "@/components/ui/notice";
import type { CodedRefusal } from "@/lib/api/coded-error";
import { audienceAlreadyConfirmed, type AudienceConfirmation, audienceNeedsConfirmation, type Campaign, type CampaignDraft, confirmedAudience, emptyCampaignDraft } from "@/lib/carrier-messaging/campaigns";
import { useCarrierRefusalText } from "@/components/carrier-messaging/shared/use-carrier-error-text";
import type { ParsedAnswer } from "@/lib/api/parsed-request";
import type { RcsSender } from "@/lib/rcs/types";
import type { SmsRoute } from "@/lib/sms/types";
import { browserTimezone } from "@/lib/working-hours/types";

import { AudienceStep } from "./AudienceStep";
import { ChannelStep } from "./ChannelStep";
import { CarrierSendStep } from "./CarrierSendStep";
import { draftOf, editorSteps, withChannel, withoutSchedule, type EditorStep } from "./editor-state";
import { FallbackStep, type WhatsAppTemplateSlot } from "./FallbackStep";
import { MessageStep } from "./MessageStep";
import { ReviewStep } from "./ReviewStep";
import { useCarrierChannels } from "@/lib/carrier-messaging/use-carrier-channels";
import { useLoaded } from "@/lib/carrier-messaging/use-loaded";

function loadSenders(signal: AbortSignal): Promise<ParsedAnswer<RcsSender[]>> {
  return listRcsSendersAction(signal).then((answer) => (answer.error ? answer : { data: answer.data.senders, error: null }));
}

function loadNoSenders(): Promise<ParsedAnswer<RcsSender[]>> {
  return Promise.resolve({ data: [], error: null });
}

function loadNoRoutes(): Promise<ParsedAnswer<SmsRoute[]>> {
  return Promise.resolve({ data: [], error: null });
}

function loadRoutes(signal: AbortSignal): Promise<ParsedAnswer<SmsRoute[]>> {
  return listSmsRoutesAction(signal).then((answer) => (answer.error ? answer : { data: answer.data.routes, error: null }));
}

const AUDIENCE_RECOUNT_CODES = new Set(["carrier_campaign_audience_changed", "carrier_campaign_audience_unconfirmed"]);

export function CarrierCampaignEditor({
  initial,
  onSaved,
  onLaunched,
  whatsappTemplateSlot,
  onPickMedia,
}: {
  initial?: Campaign;
  onSaved?: (campaign: Campaign) => void;
  onLaunched?: (campaign: Campaign) => void;
  whatsappTemplateSlot?: WhatsAppTemplateSlot;
  onPickMedia?: RcsMediaPicker;
}) {
  const t = useTranslations("carrierMessaging.pages.campaignEditor");
  const refusalText = useCarrierRefusalText();
  const [timezone] = useState(browserTimezone);
  const channels = useCarrierChannels();
  const rcsLaunched = channels.launched("rcs");
  const smsLaunched = channels.launched("sms");
  const [draft, setDraft] = useState<CampaignDraft>(() => (initial ? draftOf(initial) : emptyCampaignDraft(rcsLaunched && !smsLaunched ? "rcs" : "sms")));
  const [campaignId, setCampaignId] = useState<string | null>(initial?.id ?? null);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState<"save" | "launch" | null>(null);
  const [refusal, setRefusal] = useState<CodedRefusal | null>(null);
  const [confirmation, setConfirmation] = useState<AudienceConfirmation | null>(null);
  const [estimateKey, setEstimateKey] = useState(0);
  const scheduled = initial?.status === "scheduled";
  const [sendMode, setSendMode] = useState<SendMode>(scheduled ? "schedule" : "now");
  const senders = useLoaded(rcsLaunched ? loadSenders : loadNoSenders, String(rcsLaunched));
  const channelSoon = !channels.launched(draft.channel);
  const routes = useLoaded(smsLaunched ? loadRoutes : loadNoRoutes, String(smsLaunched));

  const ids = editorSteps(draft.channel);
  const current = Math.min(step, ids.length - 1);
  const activeId: EditorStep = ids[current];
  const isLast = current === ids.length - 1;
  const routeList = routes.status === "ready" ? routes.data : [];
  const senderList = senders.status === "ready" ? senders.data : [];
  const sender = draft.channel === "rcs" ? senderList.find((candidate) => candidate.id === draft.sender_id) ?? null : null;
  const route = draft.channel === "sms" ? routeList.find((candidate) => candidate.id === draft.sender_id) ?? null : null;
  const senderName = sender?.brand_name ?? (route ? t("sender.prefix", { prefix: route.brand_prefix }) : null);

  const steps: ElevatedStepFlowStep[] = useMemo(
    () => ids.map((id) => ({ id, title: t(`steps.${id}.title`), description: t(`steps.${id}.description`), caption: t(`steps.${id}.caption`) })),
    [ids, t],
  );

  const persist = async (next: CampaignDraft): Promise<Campaign | null> => {
    const answer = campaignId ? await updateCarrierCampaignAction(campaignId, next) : await createCarrierCampaignAction(next);
    if (answer.error) {
      setRefusal(answer.error);
      return null;
    }
    setDraft(next);
    setCampaignId(answer.data.id);
    onSaved?.(answer.data);
    return answer.data;
  };

  const save = async (): Promise<Campaign | null> => {
    setBusy("save");
    setRefusal(null);
    const saved = await persist(draft);
    setBusy(null);
    return saved;
  };

  const next = async () => {
    if (ids[current + 1] === "review") {
      if (!(await save())) return;
      setConfirmation(null);
    }
    setStep(current + 1);
  };

  const audience = draft.audience;
  const countConfirmed = !audienceNeedsConfirmation(audience) || confirmation !== null;

  const confirmAudience = async (id: string): Promise<boolean> => {
    if (!audience || !audienceNeedsConfirmation(audience) || !confirmation || audienceAlreadyConfirmed(audience, confirmation)) return true;
    const confirmed = confirmedAudience(audience, confirmation);
    const answer = await updateCarrierCampaignAction(id, { audience: confirmed });
    if (answer.error) {
      setRefusal(answer.error);
      return false;
    }
    setDraft({ ...draft, audience: confirmed });
    return true;
  };

  const finish = async (transition: "launch" | "ready", next: CampaignDraft): Promise<boolean> => {
    if (!campaignId || !countConfirmed) return false;
    setBusy("launch");
    setRefusal(null);
    const saved = await persist(next);
    if (!saved || !(await confirmAudience(saved.id))) {
      setBusy(null);
      return false;
    }
    const answer = await transitionCarrierCampaignAction(saved.id, transition);
    setBusy(null);
    if (answer.error) {
      setRefusal(answer.error);
      if (AUDIENCE_RECOUNT_CODES.has(answer.error.code ?? "")) {
        setConfirmation(null);
        setEstimateKey((key) => key + 1);
      }
      return false;
    }
    onLaunched?.(answer.data);
    return true;
  };

  const launch = () => finish("launch", sendMode === "now" ? withoutSchedule(draft) : draft);
  const leaveReady = () => finish("ready", withoutSchedule(draft));

  return (
    <div className="w-full max-w-5xl space-y-3">
      <ElevatedStepFlow
        steps={steps}
        currentStep={current}
        onStepClick={(index) => {
          if (index < current) setStep(index);
        }}
        editLabel={t("nav.edit")}
        actions={
          <>
            {isLast ? null : (
              <Button
                title={busy === "save" ? t("nav.saving") : ids[current + 1] === "review" ? t("nav.review") : t("nav.next")}
                icon={busy === "save" ? <CircleNotch className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" weight="bold" />}
                iconVisible
                iconSide={busy === "save" ? "left" : "right"}
                disabled={busy !== null || channelSoon}
                onClick={() => void next()}
              />
            )}
            {current > 0 ? (
              <Button variant="ghost" title={t("nav.back")} icon={<ArrowLeft className="h-4 w-4" weight="bold" />} iconVisible iconSide="left" disabled={busy !== null} onClick={() => setStep(current - 1)} />
            ) : null}
            {!isLast ? (
              <Button variant="ghost" title={t("nav.saveDraft")} icon={<FloppyDisk className="h-4 w-4" />} iconVisible iconSide="left" disabled={busy !== null || channelSoon} onClick={() => void save()} />
            ) : null}
          </>
        }
      >
        {activeId === "channel" ? (
          <ChannelStep draft={draft} onChannel={(channel) => setDraft(withChannel(draft, channel))} onChange={setDraft} senders={senders} routes={routes} launched={channels.launched} />
        ) : null}
        {activeId === "message" ? (
          <MessageStep
            draft={draft}
            onChange={setDraft}
            agent={{ name: sender?.brand_name ?? "", logoUrl: sender?.logo_url || undefined, color: sender?.color, description: sender?.description }}
            route={route}
            onPickMedia={onPickMedia}
          />
        ) : null}
        {activeId === "fallback" ? <FallbackStep draft={draft} onChange={setDraft} routes={routeList} whatsappTemplateSlot={whatsappTemplateSlot} smsComingSoon={!smsLaunched} /> : null}
        {activeId === "audience" ? <AudienceStep audience={draft.audience} kind={draft.kind} campaignId={campaignId} onChange={(audience) => setDraft((current) => ({ ...current, audience }))} /> : null}
        {activeId === "review" && campaignId ? <ReviewStep campaignId={campaignId} draft={draft} senderName={senderName} confirmation={confirmation} onConfirm={setConfirmation} refreshKey={estimateKey} /> : null}
        {activeId === "send" ? (
          <CarrierSendStep
            draft={draft}
            onChange={setDraft}
            timezone={timezone}
            scheduled={scheduled}
            mode={sendMode}
            onModeChange={setSendMode}
            senderName={senderName}
            blocking={campaignId && countConfirmed ? 0 : 1}
            available={!channelSoon && busy === null}
            launching={busy === "launch"}
            refused={refusal ? [{ key: refusal.code ?? "refused", text: refusalText(refusal) }] : []}
            onLaunch={launch}
            onReady={leaveReady}
          />
        ) : null}
      </ElevatedStepFlow>
      {refusal && activeId !== "send" ? (
        <Notice tone="fault" title={t("refusedTitle")}>
          <p>{refusalText(refusal)}</p>
        </Notice>
      ) : null}
    </div>
  );
}
