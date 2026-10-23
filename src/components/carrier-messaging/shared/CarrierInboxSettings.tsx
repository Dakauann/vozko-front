"use client";

import { useCallback, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";

import { AutomationDisclosureEditor } from "@/components/channels/automation-disclosure-editor";
import { ChannelAutomationPanel, type ChannelAutomationPayload } from "@/components/channels/channel-automation-panel";
import { DepartmentAssignmentCard } from "@/components/dashboard/DepartmentAssignmentCard";
import { Notice } from "@/components/ui/notice";
import { useWorkspace } from "@/contexts/workspace-context";
import type { ParsedAnswer } from "@/lib/api/parsed-request";
import { automationAccount, inboxSettingsOf, withInboxChange, type AutomationAccount } from "@/lib/carrier-messaging/automation";
import type { CarrierInboxSettings } from "@/lib/carrier-messaging/types";

import { useCarrierRefusalText } from "./use-carrier-error-text";

const NAMESPACE = "carrierMessaging.automation";

export function CarrierInboxSettingsPanel({
  ownerId,
  settings,
  save,
  onSaved,
  controlId,
}: {
  ownerId: string;
  settings: CarrierInboxSettings;
  save: (settings: CarrierInboxSettings) => Promise<ParsedAnswer<CarrierInboxSettings>>;
  onSaved: (settings: CarrierInboxSettings) => void;
  controlId: string;
}) {
  const t = useTranslations(NAMESPACE);
  const { can } = useWorkspace();
  const refusalText = useCarrierRefusalText();
  const latest = useRef(settings);
  useEffect(() => {
    latest.current = settings;
  }, [settings]);
  const canUpdate = can("carrier_inboxes", "update");

  const persist = useCallback(
    async (next: CarrierInboxSettings) => {
      const answer = await save(next);
      if (answer.error) return { error: refusalText(answer.error) };
      const saved = inboxSettingsOf(answer.data);
      latest.current = saved;
      onSaved(saved);
      return { settings: saved };
    },
    [save, onSaved, refusalText],
  );

  const savePanel = useCallback(
    async (_ownerId: string, payload: ChannelAutomationPayload) => {
      const result = await persist(withInboxChange(latest.current, payload));
      return "error" in result ? { error: result.error } : { account: automationAccount(ownerId, result.settings) };
    },
    [persist, ownerId],
  );

  const saveDisclosure = async (text: string) => {
    const result = await persist({ ...latest.current, automation: { ...latest.current.automation, disclosure: text } });
    return "error" in result ? { error: result.error } : { saved: result.settings.automation.disclosure };
  };

  const assignDepartment = async (departmentId: string) => {
    const result = await persist({ ...latest.current, department_id: departmentId });
    return "error" in result ? { error: result.error, item: null } : { error: null, item: result.settings };
  };

  if (!can("carrier_inboxes", "read")) return null;

  return (
    <div className="space-y-4">
      {settings.department_id ? null : (
        <Notice tone="warning" title={t("noDepartmentTitle")}>
          <p>{t("noDepartmentBody")}</p>
        </Notice>
      )}
      {canUpdate ? <DepartmentAssignmentCard departmentId={settings.department_id} onAssign={assignDepartment} /> : null}
      <ChannelAutomationPanel<AutomationAccount>
        account={automationAccount(ownerId, settings)}
        onUpdated={() => undefined}
        onSave={savePanel}
        translationNamespace={NAMESPACE}
        controlId={controlId}
        showHandling
        readOnly={!canUpdate}
      />
      <AutomationDisclosureEditor value={settings.automation.disclosure} translationNamespace={NAMESPACE} onSave={saveDisclosure} readOnly={!canUpdate} />
    </div>
  );
}
