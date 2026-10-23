"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

import { uploadMediaAction } from "@/app/actions/medias";
import { PanelSection } from "@/components/dashboard/PanelSection";
import Button from "@/components/elevated-design/button";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { ElevatedSegmentedControl } from "@/components/elevated-design/elevated-segmented-control";
import { ElevatedSelect, ElevatedSelectItem } from "@/components/elevated-design/elevated-select";
import { ImageUploadField } from "@/components/elevated-design/image-upload-field";
import { Sparkle } from "@/components/icons";
import { Notice } from "@/components/ui/notice";
import type { CodedRefusal } from "@/lib/api/coded-error";
import { useCarrierRefusalText } from "@/components/carrier-messaging/shared/use-carrier-error-text";
import { rcsErrorField, type RcsSenderField } from "@/lib/rcs/errors";
import { RCS_BANNER_SIZE, RCS_LIMITS, RCS_LOGO_SIZE } from "@/lib/rcs/limits";
import { maskCnpj, withSenderField } from "@/lib/rcs/sender-form";
import { RCS_BILLING_CATEGORIES, RCS_SECTORS, RCS_USE_CASES, type RcsSenderInput } from "@/lib/rcs/types";
import { cn } from "@/lib/utils";

import { RcsTextField } from "../composer/RcsTextField";
import { RcsAgentProfile } from "../preview/RcsAgentProfile";

const IMAGE_TYPES = ["image/png", "image/jpeg"] as const;

const DEFAULT_SWATCH = "#0B57D0";

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

type Upload = { value: string } | { error: string };

function useImageUpload() {
  const t = useTranslations("rcs.senders.form.images");
  return {
    check: (file: File) => ((IMAGE_TYPES as readonly string[]).includes(file.type) ? null : t("wrongType")),
    upload: async (file: File): Promise<Upload> => {
      const form = new FormData();
      form.append("media", file);
      form.append("mediaType", "image");
      form.append("description", file.name);
      const result = await uploadMediaAction(form);
      return result.mediaUrl ? { value: result.mediaUrl } : { error: result.error ?? t("failed") };
    },
  };
}

