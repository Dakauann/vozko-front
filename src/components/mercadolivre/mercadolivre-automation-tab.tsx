"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";

import { updateMercadoLivreAccountAction } from "@/app/actions/mercadolivre";
import { AutomationDisclosureEditor, type DisclosureCheck } from "@/components/channels/automation-disclosure-editor";
import { ChannelAutomationPanel, type ChannelAutomationPayload } from "@/components/channels/channel-automation-panel";
import { TextLimitFeedback } from "@/components/crm/TextLimitFeedback";
import { DepartmentAssignmentCard } from "@/components/dashboard/DepartmentAssignmentCard";
import { Notice } from "@/components/ui/notice";
import { textLimitState } from "@/lib/conversations/text-limit";
import { channelCapabilities } from "@/lib/conversations/types";
import type { MercadoLivreAccount } from "@/lib/mercadolivre/types";

import { useMercadoLivreError } from "./use-mercadolivre-error";

const DISCLOSURE_LIMIT = channelCapabilities.textLimit("mercadolivre");

function disclosureCheck(text: string): DisclosureCheck {
  const state = textLimitState(text, DISCLOSURE_LIMIT);
  return { blocked: state?.refused ?? true, feedback: <TextLimitFeedback state={state} /> };
}

export function MercadoLivreAutomationTab({
  account,
  canUpdate,
  onUpdated,
}: {
  account: MercadoLivreAccount;
  canUpdate: boolean;
  onUpdated: (account: MercadoLivreAccount) => void;
}) {
  const t = useTranslations("mercadolivre.automation");
  const describeError = useMercadoLivreError();

  const save = useCallback(
    async (accountId: string, payload: ChannelAutomationPayload) => {
      const result = await updateMercadoLivreAccountAction(accountId, payload);
      if ("error" in result) return { error: describeError(result) };
      return { account: result.account };
    },
    [describeError],
  );

  const saveDisclosure = async (text: string) => {
    const result = await updateMercadoLivreAccountAction(account.id, { automationDisclosure: text });
    if ("error" in result) return { error: describeError(result) };
    onUpdated(result.account);
    return { saved: result.account.automationDisclosure };
  };

  const assignDepartment = async (departmentId: string) => {
    const result = await updateMercadoLivreAccountAction(account.id, { departmentId });
    if ("error" in result) return { error: describeError(result), item: null };
    return { error: null, item: result.account };
  };

  return (
    <div className="space-y-6">
      <Notice tone="info" title={t("moderationTitle")}>
        <p>{t("moderationBody")}</p>
      </Notice>
      <ChannelAutomationPanel<MercadoLivreAccount>
        account={account}
        onUpdated={onUpdated}
        onSave={save}
        translationNamespace="mercadolivre.automation"
        controlId="ml-automation-enabled"
      />
      <AutomationDisclosureEditor
        value={account.automationDisclosure}
        translationNamespace="mercadolivre.automation"
        onSave={saveDisclosure}
        check={disclosureCheck}
      />
      {canUpdate ? (
        <DepartmentAssignmentCard
          departmentId={account.departmentId}
          onAssign={assignDepartment}
          onAssigned={(item) => {
            if (item) onUpdated(item as MercadoLivreAccount);
          }}
        />
      ) : null}
    </div>
  );
}
