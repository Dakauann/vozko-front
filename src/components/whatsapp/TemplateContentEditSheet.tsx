"use client";

import { useState, type ReactNode } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";

import { editWhatsAppTemplateContentAction } from "@/app/actions/whatsapp-templates";
import { PanelSection } from "@/components/dashboard/PanelSection";
import Button from "@/components/elevated-design/button";
import {
  ElevatedSheet,
  ElevatedSheetContent,
  ElevatedSheetDescription,
  ElevatedSheetFooter,
  ElevatedSheetHeader,
  ElevatedSheetTitle,
} from "@/components/elevated-design/elevated-sheet";
import { ElevatedSelect, ElevatedSelectItem } from "@/components/elevated-design/elevated-select";
import { StatusChip } from "@/components/elevated-design/status-chip";
import { CheckCircle, CircleNotch } from "@/components/icons";
import { Notice } from "@/components/ui/notice";
import type { DraggableComponent } from "@/components/whatsapp/DragDropBuilder";
import { TemplateErrorBanner } from "@/components/whatsapp/TemplateErrorBanner";
import { TemplateDraftPreview } from "@/components/whatsapp/builder/TemplateDraftPreview";
import { TemplateGuidelines } from "@/components/whatsapp/builder/TemplateGuidelines";
import { BUILDER_PROBLEMS_ANCHOR, TemplateMessageSection } from "@/components/whatsapp/builder/TemplateMessageSection";
import { useTemplateDraft } from "@/components/whatsapp/builder/use-template-draft";
import { useWorkspace } from "@/contexts/workspace-context";
import { ExitReadFailure } from "@/components/whatsapp/exit/ExitReadFailure";
import { MarketingExitDialog } from "@/components/whatsapp/exit/MarketingExitDialog";
import { useTemplateButtonActions } from "@/components/whatsapp/exit/use-template-exit";
import { CONTENT_EDIT_CATEGORIES, categoryLockedOnEdit } from "@/lib/whatsapp-templates/content-edit";
import { replacedHeaderMedia, toDraftComponents, toTemplateComponents } from "@/lib/whatsapp-templates/draft";
import { templateEditErrorMessage } from "@/lib/whatsapp-templates/errors";
import { MARKETING_TEMPLATE_NEEDS_EXIT, templateExitMissing } from "@/lib/whatsapp-templates/exit";
import {
  editExitSetup,
  exitSetupFields,
  leadExitRoom,
  withSavedExit,
  type LeadExitPlan,
  type SavedExit,
} from "@/lib/whatsapp-templates/exit-draft";
import type { TemplateCategory, WhatsAppTemplate } from "@/lib/whatsapp-templates/types";

interface Failure {
  title: string;
  message: string;
  details?: string[];
  code?: string;
}

interface TemplateContentEditSheetProps {
  template: WhatsAppTemplate;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (template: WhatsAppTemplate) => void;
}

function FixedField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="legend">{label}</p>
      <p className="text-sm font-medium text-foreground">{children}</p>
    </div>
  );
}

function EditSheetHeader({ name }: { name: string }) {
  const t = useTranslations("whatsappTemplates.contentEdit");
  return (
    <ElevatedSheetHeader className="border-b border-border pr-16">
      <ElevatedSheetTitle className="text-xl">{t("title")}</ElevatedSheetTitle>
      <ElevatedSheetDescription>{t("description", { name })}</ElevatedSheetDescription>
    </ElevatedSheetHeader>
  );
}

interface ContentEditorProps {
  template: WhatsAppTemplate;
  saved: SavedExit;
  onCancel: () => void;
  onSaved: (template: WhatsAppTemplate) => void;
}