export function SenderForm({
  value,
  onChange,
  error,
  suggestedDescription,
  disabled = false,
  billingLocked = false,
  footer,
  className,
}: {
  value: RcsSenderInput;
  onChange: (input: RcsSenderInput) => void;
  error?: CodedRefusal | null;
  suggestedDescription?: string;
  disabled?: boolean;
  billingLocked?: boolean;
  footer?: ReactNode;
  className?: string;
}) {
  const t = useTranslations("rcs.senders.form");
  const refusalText = useCarrierRefusalText();
  const images = useImageUpload();
  const errorField = error ? rcsErrorField(error) : null;
  const errorText = error ? refusalText(error) : undefined;
  const fieldError = (field: RcsSenderField) => (errorField === field ? errorText : undefined);
  const set = <K extends keyof RcsSenderInput>(field: K, next: RcsSenderInput[K]) => onChange(withSenderField(value, field, next));
  const swatch = HEX_COLOR.test(value.color) ? value.color : DEFAULT_SWATCH;
  const suggestion = suggestedDescription?.trim();

  const imageLabels = (kind: "logo" | "banner") => ({
    title: t(`images.${kind}.title`),
    add: t("images.add"),
    replace: t("images.replace"),
    remove: t("images.remove"),
    uploading: t("images.uploading"),
    hint: t(`images.${kind}.hint`, kind === "logo" ? RCS_LOGO_SIZE : RCS_BANNER_SIZE),
  });

  return (
    <div className={cn("grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(300px,340px)] lg:items-start", className)}>
      <div className="min-w-0 space-y-8">
        {error && !errorField ? (
          <Notice tone="fault" title={t("errorTitle")}>
            <p>{errorText}</p>
          </Notice>
        ) : null}

        <PanelSection title={t("brand.title")} description={t("brand.description")}>
          <div className="space-y-4">
            <RcsTextField
              label={t("brand.name")}
              value={value.brand_name}
              onChange={(next) => set("brand_name", next)}
              max={RCS_LIMITS.maxBrandNameRunes}
              error={fieldError("brand_name")}
              disabled={disabled}
            />
            <RcsTextField
              label={t("brand.descriptionLabel")}
              multiline
              value={value.description}
              onChange={(next) => set("description", next)}
              max={RCS_LIMITS.maxBrandDescriptionRunes}
              error={fieldError("description")}
              hint={t("brand.descriptionHint")}
              disabled={disabled}
            />
            {suggestion && suggestion !== value.description.trim() && !disabled ? (
              <div className="flex flex-wrap items-center gap-3 rounded-[--radius] border border-border bg-card px-3 py-2.5">
                <Sparkle aria-hidden className="h-4 w-4 shrink-0 text-muted-foreground" />
                <p className="min-w-0 flex-1 text-xs text-foreground">
                  <span className="font-semibold">{t("brand.suggestion")}</span> {suggestion}
                </p>
                <Button variant="outline" size="sm" title={t("brand.useSuggestion")} onClick={() => set("description", suggestion)} />
              </div>
            ) : null}
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-1">
                <ImageUploadField<string>
                  labels={imageLabels("logo")}
                  previewUrl={value.logo_url}
                  accept={IMAGE_TYPES}
                  check={images.check}
                  upload={images.upload}
                  onUploaded={(url) => set("logo_url", url)}
                  onRemove={() => set("logo_url", "")}
                  disabled={disabled}
                />
                {fieldError("logo_url") ? <p className="text-xs font-medium text-destructive-ink">{fieldError("logo_url")}</p> : null}
              </div>
              <div className="space-y-1">
                <ImageUploadField<string>
                  labels={imageLabels("banner")}
                  previewUrl={value.banner_url}
                  accept={IMAGE_TYPES}
                  check={images.check}
                  upload={images.upload}
                  onUploaded={(url) => set("banner_url", url)}
                  onRemove={() => set("banner_url", "")}
                  disabled={disabled}
                />
                {fieldError("banner_url") ? <p className="text-xs font-medium text-destructive-ink">{fieldError("banner_url")}</p> : null}
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="legend">{t("brand.color")}</p>
              <div className="flex items-start gap-3">
                <label className="relative mt-0.5 h-10 w-10 shrink-0 cursor-pointer overflow-hidden rounded-[--radius] border border-control-edge" style={{ backgroundColor: swatch }}>
                  <span className="sr-only">{t("brand.colorPicker")}</span>
                  <input
                    type="color"
                    value={swatch}
                    disabled={disabled}
                    onChange={(event) => set("color", event.target.value.toUpperCase())}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  />
                </label>
                <ElevatedInput
                  label={t("brand.colorHex")}
                  value={value.color}
                  placeholder="#0B57D0"
                  maxLength={7}
                  onChange={(event) => set("color", event.target.value)}
                  error={fieldError("color")}
                  disabled={disabled}
                  className="max-w-[12rem]"
                />
              </div>
              <p className="text-2xs text-muted-foreground">{t("brand.colorHint")}</p>
            </div>
          </div>
        </PanelSection>

        <PanelSection title={t("use.title")} description={t("use.description")}>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <p className="legend">{t("use.useCase")}</p>
              <ElevatedSegmentedControl
                options={RCS_USE_CASES.map((option) => ({ value: option, label: t(`useCases.${option}.label`), description: t(`useCases.${option}.description`) }))}
                value={value.use_case || null}
                onChange={(next) => set("use_case", next as RcsSenderInput["use_case"])}
                columns={2}
                size="sm"
                disabled={disabled}
                className="max-sm:!grid-cols-1"
              />
              {fieldError("use_case") ? <p className="text-xs font-medium text-destructive-ink">{fieldError("use_case")}</p> : null}
            </div>
            <ElevatedSelect
              label={t("use.sector")}
              aria-label={t("use.sector")}
              value={value.sector || undefined}
              onValueChange={(next) => set("sector", next as RcsSenderInput["sector"])}
              disabled={disabled}
            >
              {RCS_SECTORS.map((option) => (
                <ElevatedSelectItem key={option} value={option}>
                  {t(`sectors.${option}`)}
                </ElevatedSelectItem>
              ))}
            </ElevatedSelect>
            {fieldError("sector") ? <p className="text-xs font-medium text-destructive-ink">{fieldError("sector")}</p> : null}
            {value.sector && t.has(`sectorNotices.${value.sector}.title`) ? (
              <Notice tone="warning" title={t(`sectorNotices.${value.sector}.title`)}>
                <p>{t(`sectorNotices.${value.sector}.body`)}</p>
              </Notice>
            ) : null}
            {value.sector === "gambling" ? (
              <RcsTextField
                label={t("use.gamblingAuthorization")}
                type="url"
                inputMode="url"
                placeholder="https://"
                value={value.gambling_authorization_url}
                onChange={(next) => set("gambling_authorization_url", next)}
                error={fieldError("gambling_authorization_url")}
                hint={t("use.gamblingAuthorizationHint")}
                disabled={disabled}
              />
            ) : null}
          </div>
        </PanelSection>

        <PanelSection title={t("billing.title")} description={t("billing.description")}>
          <div className="space-y-3">
            <ElevatedSegmentedControl
              options={RCS_BILLING_CATEGORIES.map((option) => ({ value: option, label: t(`billing.categories.${option}.label`), description: t(`billing.categories.${option}.description`) }))}
              value={value.billing_category || null}
              onChange={(next) => set("billing_category", next as RcsSenderInput["billing_category"])}
              columns={2}
              disabled={disabled || billingLocked}
              className="max-sm:!grid-cols-1"
            />
            {fieldError("billing_category") ? <p className="text-xs font-medium text-destructive-ink">{fieldError("billing_category")}</p> : null}
            <p className="text-xs text-muted-foreground">{billingLocked ? t("billing.locked") : t("billing.hint")}</p>
          </div>
        </PanelSection>

        <PanelSection title={t("contact.title")} description={t("contact.description")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <RcsTextField label={t("contact.name")} value={value.contact_name} onChange={(next) => set("contact_name", next)} error={fieldError("contact_name")} disabled={disabled} />
            <RcsTextField
              label={t("contact.phone")}
              type="tel"
              inputMode="tel"
              value={value.contact_phone}
              onChange={(next) => set("contact_phone", next)}
              error={fieldError("contact_phone")}
              disabled={disabled}
            />
            <RcsTextField
              className="sm:col-span-2"
              label={t("contact.email")}
              value={value.contact_email}
              onChange={(next) => set("contact_email", next)}
              error={fieldError("contact_email")}
              hint={t("contact.emailHint")}
              disabled={disabled}
            />
          </div>
        </PanelSection>

        <PanelSection title={t("pages.title")} description={t("pages.description")}>
          <div className="space-y-4">
            {(["website_url", "privacy_url", "terms_url"] as const).map((field) => (
              <RcsTextField
                key={field}
                label={t(`pages.${field}`)}
                type="url"
                inputMode="url"
                placeholder="https://"
                value={value[field]}
                onChange={(next) => set(field, next)}
                error={fieldError(field)}
                disabled={disabled}
              />
            ))}
          </div>
        </PanelSection>

        <PanelSection title={t("company.title")} description={t("company.description")}>
          <ElevatedInput
            label={t("company.cnpj")}
            inputMode="numeric"
            value={maskCnpj(value.cnpj)}
            onChange={(event) => set("cnpj", event.target.value)}
            error={fieldError("cnpj")}
            disabled={disabled}
            className="max-w-xs"
          />
        </PanelSection>

        {footer}
      </div>

      <aside className="min-w-0 lg:sticky lg:top-16">
        <RcsAgentProfile
          agent={{ name: value.brand_name, logoUrl: value.logo_url, bannerUrl: value.banner_url, color: value.color, description: value.description }}
          contact={{ website: value.website_url, phone: value.contact_phone, email: value.contact_email }}
        />
      </aside>
    </div>
  );
}
