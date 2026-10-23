"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";
import { toast } from "sonner";

import { updateWhatsAppCampaignAction } from "@/app/actions/whatsapp-campaigns";
import { useSelectionSendRefusalText } from "@/components/campaigns/SelectionSendNote";
import Button from "@/components/elevated-design/button";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import { CampaignExitSection } from "@/components/whatsapp/exit/CampaignExitSection";
import type { ModelPricingInfo } from "@/lib/agents/types";
import { codedErrorMessage } from "@/lib/api/coded-error";
import type { WhatsAppCampaign } from "@/lib/whatsapp-campaigns/types";

import {
  BusinessPhoneField,
  CampaignNameField,
  CampaignToolsFields,
  PipelineField,
  ResponseModeField,
  ScheduleField,
  TemplateField,
  TemplateMediaModal,
  TemplatePreviewCard,
} from "./sections";
import { useWhatsAppCampaignForm, type CampaignFormValues } from "./use-campaign-form";

type EditWhatsAppCampaignFormProps = {
  initialCampaign: WhatsAppCampaign;
  aiModels?: string[];
  modelPricing?: ModelPricingInfo[];
};

export default function EditWhatsAppCampaignForm({ initialCampaign, aiModels, modelPricing }: EditWhatsAppCampaignFormProps) {
  const router = useRouter();
  const [isSubmitting, startSubmit] = useTransition();
  const pendingRedirectRef = useRef<string | null>(null);
  const t = useTranslations("whatsappCampaignsPage.form");
  const tCampaigns = useTranslations("whatsappCampaignsPage");
  const refusalText = useSelectionSendRefusalText();
  const f = useWhatsAppCampaignForm({ mode: "edit", initialCampaign, aiModels, modelPricing });
  const { campaignExit, smartPolicy, contentLocked } = f;

  useEffect(() => {
    if (!isSubmitting && pendingRedirectRef.current) {
      const url = pendingRedirectRef.current;
      pendingRedirectRef.current = null;
      router.push(url);
      router.refresh();
    }
  }, [isSubmitting, router]);

  const onSubmit = (data: CampaignFormValues) => {
    startSubmit(async () => {
      try {
        const result = await updateWhatsAppCampaignAction(initialCampaign.id, f.settingsOf(data));
        if (result.error) {
          const fallback = campaignExit.refusal(result.errorCode) ?? refusalText(result.errorCode, result.error);
          toast.error(t("toast.error"), { description: codedErrorMessage(tCampaigns, { code: result.errorCode }, fallback) });
          return;
        }
        toast(t("toast.success"), { description: t("toast.campaignUpdated") });
        const routesProblem = await campaignExit.saveOverrides(initialCampaign.id);
        if (routesProblem) toast.error(routesProblem);
        pendingRedirectRef.current = `/dashboard/whatsapp-campaigns/${initialCampaign.id}`;
      } catch (error) {
        toast.error(t("toast.error"), { description: error instanceof Error ? error.message : t("toast.unknownError") });
      }
    });
  };

  const describeFormError = (errors: Record<string, unknown>): string => {
    const named: Record<string, string> = {
      name: t("validation.nameRequired"),
      templateId: t("validation.templateRequired"),
      businessPhoneId: t("validation.businessPhoneRequired"),
      agentId: t("validation.agentRequired"),
    };
    for (const [field, message] of Object.entries(named)) {
      if (errors[field]) return message;
    }

    const fields = Object.keys(errors).join(", ");
    return fields ? t("validation.unknownFieldErrors", { fields }) : t("validation.formHasErrors");
  };

  const onInvalid = (errors: Record<string, unknown>) => {
    toast.error(t("toast.validationError"), { description: describeFormError(errors) });
  };

  return (
    <form
      onSubmit={(event) => {
        void f.form.handleSubmit(onSubmit, onInvalid)(event).catch((error) => {
          console.error("[campaign-form] submit failed", error);
          toast.error(t("toast.validationError"), {
            description: t("validation.submitCrashed", { detail: error instanceof Error ? error.message : String(error) }),
          });
        });
      }}
      className="space-y-6"
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <ElevatedContainer className="rounded-lg border border-border bg-card p-6" data-tour="wc-basic-info">
          <h2 className="mb-4 font-display text-xl font-semibold tracking-[0.01em] text-foreground">{t("basicInfo.title")}</h2>

          <div className="space-y-4">
            <CampaignNameField f={f} />
            <BusinessPhoneField f={f} />
            <PipelineField f={f} />
            <TemplateField f={f} />
            <ResponseModeField f={f} />
            <CampaignToolsFields f={f} />
            {!contentLocked && <ScheduleField f={f} />}
          </div>
        </ElevatedContainer>

        <TemplatePreviewCard f={f} />
      </div>

      {contentLocked ? null : (
        <CampaignExitSection exit={campaignExit} templateName={f.selectedTemplate?.name ?? ""} onUseAnotherTemplate={() => f.form.setValue("templateId", "", { shouldDirty: true })} />
      )}

      <ElevatedContainer className="rounded-lg border border-border bg-card p-6" data-tour="wc-contacts">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-xl font-semibold tracking-[0.01em] text-foreground">{t("contacts.title")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{contentLocked ? t("contacts.managedBySelection") : t("contacts.managedOnDetail")}</p>
          </div>
          <Link href={`/dashboard/whatsapp-campaigns/${initialCampaign.id}`}>
            <Button type="button" variant="outline-subtle" title={t("contacts.openDetail")} />
          </Link>
        </div>
      </ElevatedContainer>

      <div className="flex items-center justify-between">
        <Link href="/dashboard/whatsapp-campaigns">
          <Button type="button" variant="ghost" title={t("actions.cancel")} />
        </Link>
        <span className="flex flex-wrap items-center justify-end gap-3">
          <Button type="submit" variant="primary" title={t("actions.update")} disabled={isSubmitting || campaignExit.blocks || smartPolicy.blocks} />
        </span>
      </div>

      <TemplateMediaModal f={f} />
    </form>
  );
}
