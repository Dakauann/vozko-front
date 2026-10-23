"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  CheckCircle,
  CircleNotch,
  Warning,
  WhatsappLogo,
} from "@/components/icons";
import type {
  CreateTemplatePayload,
  TemplateCategory,
} from "@/lib/whatsapp-templates/types";
import type { WhatsAppBusinessPhone } from "@/lib/whatsapp-business-phones/types";
import Button from "@/components/elevated-design/button";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { PanelSection } from "@/components/dashboard/PanelSection";
import { Notice } from "@/components/ui/notice";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { ElevatedCommandSelect } from "@/components/elevated-design/elevated-command-select";
import {
  ElevatedSelect,
  ElevatedSelectItem,
} from "@/components/elevated-design/elevated-select";
import { createWhatsAppTemplateAction } from "@/app/actions/whatsapp-templates";
import { templateErrorMessage, trackedButtonRefusal } from "@/lib/whatsapp-templates/errors";
import { listBusinessPhonesAction } from "@/app/actions/whatsapp-business-phones";
import { usePaginatedSelect } from "@/hooks/use-paginated-select";
import {
  type DraggableComponent,
  getDefaultData as getDefaultComponentData,
} from "@/components/whatsapp/DragDropBuilder";
import { TemplateErrorBanner } from "@/components/whatsapp/TemplateErrorBanner";
import { TemplateDraftPreview } from "@/components/whatsapp/builder/TemplateDraftPreview";
import { TemplateGuidelines } from "@/components/whatsapp/builder/TemplateGuidelines";
import { BUILDER_PROBLEMS_ANCHOR, TemplateMessageSection } from "@/components/whatsapp/builder/TemplateMessageSection";
import { useTemplateDraft } from "@/components/whatsapp/builder/use-template-draft";
import { useSaveTemplateSuggestions } from "@/components/whatsapp/builder/use-template-suggestions";
import { useWorkspace } from "@/contexts/workspace-context";
import { MarketingExitDialog } from "@/components/whatsapp/exit/MarketingExitDialog";
import { MARKETING_TEMPLATE_NEEDS_EXIT } from "@/lib/whatsapp-templates/exit";
import { computeParameterFormat, headerMediaOf, toTemplateComponents } from "@/lib/whatsapp-templates/draft";
import {
  collectExitSetup,
  exitSetupFields,
  leadExitRoom,
  type LeadExitPlan,
} from "@/lib/whatsapp-templates/exit-draft";
import { urlTrackingFields } from "@/lib/whatsapp-templates/url-tracking";
import TourGuide from "@/components/TourGuide";
import type { TourStep } from "@/components/TourGuide";
import {
  whatsappTemplatesTourSteps,
  whatsappTemplatesTourPalette,
  whatsappTemplatesTourSeed,
} from "@/data/tour-whatsapp-templates";

const categories: TemplateCategory[] = [
  "MARKETING",
  "UTILITY",
  "AUTHENTICATION",
];

const languages = [
  { value: "pt_BR", label: "Português (Brasil)" },
  { value: "en_US", label: "English (US)" },
  { value: "es", label: "Español" },
];

type FieldProblems = Partial<Record<"name" | "businessPhone", string>>;

