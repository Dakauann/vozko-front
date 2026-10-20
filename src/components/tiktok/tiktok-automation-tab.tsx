"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";

import { updateTiktokAccountAction } from "@/app/actions/tiktok";
import { AutomationDisclosureEditor, type DisclosureCheck } from "@/components/channels/automation-disclosure-editor";
import { ChannelAutomationPanel, type ChannelAutomationPayload } from "@/components/channels/channel-automation-panel";
import { TextLimitFeedback } from "@/components/crm/TextLimitFeedback";
import { DepartmentAssignmentCard } from "@/components/dashboard/DepartmentAssignmentCard";
import { Notice } from "@/components/ui/notice";
import { textLimitState } from "@/lib/conversations/text-limit";
import { TIKTOK_DISCLOSURE_LIMIT, TIKTOK_ENTRY_TYPE } from "@/lib/tiktok/channel";
import type { TiktokAccount } from "@/lib/tiktok/types";

import type { TiktokAccountTabProps } from "./tiktok-account-tabs";
import { useTiktokError } from "./use-tiktok-error";

function disclosureCheck(text: string): DisclosureCheck {
  const state = textLimitState(text, TIKTOK_DISCLOSURE_LIMIT);
  return { blocked: state?.refused ?? true, feedback: <TextLimitFeedback state={state} /> };
}

export function TiktokAutomationTab({ account, canUpdate, onUpdated }: TiktokAccountTabProps) {
  const t = useTranslations("tiktok.automation");
  const describeError = useTiktokError();

  const save = useCallback(
    async (accountId: string, payload: ChannelAutomationPayload) => {
      const result = await updateTiktokAccountAction(accountId, payload);
      if ("error" in result) return { error: describeError(result) };
      return { account: result.account };
    },
    [describeError],
  );

  const saveDisclosure = async (text: string) => {
    const result = await updateTiktokAccountAction(account.id, { automationDisclosure: text });
    if ("error" in result) return { error: describeError(result) };
    onUpdated(result.account);
    return { saved: result.account.automationDisclosure };
  };

  const assignDepartment = async (departmentId: string) => {
    const result = await updateTiktokAccountAction(account.id, { departmentId });
    if ("error" in result) return { error: describeError(result), item: null };
    return { error: null, item: result.account };
  };

  return (
    <div className="space-y-6">
      <Notice tone="info" title={t("keywordRepliesTitle")}>
        <p>{t("keywordRepliesBody")}</p>
      </Notice>
      <ChannelAutomationPanel<TiktokAccount>
        account={account}
        onUpdated={onUpdated}
        onSave={save}
        translationNamespace="tiktok.automation"
        controlId="tiktok-automation-enabled"
        showHandling
        dealEntryType={TIKTOK_ENTRY_TYPE}
      />
      <AutomationDisclosureEditor
        value={account.automationDisclosure}
        translationNamespace="tiktok.automation"
        onSave={saveDisclosure}
        check={disclosureCheck}
      />
      {canUpdate ? (
        <DepartmentAssignmentCard
          departmentId={account.departmentId}
          onAssign={assignDepartment}
          onAssigned={(item) => {
            if (item) onUpdated(item as TiktokAccount);
          }}
        />
      ) : null}
    </div>
  );
}
