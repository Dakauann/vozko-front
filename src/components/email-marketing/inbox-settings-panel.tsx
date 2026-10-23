"use client";

import { useCallback, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";

import { updateEmailInboxAction } from "@/app/actions/email-inboxes";
import { ChannelAutomationPanel, type ChannelAutomationPayload } from "@/components/channels/channel-automation-panel";
import { DepartmentAssignmentCard } from "@/components/dashboard/DepartmentAssignmentCard";
import { useEmailError } from "@/components/email-marketing/use-email-error";
import { Notice } from "@/components/ui/notice";
import { useWorkspace } from "@/contexts/workspace-context";
import { inboxSettingsOf, withInboxChange, type EmailInboxChange } from "@/lib/email/inbox-automation";
import type { EmailInbox } from "@/lib/email/types";

const NAMESPACE = "emailMarketing.inboxSettings";

type Saved = { inbox: EmailInbox } | { error: string };

export function EmailInboxSettingsPanel({ inbox, onSaved }: { inbox: EmailInbox; onSaved: (inbox: EmailInbox) => void }) {
  const t = useTranslations(NAMESPACE);
  const describe = useEmailError();
  const { can } = useWorkspace();
  const latest = useRef(inbox);
  useEffect(() => {
    latest.current = inbox;
  }, [inbox]);
  const canUpdate = can("email_inboxes", "update");

  const persist = useCallback(
    async (change: EmailInboxChange): Promise<Saved> => {
      const result = await updateEmailInboxAction(latest.current.id, withInboxChange(inboxSettingsOf(latest.current), change));
      if ("error" in result) return { error: describe(result) };
      if (!result.inbox) return { error: describe({}) };
      latest.current = result.inbox;
      onSaved(result.inbox);
      return { inbox: result.inbox };
    },
    [describe, onSaved],
  );

  const savePanel = useCallback(
    async (_inboxId: string, payload: ChannelAutomationPayload) => {
      const saved = await persist(payload);
      return "error" in saved ? { error: saved.error } : { account: saved.inbox };
    },
    [persist],
  );

  const assignDepartment = async (departmentId: string) => {
    const saved = await persist({ departmentId });
    return "error" in saved ? { error: saved.error, item: null } : { error: null, item: saved.inbox };
  };

  if (!can("email_inboxes", "read")) return null;

  return (
    <div className="space-y-4">
      {inbox.departmentId ? null : (
        <Notice tone="warning" title={t("noDepartmentTitle")}>
          <p>{t("noDepartmentBody")}</p>
        </Notice>
      )}
      {canUpdate ? <DepartmentAssignmentCard departmentId={inbox.departmentId} onAssign={assignDepartment} /> : null}
      <ChannelAutomationPanel<EmailInbox>
        account={inbox}
        onUpdated={() => undefined}
        onSave={savePanel}
        translationNamespace={NAMESPACE}
        controlId={`email-inbox-${inbox.id}`}
        showHandling
        dealEntryType="email"
        readOnly={!canUpdate}
      />
    </div>
  );
}
