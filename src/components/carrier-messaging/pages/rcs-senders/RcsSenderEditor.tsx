"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  createRcsSenderAction,
  deleteRcsSenderAction,
  setRcsSenderInboxAction,
  transitionRcsSenderAction,
  updateRcsSenderAction,
  type RcsSenderTransition,
} from "@/app/actions/rcs";
import { CarrierInboxSettingsPanel } from "@/components/carrier-messaging/shared/CarrierInboxSettings";
import { PanelSection } from "@/components/dashboard/PanelSection";
import Button from "@/components/elevated-design/button";
import { CircleNotch, FloppyDisk, Pause, PaperPlaneTilt, Play, Trash } from "@/components/icons";
import { SenderForm } from "@/components/rcs/senders/SenderForm";
import { SenderStatusTrack } from "@/components/rcs/senders/SenderStatusTrack";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { CodedRefusal } from "@/lib/api/coded-error";
import { useCarrierRefusalText } from "@/components/carrier-messaging/shared/use-carrier-error-text";
import { EMPTY_SENDER_INPUT, senderInputOf } from "@/lib/rcs/sender-form";
import type { CarrierInboxSettings } from "@/lib/carrier-messaging/types";
import type { RcsSender, RcsSenderInput } from "@/lib/rcs/types";

type Busy = "save" | RcsSenderTransition | "delete" | null;

export function RcsSenderEditor({
  sender,
  onSaved,
  onDeleted,
}: {
  sender: RcsSender | null;
  onSaved: (sender: RcsSender) => void;
  onDeleted: (senderId: string) => void;
}) {
  const t = useTranslations("carrierMessaging.pages.rcsSenders.editor");
  const refusalText = useCarrierRefusalText();
  const [input, setInput] = useState<RcsSenderInput>(() => (sender ? senderInputOf(sender) : EMPTY_SENDER_INPUT));
  const [current, setCurrent] = useState<RcsSender | null>(sender);
  const [refusal, setRefusal] = useState<CodedRefusal | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const editable = current ? current.editable : true;
  const currentId = current?.id ?? "";

  const saveInbox = useCallback((settings: CarrierInboxSettings) => setRcsSenderInboxAction(currentId, settings), [currentId]);

  const inboxSaved = useCallback(
    (settings: CarrierInboxSettings) => {
      setCurrent((previous) => {
        if (!previous) return previous;
        const next = { ...previous, ...settings };
        onSaved(next);
        return next;
      });
    },
    [onSaved],
  );

  const settle = (next: RcsSender, message: string) => {
    setCurrent(next);
    setInput(senderInputOf(next));
    setRefusal(null);
    onSaved(next);
    toast.success(message);
  };

  const save = async (): Promise<RcsSender | null> => {
    setBusy("save");
    const answer = current ? await updateRcsSenderAction(current.id, input) : await createRcsSenderAction(input);
    setBusy(null);
    if (answer.error) {
      setRefusal(answer.error);
      return null;
    }
    settle(answer.data, t("saved"));
    return answer.data;
  };

  const transition = async (kind: RcsSenderTransition) => {
    const saved = kind === "submit" ? await save() : current;
    if (!saved) return;
    setBusy(kind);
    const answer = await transitionRcsSenderAction(saved.id, kind);
    setBusy(null);
    if (answer.error) {
      setRefusal(answer.error);
      toast.error(refusalText(answer.error));
      return;
    }
    settle(answer.data, t(`done.${kind}`));
  };

  const remove = async () => {
    if (!current) return;
    setBusy("delete");
    const answer = await deleteRcsSenderAction(current.id);
    setBusy(null);
    if (answer.error) {
      toast.error(refusalText(answer.error));
      return false;
    }
    toast.success(t("deleted"));
    onDeleted(current.id);
  };

  const spinner = <CircleNotch className="h-4 w-4 animate-spin" />;

  const actions = (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
      <div className="flex flex-wrap items-center gap-2">
        {current?.status === "draft" ? (
          <ConfirmDialog
            trigger={<Button variant="ghost" title={t("delete")} icon={busy === "delete" ? spinner : <Trash className="h-4 w-4" />} iconVisible disabled={busy !== null} />}
            title={t("deleteTitle", { name: current.brand_name || t("untitled") })}
            description={t("deleteDescription")}
            confirmLabel={t("delete")}
            onConfirm={remove}
          />
        ) : null}
        {current?.status === "launched" ? (
          <ConfirmDialog
            tone="default"
            trigger={<Button variant="outline" title={t("pause")} icon={busy === "pause" ? spinner : <Pause className="h-4 w-4" />} iconVisible disabled={busy !== null} />}
            title={t("pauseTitle")}
            description={t("pauseDescription")}
            confirmLabel={t("pause")}
            onConfirm={() => transition("pause")}
          />
        ) : null}
        {current?.status === "paused" && current.can_resume ? (
          <Button variant="outline" title={t("resume")} icon={busy === "resume" ? spinner : <Play className="h-4 w-4" />} iconVisible disabled={busy !== null} onClick={() => void transition("resume")} />
        ) : null}
      </div>
      {editable ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" title={t("save")} icon={busy === "save" ? spinner : <FloppyDisk className="h-4 w-4" />} iconVisible disabled={busy !== null} onClick={() => void save()} />
          <Button title={t("submit")} icon={busy === "submit" ? spinner : <PaperPlaneTilt className="h-4 w-4" />} iconVisible disabled={busy !== null} onClick={() => void transition("submit")} />
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="space-y-8">
      {current ? (
        <PanelSection boxed title={t("trackTitle")} description={t("trackDescription")}>
          <SenderStatusTrack sender={current} />
        </PanelSection>
      ) : null}
      {current && !editable ? <p className="text-sm text-muted-foreground">{t("lockedHint")}</p> : null}
      <SenderForm
        value={input}
        onChange={setInput}
        error={refusal}
        suggestedDescription={current?.suggested_description}
        disabled={!editable || busy !== null}
        billingLocked={Boolean(current && !editable)}
        footer={actions}
      />
      {current ? (
        <PanelSection title={t("automationTitle")} description={t("automationDescription")}>
          <CarrierInboxSettingsPanel ownerId={current.id} settings={current} save={saveInbox} onSaved={inboxSaved} controlId="rcs-sender-inbox" />
        </PanelSection>
      ) : null}
    </div>
  );
}
