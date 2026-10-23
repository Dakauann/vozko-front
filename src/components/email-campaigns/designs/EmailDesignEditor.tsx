"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { createEmailCampaignAction, isEmailActionError, updateEmailDesignAction } from "@/app/actions/email-campaigns";
import { ScreenLoader } from "@/components/brand/screen-loader";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { EmailEditor } from "@/components/email-editor";
import Button from "@/components/elevated-design/button";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { Check, FloppyDisk, Files, PaperPlaneTilt } from "@/components/icons";
import { Notice } from "@/components/ui/notice";
import { useWorkspace } from "@/contexts/workspace-context";
import { emailCampaignsRoot, emailDesignsRoot, useEmailDesign } from "@/hooks/use-email-campaigns";
import { useLeadFieldDefinitions } from "@/hooks/use-lead-field-definitions";
import { sectionErrorCode } from "@/lib/analytics/section-query";
import { readableFields } from "@/lib/crm/custom-fields";
import type { CustomField } from "@/lib/email-design/merge-tags";
import type { Document, Issue } from "@/lib/email-design/types";
import { wizardHref } from "@/lib/email-campaigns/status";
import type { Design } from "@/lib/email-campaigns/types";

import { useEmailErrorMessage, useEmailFormat, useEmailPermission } from "../shared";
import { useEmailPreview } from "../wizard/use-preview";

function issuesOf(details: Record<string, unknown> | undefined): Issue[] {
  const raw = details?.issues;
  return Array.isArray(raw) ? (raw as Issue[]) : [];
}

function EditorBody({ design }: { design: Design }) {
  const t = useTranslations("emailCampaigns.designEditor");
  const router = useRouter();
  const client = useQueryClient();
  const allowed = useEmailPermission();
  const errorMessage = useEmailErrorMessage();
  const { dateTime } = useEmailFormat();
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id ?? "";
  const fields = useLeadFieldDefinitions();
  const [name, setName] = useState(design.name);
  const [document, setDocument] = useState<Document>(design.document);
  const [saved, setSaved] = useState({ name: design.name, document: design.document, at: design.updated_at });
  const [saving, setSaving] = useState(false);
  const [saveIssues, setSaveIssues] = useState<Issue[]>([]);
  const preview = useEmailPreview(document, undefined);
  const editable = allowed("update");
  const dirty = name !== saved.name || document !== saved.document;

  const customFields = useMemo<CustomField[]>(() => readableFields(fields.definitions).filter((field) => !field.sensitive).map((field) => ({ key: field.key, label: field.label })), [fields.definitions]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const save = async () => {
    setSaving(true);
    const result = await updateEmailDesignAction(design.id, { name: name.trim(), kind: design.kind, document, ...(design.thumbnail_url ? { thumbnail_url: design.thumbnail_url } : {}) });
    setSaving(false);
    if (isEmailActionError(result)) {
      setSaveIssues(issuesOf(result.details));
      toast.error(t("saveFailed"), { description: errorMessage(result) });
      return;
    }
    setSaveIssues([]);
    setSaved({ name: result.data.name, document, at: result.data.updated_at });
    client.setQueryData([...emailDesignsRoot(workspaceId), "design", design.id], result.data);
    void client.invalidateQueries({ queryKey: [...emailDesignsRoot(workspaceId), "list"] });
    toast.success(t("saved"));
  };

  const startCampaign = async () => {
    const created = await createEmailCampaignAction({ name: name.trim() || design.name, subject: "", document });
    if (isEmailActionError(created)) {
      toast.error(t("useFailed"), { description: errorMessage(created) });
      return;
    }
    await client.invalidateQueries({ queryKey: emailCampaignsRoot(workspaceId) });
    router.push(wizardHref(created.data.id));
  };

  const issues = saveIssues.length > 0 ? saveIssues : preview.issues;

  return (
    <main className="w-full space-y-4">
      <DashboardPageHeader
        icon={<Files className="h-6 w-6" weight="fill" />}
        badge={t("badge")}
        title={name.trim() || design.name}
        description={t("description")}
        back={{ onClick: () => router.push("/dashboard/email/designs"), label: t("back") }}
        meta={
          <span className="inline-flex items-center gap-1.5 text-2xs text-muted-foreground" aria-live="polite">
            {dirty ? t("unsaved") : (
              <>
                <Check className="h-3.5 w-3.5 text-healthy-ink" weight="bold" />
                {t("savedAt", { time: dateTime(saved.at) })}
              </>
            )}
          </span>
        }
        actions={
          <>
            {editable ? (
              <Button
                variant="primary"
                title={saving ? t("saving") : t("save")}
                icon={<FloppyDisk className="h-4 w-4" />}
                iconVisible
                iconSide="left"
                disabled={saving || !dirty || !name.trim()}
                onClick={() => void save()}
              />
            ) : null}
            {allowed("create") ? <Button variant="secondary" title={t("use")} icon={<PaperPlaneTilt className="h-4 w-4" />} iconVisible iconSide="left" onClick={() => void startCampaign()} /> : null}
          </>
        }
      />

      <div className="max-w-xl">
        <ElevatedInput label={t("name")} value={name} disabled={!editable} maxLength={120} onChange={(event) => setName(event.target.value)} />
      </div>

      <EmailEditor
        value={document}
        onChange={setDocument}
        issues={issues}
        hints={preview.hints}
        customFields={customFields}
        onRequestPreview={() => void preview.request()}
        previewHtml={preview.html}
        previewLoading={preview.loading}
        readOnly={!editable}
        agent={{ surface: "email_design", projectId: design.id, name: name.trim() || design.name }}
        className="h-[calc(100vh-12rem)] min-h-[640px]"
      />
    </main>
  );
}

export function EmailDesignEditor({ designId }: { designId: string }) {
  const t = useTranslations("emailCampaigns.designEditor");
  const errorMessage = useEmailErrorMessage();
  const design = useEmailDesign(designId);
  if (design.isPending) return <ScreenLoader fit="screen" />;
  if (design.isError || !design.data) {
    return (
      <main className="w-full space-y-4">
        <Notice tone="fault" title={t("loadFailed")}>
          <p>{errorMessage({ code: sectionErrorCode(design.error) })}</p>
          <Button variant="secondary" size="sm" title={t("back")} link="/dashboard/email/designs" newTab={false} />
        </Notice>
      </main>
    );
  }
  return <EditorBody key={design.data.id} design={design.data} />;
}
