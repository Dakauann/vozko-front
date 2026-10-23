"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { adminAssignSmsNumberAction, adminPauseCarrierSenderAction, adminReleaseSmsNumberAction, adminResumeCarrierSenderAction, type AdminPauseReason } from "@/app/actions/carrier-messaging";
import Button from "@/components/elevated-design/button";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { ElevatedSelect, ElevatedSelectItem } from "@/components/elevated-design/elevated-select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { CodedRefusal } from "@/lib/api/coded-error";
import { useCarrierRefusalText } from "@/components/carrier-messaging/shared/use-carrier-error-text";
import type { RcsSender } from "@/lib/rcs/types";
import type { SmsRoute } from "@/lib/sms/types";

export const ADMIN_PAUSE_REASONS: readonly AdminPauseReason[] = ["complaints", "opt_out_rate", "unpaid_balance", "manual"];

export function AdminSenderActions({ sender, onChanged, onRefused }: { sender: RcsSender; onChanged: (sender: RcsSender) => void; onRefused: (refusal: CodedRefusal) => void }) {
  const t = useTranslations("carrierMessaging.pages.admin.senders");
  const [reason, setReason] = useState<AdminPauseReason>("complaints");

  const pause = async () => {
    const answer = await adminPauseCarrierSenderAction(sender.id, reason);
    if (answer.error) {
      onRefused(answer.error);
      return false;
    }
    onChanged(answer.data);
  };

  const resume = async () => {
    const answer = await adminResumeCarrierSenderAction(sender.id);
    if (answer.error) {
      onRefused(answer.error);
      return false;
    }
    onChanged(answer.data);
  };

  if (sender.status === "launched") {
    return (
      <ConfirmDialog
        tone="default"
        trigger={<Button variant="outline" size="sm" title={t("pause")} />}
        title={t("pauseTitle", { name: sender.brand_name })}
        description={t("pauseDescription")}
        confirmLabel={t("pause")}
        onConfirm={pause}
      >
        <ElevatedSelect label={t("reason")} aria-label={t("reason")} value={reason} onValueChange={(next) => setReason(next as AdminPauseReason)} contentClassName="z-[210]">
          {ADMIN_PAUSE_REASONS.map((option) => (
            <ElevatedSelectItem key={option} value={option}>
              {t(`reasons.${option}`)}
            </ElevatedSelectItem>
          ))}
        </ElevatedSelect>
      </ConfirmDialog>
    );
  }

  if (sender.status === "paused") {
    return (
      <ConfirmDialog
        tone="default"
        trigger={<Button variant="outline" size="sm" title={t("resume")} />}
        title={t("resumeTitle", { name: sender.brand_name })}
        description={t("resumeDescription")}
        confirmLabel={t("resume")}
        onConfirm={resume}
      />
    );
  }

  return null;
}

export function AdminRouteActions({ route, onChanged }: { route: SmsRoute; onChanged: (route: SmsRoute) => void }) {
  const t = useTranslations("carrierMessaging.pages.admin.routes");
  const refusalText = useCarrierRefusalText();
  const [number, setNumber] = useState(route.number);
  const [refusal, setRefusal] = useState<CodedRefusal | null>(null);

  const assign = async () => {
    const answer = await adminAssignSmsNumberAction(route.id, number.trim());
    if (answer.error) {
      setRefusal(answer.error);
      return false;
    }
    setRefusal(null);
    onChanged(answer.data);
  };

  const release = async () => {
    const answer = await adminReleaseSmsNumberAction(route.id);
    if (answer.error) {
      setRefusal(answer.error);
      return false;
    }
    setRefusal(null);
    onChanged(answer.data);
  };

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      <ConfirmDialog
        tone="default"
        trigger={<Button variant="outline" size="sm" title={route.kind === "dedicated" ? t("changeNumber") : t("assign")} />}
        title={t("assignTitle", { prefix: route.brand_prefix })}
        description={t("assignDescription")}
        confirmLabel={t("assignConfirm")}
        confirmDisabled={!number.trim()}
        onConfirm={assign}
      >
        <ElevatedInput label={t("number")} inputMode="numeric" value={number} onChange={(event) => setNumber(event.target.value)} error={refusal ? refusalText(refusal) : undefined} />
      </ConfirmDialog>
      {route.kind === "dedicated" ? (
        <ConfirmDialog
          trigger={<Button variant="ghost" size="sm" title={t("release")} />}
          title={t("releaseTitle", { prefix: route.brand_prefix })}
          description={refusal ? refusalText(refusal) : t("releaseDescription")}
          confirmLabel={t("release")}
          onConfirm={release}
        />
      ) : null}
    </div>
  );
}