function ContentEditor({ template, saved, onCancel, onSaved }: ContentEditorProps) {
  const t = useTranslations("whatsappTemplates");
  const tRoot = useTranslations();
  const format = useFormatter();
  const [original] = useState(() => withSavedExit(toDraftComponents(template.components, template.headerMediaUrl), saved));
  const draft = useTemplateDraft({
    purpose: "edit",
    initialComponents: original,
    initialCategory: template.category,
  });
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [exitRefused, setExitRefused] = useState(false);
  const categoryLocked = categoryLockedOnEdit(template.status);
  const { components, category } = draft;
  const { can } = useWorkspace();
  const formButtons = can("whatsapp_forms", "send") ? { query: template.wabaId ? { metaWabaId: template.wabaId } : null } : undefined;

  const submit = async (submitted: DraggableComponent[]) => {
    setSaving(true);
    const headerMediaUrl = replacedHeaderMedia(original, submitted);
    try {
      const result = await editWhatsAppTemplateContentAction(template.id, {
        components: toTemplateComponents(submitted),
        ...(category !== template.category ? { category } : {}),
        ...(headerMediaUrl ? { headerMediaUrl } : {}),
        ...exitSetupFields(editExitSetup(submitted, saved.exitConfirmation)),
      });
      if (result.errorCode === MARKETING_TEMPLATE_NEEDS_EXIT) {
        setExitRefused(true);
        return;
      }
      if (result.error !== null || !result.template) {
        setFailure({
          title: t("contentEdit.saveError"),
          message: templateEditErrorMessage(tRoot, { code: result.errorCode, error: result.error ?? "", expected: result.expected }, (at) =>
            format.dateTime(at, { dateStyle: "short", timeStyle: "short" }),
          ),
          code: result.errorCode,
        });
        return;
      }
      toast(t("contentEdit.saved"), { description: t("contentEdit.savedDesc") });
      onSaved(result.template);
    } catch {
      setFailure({ title: t("contentEdit.saveError"), message: t("error.default") });
    } finally {
      setSaving(false);
    }
  };

  const save = () => {
    const problems = Object.values(draft.check()).filter((message): message is string => Boolean(message));
    if (problems.length > 0) {
      setFailure({
        title: t("toast.validationTitle"),
        message: problems.length > 1 ? t("toast.validationCount", { count: String(problems.length) }) : problems[0],
        details: problems.length > 1 ? problems : undefined,
      });
      document.getElementById(BUILDER_PROBLEMS_ANCHOR)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setFailure(null);
    const { draftVerdict, fresh } = draft.exitVerdict;
    if (fresh && draftVerdict && templateExitMissing(draftVerdict.verdict)) {
      setExitRefused(true);
      return;
    }
    void submit(components);
  };

  const saveWithExit = (plan: LeadExitPlan) => {
    setExitRefused(false);
    void submit(draft.applyExitPlan(plan));
  };

  return (
    <>
      <EditSheetHeader name={template.name} />

      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,22rem)]">
          <div className="min-w-0 space-y-4">
            {failure && (
              <TemplateErrorBanner
                title={failure.title}
                message={failure.message}
                details={failure.details}
                code={failure.code}
                onDismiss={() => setFailure(null)}
                dismissLabel={tRoot("common.close")}
              />
            )}
            <div className="rounded-lg border border-border bg-card shadow-sm">
              <div className="p-5 sm:p-6">
                <PanelSection title={t("new.templateInfo")} description={t("contentEdit.fixedHint")}>
                  <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
                    <FixedField label={t("form.labels.name")}>{template.name}</FixedField>
                    <FixedField label={t("form.labels.language")}>{template.language}</FixedField>
                    {categoryLocked ? (
                      <div className="space-y-1.5 sm:col-span-2">
                        <p className="legend">{t("form.labels.category")}</p>
                        <StatusChip tone="outline" label={t(`category.${template.category.toLowerCase()}`)} className="px-2" />
                        <p className="text-xs text-muted-foreground">{t("contentEdit.categoryLocked")}</p>
                      </div>
                    ) : (
                      <ElevatedSelect
                        value={category}
                        onValueChange={(next) => draft.changeCategory(next as TemplateCategory)}
                        label={t("form.labels.category")}
                        aria-label={t("form.labels.category")}
                      >
                        {CONTENT_EDIT_CATEGORIES.map((option) => (
                          <ElevatedSelectItem key={option} value={option}>
                            {t(`category.${option.toLowerCase()}`)}
                          </ElevatedSelectItem>
                        ))}
                      </ElevatedSelect>
                    )}
                  </div>
                </PanelSection>
              </div>

              <div className="border-t border-border p-5 sm:p-6">
                <TemplateMessageSection draft={draft} forms={formButtons} />
              </div>

              <div className="border-t border-border p-5 sm:p-6">
                <TemplateGuidelines components={components} />
              </div>
            </div>
          </div>

          <TemplateDraftPreview components={components} templateName={template.name} language={template.language} />
        </div>
      </div>

      <ElevatedSheetFooter className="border-t border-border">
        <Notice tone="info" title={t("contentEdit.notice.title")}>
          <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
            <li>{t("contentEdit.notice.review")}</li>
            {categoryLocked ? <li>{t("contentEdit.notice.window")}</li> : null}
            <li>{t("contentEdit.notice.campaigns")}</li>
          </ul>
        </Notice>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button type="button" variant="secondary" title={t("button.cancel")} onClick={onCancel} disabled={saving} className="h-9" />
          <Button
            type="button"
            variant="primary"
            title={saving ? t("contentEdit.saving") : t("contentEdit.save")}
            icon={saving ? <CircleNotch className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" weight="fill" />}
            iconVisible
            iconSide="left"
            disabled={saving}
            className="h-9"
            onClick={save}
          />
        </div>
      </ElevatedSheetFooter>

      <MarketingExitDialog
        open={exitRefused}
        onOpenChange={setExitRefused}
        templateName={template.name}
        room={leadExitRoom(components)}
        allowedKinds={draft.exitVerdict.allowedKinds}
        footerText={components.find((c) => c.type === "FOOTER")?.data.text ?? ""}
        busy={saving}
        purpose="edit"
        onApplyPlan={saveWithExit}
      />
    </>
  );
}

function SavedExitRead({ template, onCancel, onSaved }: Omit<ContentEditorProps, "saved">) {
  const tExit = useTranslations("templateExit");
  const savedExit = useTemplateButtonActions(template.id);
  if (savedExit.actions) {
    return <ContentEditor template={template} saved={savedExit.actions} onCancel={onCancel} onSaved={onSaved} />;
  }
  return (
    <>
      <EditSheetHeader name={template.name} />
      <div className="p-6">
        {savedExit.error ? (
          <ExitReadFailure error={savedExit.error} fallback={tExit("panel.loadFailed")} onRetry={savedExit.reload} />
        ) : (
          <p className="text-xs text-muted-foreground">{tExit("verdict.loading")}</p>
        )}
      </div>
    </>
  );
}

export function TemplateContentEditSheet({ template, open, onOpenChange, onSaved }: TemplateContentEditSheetProps) {
  return (
    <ElevatedSheet open={open} onOpenChange={onOpenChange}>
      <ElevatedSheetContent side="right" className="w-full gap-0 sm:max-w-6xl">
        <SavedExitRead template={template} onCancel={() => onOpenChange(false)} onSaved={onSaved} />
      </ElevatedSheetContent>
    </ElevatedSheet>
  );
}
