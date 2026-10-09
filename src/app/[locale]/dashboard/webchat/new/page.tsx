"use client";

import { ArrowLeft, Warning } from "@/components/icons";
import { useState } from "react";

import { createWebchatWidgetAction } from "@/app/actions/webchat";
import { MAX_NAME_LENGTH, checkOrigins, webchatErrorKey } from "@/lib/webchat/types";

import { AllowedOriginsEditor } from "@/components/webchat/allowed-origins-editor";
import Button from "@/components/elevated-design/button";
import {
  ConnectBlock,
  ConnectFacts,
  ConnectIdentity,
  ConnectNotice,
  ConnectPanel,
  ConnectShell,
  ConnectTrack,
  ConnectTrackStep,
} from "@/components/channels/connect-layout";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { ElevatedSelect, ElevatedSelectItem } from "@/components/elevated-design/elevated-select";
import { WebchatLogoColor } from "@/components/icons/channel-logos";
import { useDepartment } from "@/contexts/department-context";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useWorkspace } from "@/contexts/workspace-context";

const NO_DEPARTMENT = "__none__";

export default function NewWebchatWidgetPage() {
  const t = useTranslations("webchat");
  const tDepartment = useTranslations("departmentAssignment");
  const router = useRouter();
  const { can } = useWorkspace();
  const { departments, currentDepartment } = useDepartment();

  const [name, setName] = useState("");
  const [origins, setOrigins] = useState<string[]>([""]);
  const [departmentChoice, setDepartmentChoice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canCreate = can("webchat_widgets", "create");
  const departmentId = departmentChoice ?? currentDepartment?.id ?? NO_DEPARTMENT;
  const originCheck = checkOrigins(origins);
  const nameMissing = name.trim() === "";
  const ready = canCreate && !nameMissing && originCheck.valid;

  const handleSubmit = async () => {
    setAttempted(true);
    if (!ready || submitting) return;

    setSubmitting(true);
    setError(null);
    const result = await createWebchatWidgetAction({
      name: name.trim(),
      allowedOrigins: originCheck.origins,
      departmentId: departmentId === NO_DEPARTMENT ? undefined : departmentId,
    });

    if ("error" in result || !result.widget) {
      setSubmitting(false);
      const key = "error" in result ? webchatErrorKey(result.code) : null;
      const message = key ? t(key) : "error" in result ? result.error : t("create.errorTitle");
      setError(message);
      toast.error(t("create.errorTitle"), { description: message });
      return;
    }

    toast(t("create.successTitle"), { description: t("create.successBody", { name: result.widget.name }) });
    router.push(`/dashboard/webchat/${result.widget.id}`);
  };

  const facts = [
    { term: t("create.facts.inbox.title"), detail: t("create.facts.inbox.description") },
    { term: t("create.facts.automation.title"), detail: t("create.facts.automation.description") },
    { term: t("create.facts.leads.title"), detail: t("create.facts.leads.description") },
  ];

  return (
    <ConnectShell>
      <ConnectBlock>
        <Button
          variant="ghost"
          title={t("create.back")}
          icon={<ArrowLeft weight="bold" className="h-4 w-4" />}
          iconVisible
          iconSide="left"
          onClick={() => router.push("/dashboard/webchat")}
        />
      </ConnectBlock>

      <ConnectIdentity
        logo={<WebchatLogoColor className="h-7 w-7" />}
        title={t("create.title")}
        lead={t("create.description")}
      />

      <ConnectPanel>
        <ConnectTrack>
          <ConnectTrackStep index={1} title={t("create.nameTitle")} text={t("create.nameHelp")}>
            <ElevatedInput
              type="text"
              label={t("create.nameLabel")}
              value={name}
              maxLength={MAX_NAME_LENGTH}
              onChange={(e) => setName(e.target.value)}
              error={attempted && nameMissing ? t("errors.name_required") : undefined}
              className="w-full"
            />
          </ConnectTrackStep>

          <ConnectTrackStep index={2} title={t("origins.title")} text={t("origins.help")}>
            <AllowedOriginsEditor rows={origins} onChange={setOrigins} showListIssue={attempted} />
          </ConnectTrackStep>

          {departments.length > 0 && (
            <ConnectTrackStep index={3} title={t("create.departmentTitle")} text={t("create.departmentHelp")}>
              <ElevatedSelect
                value={departmentId}
                onValueChange={setDepartmentChoice}
                label={tDepartment("selectLabel")}
                className="w-full sm:max-w-sm"
              >
                <ElevatedSelectItem value={NO_DEPARTMENT}>{tDepartment("allDepartments")}</ElevatedSelectItem>
                {departments
                  .filter((department) => department.id)
                  .map((department) => (
                    <ElevatedSelectItem key={department.id} value={department.id}>
                      {department.name}
                    </ElevatedSelectItem>
                  ))}
              </ElevatedSelect>
            </ConnectTrackStep>
          )}

          <ConnectTrackStep
            index={departments.length > 0 ? 4 : 3}
            isAction
            isLast
            title={t("create.actionTitle")}
            text={t("create.actionHelp")}
          >
            <div className="space-y-3">
              {error && (
                <p role="alert" className="flex items-start gap-1.5 text-xs leading-relaxed text-foreground">
                  <Warning weight="fill" className="mt-px size-3.5 shrink-0 text-destructive-ink" />
                  {error}
                </p>
              )}
              <Button
                variant="primary"
                size="lg"
                title={submitting ? t("create.submitting") : t("create.submit")}
                onClick={() => void handleSubmit()}
                disabled={!canCreate || submitting}
                aria-busy={submitting}
                className="w-full sm:w-auto sm:px-10"
              />
              {!canCreate && <p className="text-xs text-muted-foreground">{t("create.noPermission")}</p>}
            </div>
          </ConnectTrackStep>
        </ConnectTrack>
      </ConnectPanel>

      <ConnectBlock>
        <ConnectNotice tone="info">{t("create.note")}</ConnectNotice>
      </ConnectBlock>
      <ConnectFacts title={t("create.factsTitle")} items={facts} />
    </ConnectShell>
  );
}