export default function NewWhatsAppTemplatePage() {
  const router = useRouter();
  const t = useTranslations("whatsappTemplates");
  const tRoot = useTranslations();
  const [name, setName] = useState("");
  const [language, setLanguage] = useState("pt_BR");
  const [businessPhoneId, setBusinessPhoneId] = useState("");
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldProblems>({});
  const [exitRefused, setExitRefused] = useState(false);
  const draft = useTemplateDraft({
    purpose: "create",
    initialComponents: [],
    initialCategory: "MARKETING",
  });
  const { components, category } = draft;
  const saveSuggestions = useSaveTemplateSuggestions();
  const { can } = useWorkspace();
  const formButtons = can("whatsapp_forms", "send") ? { query: businessPhoneId ? { phoneId: businessPhoneId } : null } : undefined;

  const [failure, setFailure] = useState<{
    title: string;
    message: string;
    details?: string[];
    code?: string;
  } | null>(null);

  const businessPhoneSelect = usePaginatedSelect<WhatsAppBusinessPhone>({
    fetchFn: useCallback(async (page: number, search: string) => {
      const result = await listBusinessPhonesAction({
        status: "CONNECTED",
        page,
        pageSize: 20,
        search: search || undefined,
      });
      return { items: result.phones ?? [], totalPages: result.meta.totalPages };
    }, []),
    mapOption: useCallback(
      (phone: WhatsAppBusinessPhone) => ({
        label: phone.verifiedName
          ? `${phone.verifiedName} (${phone.displayPhoneNumber})`
          : phone.displayPhoneNumber,
        value: phone.id,
      }),
      [],
    ),
  });

  const scrollToFirstError = (problemKeys: string[]) => {
    const anchors: Record<string, string> = {
      name: "template-error-anchor-name",
      businessPhone: "template-error-anchor-phone",
    };
    const inBuilder = ["header", "body", "footer", "buttons", "format"];

    const key =
      ["name", "businessPhone"].find((k) => problemKeys.includes(k)) ??
      (problemKeys.some((k) => inBuilder.includes(k)) ? "builder" : undefined);
    if (!key) return;

    const id = anchors[key] ?? BUILDER_PROBLEMS_ANCHOR;
    const el = document.getElementById(id);
    if (!el) return;

    el.scrollIntoView({ behavior: "smooth", block: "center" });
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      el.focus({ preventScroll: true });
    }
  };

  const validateFields = (): FieldProblems => {
    const found: FieldProblems = {};

    if (!name.trim()) {
      found.name = t("form.validation.nameRequired");
    } else if (!/^[a-z0-9_]+$/.test(name)) {
      found.name = t("form.validation.nameInvalid");
    } else if (name.length > 512) {
      found.name = t("form.validation.nameTooLong");
    }

    if (!businessPhoneId) {
      found.businessPhone = t("form.validation.businessPhoneRequired");
    }

    setFieldErrors(found);
    return found;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const problems: Record<string, string> = { ...validateFields(), ...draft.check() };
    const problemKeys = Object.keys(problems);
    if (problemKeys.length > 0) {
      setFailure({
        title: t("toast.validationTitle"),
        message:
          problemKeys.length > 1
            ? t("toast.validationCount", { count: String(problemKeys.length) })
            : problems[problemKeys[0]],
        details:
          problemKeys.length > 1
            ? problemKeys.map((key) => problems[key])
            : undefined,
      });
      scrollToFirstError(problemKeys);
      return;
    }
    setFailure(null);
    draft.refuseButton(null);
    await submitTemplate(components);
  };

  const submitTemplate = async (submitted: DraggableComponent[]) => {
    setSaving(true);

    const detectedFormat = computeParameterFormat(submitted);
    const headerMediaUrl = headerMediaOf(submitted);

    const payload: CreateTemplatePayload = {
      businessPhoneId,
      name,
      language,
      category,
      components: toTemplateComponents(submitted),
      ...(detectedFormat === "named" || detectedFormat === "positional"
        ? { parameterFormat: detectedFormat }
        : {}),
      ...(headerMediaUrl ? { headerMediaUrl } : {}),
      ...exitSetupFields(collectExitSetup(submitted)),
      ...urlTrackingFields(submitted, false),
    };

    try {
      const result = await createWhatsAppTemplateAction(payload);
      if (!result.error && result.template?.id) await saveSuggestions(result.template.id, submitted, false);

      const refusedIndex = trackedButtonRefusal(result.errorCode, result.expected);
      if (result.errorCode === MARKETING_TEMPLATE_NEEDS_EXIT) {
        setExitRefused(true);
      } else if (refusedIndex !== null && draft.refuseButton({ index: refusedIndex, message: templateErrorMessage(tRoot, result.errorCode, result.error ?? "") })) {
        return;
      } else if (result.error) {
        setFailure({
          title: t("toast.createError"),
          message: templateErrorMessage(tRoot, result.errorCode, result.error),
          code: result.errorCode,
        });
      } else if (result.template?.status === "REJECTED") {
        const reason = result.template.rejectedReason;
        setFailure({
          title: t("toast.createRejected"),
          message: reason
            ? tRoot.has(`whatsappTemplates.rejectedReason.`)
              ? tRoot(`whatsappTemplates.rejectedReason.`)
              : t("toast.createRejectedDesc", { reason })
            : t("toast.createErrorDesc"),
          code: reason || undefined,
        });
      } else {
        toast(t("toast.createSuccess"), { description: t("toast.createSuccessDesc") });
        router.push("/dashboard/whatsapp-templates");
      }
    } catch {
      toast.error(t("toast.createError"), { description: t("toast.createErrorDesc") });
    } finally {
      setSaving(false);
    }
  };

  const createWithExit = (plan: LeadExitPlan) => {
    setExitRefused(false);
    void submitTemplate(draft.applyExitPlan(plan));
  };

  const footerText = components.find((c) => c.type === "FOOTER")?.data.text ?? "";

  const handleTourStep = (_index: number, step: TourStep) => {
    const tourData = step.data as { _selectComponent?: string; _injectVar?: boolean } | undefined;
    const componentType = tourData?._selectComponent;
    if (!componentType) return;

    const shouldInjectVar = tourData?._injectVar;
    const existing = components.find((c) => c.type === componentType);

    if (existing) {
      if (shouldInjectVar && componentType === "BODY" && !/\{\{/.test(existing.data.text || "")) {
        const updated = { ...existing, data: { ...existing.data, text: (existing.data.text || "") + " {{1}}" } };
        draft.setComponents(components.map((c) => c.id === updated.id ? updated : c));
        draft.setSelected(updated);
      } else {
        draft.setSelected(existing);
      }
      return;
    }

    const newComponent: DraggableComponent = {
      id: `${componentType.toLowerCase()}-${Date.now()}`,
      type: componentType as DraggableComponent["type"],
      data: getDefaultComponentData(componentType),
    };

    if (shouldInjectVar && componentType === "BODY") {
      newComponent.data = { ...newComponent.data, text: "{{1}}" };
    }

    const newComponents = [...components];
    if (componentType === "HEADER") {
      newComponents.unshift(newComponent);
    } else if (componentType === "FOOTER" || componentType === "BUTTONS") {
      newComponents.push(newComponent);
    } else {
      const headerIndex = newComponents.findIndex((c) => c.type === "HEADER");
      if (headerIndex >= 0) {
        newComponents.splice(headerIndex + 1, 0, newComponent);
      } else {
        newComponents.unshift(newComponent);
      }
    }

    draft.setComponents(newComponents);
    draft.setSelected(newComponent);
  };

  const createButton = (
    <Button
      variant="primary"
      type="submit"
      title={saving ? t("button.creating") : t("form.buttons.create")}
      icon={
        saving ? (
          <CircleNotch className="h-4 w-4 animate-spin" />
        ) : (
          <CheckCircle className="h-4 w-4" weight="fill" />
        )
      }
      iconVisible
      iconSide="left"
      disabled={saving}
      className="h-9"
      onClick={handleSubmit}
    />
  );
  const cancelButton = (
    <Button
      variant="secondary"
      title={t("form.buttons.cancel")}
      link="/dashboard/whatsapp-templates"
      newTab={false}
      className="h-9"
    />
  );

  return (
    <>
      <TourGuide
        steps={whatsappTemplatesTourSteps}
        storageKey="tour_dismissed_whatsapp_templates_v2"
        i18nNamespace="tourWhatsappTemplates"
        introPalette={whatsappTemplatesTourPalette}
        introSeed={whatsappTemplatesTourSeed}
        onStep={handleTourStep}
      />
    <main className="w-full space-y-5">
      <DashboardPageHeader
        back={{
          onClick: () => router.push("/dashboard/whatsapp-templates"),
          label: t("button.back"),
        }}
        icon={<WhatsappLogo className="h-5 w-5" weight="fill" />}
        badge={t("new.badge")}
        title={t("new.title")}
        description={t("new.description")}
        colorClass="text-muted-foreground"
        actions={
          <div className="flex items-center gap-2" data-tour="wt-submit">
            {cancelButton}
            {createButton}
          </div>
        }
      />

      <form
        onSubmit={handleSubmit}
        noValidate
        className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,22rem)]"
      >
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
          <div className="p-5 sm:p-6" data-tour="wt-template-info">
            <PanelSection title={t("new.templateInfo")} description={t("new.detailsHint")}>
              <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
                <div>
                  <ElevatedInput
                    type="text"
                    label={t("form.labels.name")}
                    placeholder={t("form.placeholders.name")}
                    value={name}
                    onChange={(e) =>
                      setName(
                        e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9_]/g, "_"),
                      )
                    }
                    id="template-error-anchor-name"
                    error={fieldErrors.name}
                  />
                  {fieldErrors.name ? null : (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("form.hints.name")}
                    </p>
                  )}
                </div>

                <div id="template-error-anchor-phone">
                  <ElevatedCommandSelect
                    value={businessPhoneId}
                    onValueChange={setBusinessPhoneId}
                    label={t("form.labels.businessPhone")}
                    disabled={saving}
                    searchPlaceholder={t(
                      "form.placeholders.searchBusinessPhone",
                    )}
                    emptyMessage={t("form.placeholders.noBusinessPhones")}
                    options={businessPhoneSelect.options}
                    onSearch={businessPhoneSelect.onSearch}
                    onScrollEnd={businessPhoneSelect.onScrollEnd}
                    onOpenChange={businessPhoneSelect.onOpenChange}
                    isLoading={businessPhoneSelect.isLoading}
                  />
                  {fieldErrors.businessPhone ? (
                    <p className="mt-1 text-xs text-destructive-ink flex items-center gap-1">
                      <Warning className="h-3 w-3" /> {fieldErrors.businessPhone}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("form.hints.businessPhone")}
                    </p>
                  )}
                </div>

                <ElevatedSelect
                  value={language}
                  onValueChange={setLanguage}
                  label={t("form.labels.language")}
                >
                  {languages.map((lang) => (
                    <ElevatedSelectItem key={lang.value} value={lang.value}>
                      {lang.label}
                    </ElevatedSelectItem>
                  ))}
                </ElevatedSelect>

                <ElevatedSelect
                  value={category}
                  onValueChange={(v) =>
                    draft.changeCategory(v as TemplateCategory)
                  }
                  label={t("form.labels.category")}
                >
                  {categories.map((cat) => (
                    <ElevatedSelectItem key={cat} value={cat}>
                      {t(`category.${cat.toLowerCase()}`)}
                    </ElevatedSelectItem>
                  ))}
                </ElevatedSelect>
              </div>
            </PanelSection>
          </div>

          <div className="border-t border-border p-5 sm:p-6">
            <TemplateMessageSection draft={draft} forms={formButtons} />
          </div>

          <div className="border-t border-border p-5 sm:p-6">
            <TemplateGuidelines components={components} />
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-4 sm:px-6">
            {cancelButton}
            {createButton}
          </div>
          </div>
        </div>

        <TemplateDraftPreview
          components={components}
          templateName={name || t("new.untitledTemplate")}
          language={language}
        >
          <Notice tone="info" title={t("new.approvalRequired.title")}>
            <p className="text-muted-foreground">{t("new.approvalRequired.description")}</p>
          </Notice>
        </TemplateDraftPreview>
      </form>
      <MarketingExitDialog
        open={exitRefused}
        onOpenChange={setExitRefused}
        templateName={name}
        room={leadExitRoom(components)}
        allowedKinds={draft.exitVerdict.allowedKinds}
        footerText={footerText}
        busy={saving}
        purpose="create"
        onApplyPlan={createWithExit}
      />
    </main>
    </>
  );
}
