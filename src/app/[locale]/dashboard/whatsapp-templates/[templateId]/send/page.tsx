"use client";

import {
  ArrowLeft,
  CheckCircle,
  CircleNotch,
  Code,
  File,
  Image as ImageIcon,
  PaperPlaneTilt,
  Phone,
  TextT,
  User,
  VideoCamera,
  Warning,
  WhatsappLogo,
  XCircle,
} from "@/components/icons";
import {
  getWhatsAppTemplateByIdAction,
  sendWhatsAppTemplateMessageAction,
} from "@/app/actions/whatsapp-templates";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import Button from "@/components/elevated-design/button";
import { ElevatedCommandSelect } from "@/components/elevated-design/elevated-command-select";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import type { WhatsAppBusinessPhone } from "@/lib/whatsapp-business-phones/types";
import type { WhatsAppTemplate } from "@/lib/whatsapp-templates/types";
import { listBusinessPhonesAction } from "@/app/actions/whatsapp-business-phones";
import { motion } from "framer-motion";
import { usePaginatedSelect } from "@/hooks/use-paginated-select";
import { useToast } from "@/hooks/use-toast";
import { useTranslations } from "next-intl";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.25, 0.1, 0.25, 1] as const,
    },
  },
};

function extractParamsFromText(text: string | undefined): string[] {
  if (!text) return [];
  const params: string[] = [];
  const regex = /\{\{([^}]+)\}\}/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    params.push(match[1].trim());
  }
  return params;
}

interface DebugInfo {
  requestPayload: Record<string, unknown> | null;
  responsePayload: Record<string, unknown> | null;
  responseStatus: number | null;
  serverMessage: string | null;
}

export default function SendWhatsAppTemplatePage() {
  const t = useTranslations("whatsappTemplates");
  const { toast } = useToast();
  const params = useParams();
  const router = useRouter();
  const templateId = params.templateId as string;

  const [template, setTemplate] = useState<WhatsAppTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [phoneNumber, setPhoneNumber] = useState("");
  const [bodyParams, setBodyParams] = useState<string[]>([]);
  const [headerTextParams, setHeaderTextParams] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState(false);

  const [selectedBusinessPhoneId, setSelectedBusinessPhoneId] =
    useState<string>("");

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

  const bodyComponent = useMemo(
    () => template?.components.find((c) => c.type === "BODY"),
    [template],
  );
  const headerComponent = useMemo(
    () => template?.components.find((c) => c.type === "HEADER"),
    [template],
  );

  const bodyParamNames = useMemo(
    () => extractParamsFromText(bodyComponent?.text),
    [bodyComponent],
  );
  const headerParamNames = useMemo(
    () =>
      headerComponent?.format === "TEXT"
        ? extractParamsFromText(headerComponent?.text)
        : [],
    [headerComponent],
  );

  const isNamedFormat = template?.parameterFormat === "named";
  const hasMediaHeader =
    headerComponent?.format === "IMAGE" ||
    headerComponent?.format === "VIDEO" ||
    headerComponent?.format === "DOCUMENT";

  useEffect(() => {
    async function fetchTemplate() {
      setLoading(true);
      setError(null);
      try {
        const result = await getWhatsAppTemplateByIdAction(templateId);
        if (result.error) {
          setError(result.error);
        } else if (result.template) {
          setTemplate(result.template);

          const body = result.template.components.find(
            (c) => c.type === "BODY",
          );
          const bodyExtracted = extractParamsFromText(body?.text);
          setBodyParams(new Array(bodyExtracted.length).fill(""));

          const header = result.template.components.find(
            (c) => c.type === "HEADER",
          );
          if (header?.format === "TEXT") {
            const headerExtracted = extractParamsFromText(header?.text);
            setHeaderTextParams(new Array(headerExtracted.length).fill(""));
          }
        }
      } catch {
        setError(t("error.default"));
      } finally {
        setLoading(false);
      }
    }

    if (templateId) {
      fetchTemplate();
    }
  }, [templateId, t]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!selectedBusinessPhoneId) {
      newErrors.businessPhone = t("send.validation.businessPhoneRequired");
    }

    if (!phoneNumber.trim()) {
      newErrors.phone = t("send.validation.phoneRequired");
    } else if (!/^\d{10,15}$/.test(phoneNumber.replace(/\D/g, ""))) {
      newErrors.phone = t("send.validation.phoneInvalid");
    }

    bodyParams.forEach((param, index) => {
      if (!param.trim()) {
        newErrors[`body_param_${index}`] = t(
          "send.validation.parameterRequired",
        );
      }
    });

    headerTextParams.forEach((param, index) => {
      if (!param.trim()) {
        newErrors[`header_param_${index}`] = t(
          "send.validation.parameterRequired",
        );
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm() || !template) {
      return;
    }

    setSending(true);
    setDebugInfo(null);
    setSendError(null);
    setSendSuccess(false);

    try {
      const result = await sendWhatsAppTemplateMessageAction({
        businessPhoneId: selectedBusinessPhoneId,
        to: phoneNumber.replace(/\D/g, ""),
        template: template.name,
        language: template.language,
        parameters: bodyParams.length > 0 ? bodyParams : undefined,
        headerParameters:
          headerTextParams.length > 0 ? headerTextParams : undefined,
      });

      if (result.debugInfo) {
        setDebugInfo(result.debugInfo);
      }

      if (result.error) {
        setSendError(result.error);
        toast({
          title: t("toast.sendError"),
          description: result.error,
          variant: "destructive",
        });
      } else {
        setSendSuccess(true);
        toast({
          title: t("toast.sendSuccess"),
          description: t("toast.sendSuccessDesc"),
        });
      }
    } catch {
      toast({
        title: t("toast.sendError"),
        description: t("error.default"),
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const getPreviewText = () => {
    if (!template) return "";

    if (!bodyComponent?.text) return "";

    let text = bodyComponent.text;
    bodyParamNames.forEach((name, index) => {
      const value = bodyParams[index];
      text = text.replace(
        `{{${name}}}`,
        value ||
          `[${isNamedFormat ? name : `${t("send.paramPlaceholder")} ${index + 1}`}]`,
      );
    });

    return text;
  };

  const getHeaderPreviewText = () => {
    if (!headerComponent?.text || headerComponent.format !== "TEXT") return "";

    let text = headerComponent.text;
    headerParamNames.forEach((name, index) => {
      const value = headerTextParams[index];
      text = text.replace(
        `{{${name}}}`,
        value ||
          `[${isNamedFormat ? name : `${t("send.paramPlaceholder")} ${index + 1}`}]`,
      );
    });

    return text;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <CircleNotch
            className="h-8 w-8 animate-spin text-healthy"
            weight="bold"
          />
          <p className="text-sm text-muted-foreground">{t("loading")}</p>
        </div>
      </div>
    );
  }

  if (error || !template) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <ElevatedContainer className="flex flex-col items-center gap-4 p-8 border border-border bg-card">
          <div className="flex h-14 w-14 items-center justify-center rounded-[--radius] bg-destructive/10">
            <WhatsappLogo className="h-7 w-7 text-destructive" weight="fill" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-foreground">{t("error.title")}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {error || t("error.notFound")}
            </p>
          </div>
          <Button
            variant="secondary"
            title={t("button.back")}
            icon={<ArrowLeft className="h-4 w-4" weight="bold" />}
            iconVisible
            iconSide="left"
            link="/dashboard/whatsapp-templates"
            newTab={false}
          />
        </ElevatedContainer>
      </div>
    );
  }

  if (template.status !== "APPROVED") {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <ElevatedContainer className="flex flex-col items-center gap-4 p-8 border border-border bg-card max-w-md">
          <div className="flex h-14 w-14 items-center justify-center rounded-[--radius] bg-warning/15">
            <Warning className="h-7 w-7 text-warning" weight="fill" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-foreground">
              {t("send.notApproved.title")}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {t("send.notApproved.description")}
            </p>
          </div>
          <Button
            variant="secondary"
            title={t("button.back")}
            icon={<ArrowLeft className="h-4 w-4" weight="bold" />}
            iconVisible
            iconSide="left"
            link={`/dashboard/whatsapp-templates/${templateId}`}
            newTab={false}
          />
        </ElevatedContainer>
      </div>
    );
  }

  return (
    <motion.main
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="w-full space-y-6"
    >
      <motion.div variants={itemVariants}>
        <DashboardPageHeader
          back={{
            onClick: () =>
              router.push(`/dashboard/whatsapp-templates/${templateId}`),
            label: t("send.back"),
          }}
          icon={<PaperPlaneTilt className="h-5 w-5" weight="fill" />}
          badge={t("send.title")}
          title={t("send.title")}
          description={t("send.description", { name: template.name })}
          colorClass="text-healthy"
        />
      </motion.div>

      <form onSubmit={handleSubmit}>
        <div className="grid gap-6 lg:grid-cols-2">
          <motion.div variants={containerVariants} className="space-y-6">
            {/* Recipient Section */}
            <motion.div variants={itemVariants}>
              <ElevatedContainer className="border border-border bg-card p-6">
                <h2 className="text-lg font-semibold text-foreground mb-4">
                  {t("send.sections.recipient")}
                </h2>

                <div className="space-y-4">
                  <div>
                    <ElevatedCommandSelect
                      label={t("send.labels.businessPhone")}
                      value={selectedBusinessPhoneId}
                      onValueChange={setSelectedBusinessPhoneId}
                      disabled={sending}
                      searchPlaceholder={t(
                        "send.placeholders.searchBusinessPhone",
                      )}
                      emptyMessage={t("send.placeholders.noBusinessPhones")}
                      options={businessPhoneSelect.options}
                      onSearch={businessPhoneSelect.onSearch}
                      onScrollEnd={businessPhoneSelect.onScrollEnd}
                      onOpenChange={businessPhoneSelect.onOpenChange}
                      isLoading={businessPhoneSelect.isLoading}
                    />
                    {errors.businessPhone && (
                      <p className="mt-1 text-xs text-destructive flex items-center gap-1">
                        <Warning className="h-3 w-3" /> {errors.businessPhone}
                      </p>
                    )}
                  </div>

                  <div>
                    <ElevatedInput
                      type="text"
                      label={t("send.labels.phone")}
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      icon={<Phone className="h-5 w-5" weight="fill" />}
                      inputMode="numeric"
                    />
                    {errors.phone && (
                      <p className="mt-1 text-xs text-destructive flex items-center gap-1">
                        <Warning className="h-3 w-3" /> {errors.phone}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("send.hints.phone")}
                    </p>
                  </div>
                </div>
              </ElevatedContainer>
            </motion.div>

            {/* Header Info Section (media or text params) */}
            {(hasMediaHeader || headerParamNames.length > 0) && (
              <motion.div variants={itemVariants}>
                <ElevatedContainer className="border border-border bg-card p-6">
                  <h2 className="text-lg font-semibold text-foreground mb-2 flex items-center gap-2">
                    {hasMediaHeader ? (
                      headerComponent?.format === "VIDEO" ? (
                        <VideoCamera
                          className="h-5 w-5 text-blue-500"
                          weight="fill"
                        />
                      ) : headerComponent?.format === "DOCUMENT" ? (
                        <File
                          className="h-5 w-5 text-orange-500"
                          weight="fill"
                        />
                      ) : (
                        <ImageIcon
                          className="h-5 w-5 text-purple-500"
                          weight="fill"
                        />
                      )
                    ) : (
                      <TextT className="h-5 w-5 text-blue-500" weight="fill" />
                    )}
                    Header
                  </h2>

                  {hasMediaHeader && (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        {t("send.headerMedia.description", {
                          format: headerComponent?.format ?? "MEDIA",
                        })}
                      </p>
                      {template.headerMediaUrl ? (
                        <div className="flex items-center gap-2 rounded-lg border border-healthy/20 bg-healthy/5 p-3">
                          <CheckCircle
                            className="h-4 w-4 text-healthy"
                            weight="fill"
                          />
                          <span className="text-xs text-healthy">
                            {t("send.headerMedia.configured")}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 rounded-lg border border-warning/20 bg-warning/5 p-3">
                          <Warning
                            className="h-4 w-4 text-warning"
                            weight="fill"
                          />
                          <span className="text-xs text-warning">
                            {t("send.headerMedia.notConfigured")}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {headerParamNames.length > 0 && (
                    <div className="space-y-4 mt-3">
                      <p className="text-sm text-muted-foreground">
                        {t("send.headerParamsDescription")}
                      </p>
                      {headerParamNames.map((name, index) => (
                        <div key={`header_${index}`}>
                          <ElevatedInput
                            type="text"
                            label={`Header: ${isNamedFormat ? name : `{{${name}}}`}`}
                            value={headerTextParams[index] ?? ""}
                            onChange={(e) => {
                              const newParams = [...headerTextParams];
                              newParams[index] = e.target.value;
                              setHeaderTextParams(newParams);
                            }}
                            icon={<TextT className="h-5 w-5" weight="fill" />}
                          />
                          {errors[`header_param_${index}`] && (
                            <p className="mt-1 text-xs text-destructive flex items-center gap-1">
                              <Warning className="h-3 w-3" />{" "}
                              {errors[`header_param_${index}`]}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </ElevatedContainer>
              </motion.div>
            )}

            {/* Body Parameters Section */}
            {bodyParamNames.length > 0 && (
              <motion.div variants={itemVariants}>
                <ElevatedContainer className="border border-border bg-card p-6">
                  <h2 className="text-lg font-semibold text-foreground mb-4">
                    {t("send.sections.parameters")}
                  </h2>
                  <p className="text-sm text-muted-foreground mb-4">
                    {t("send.parametersDescription")}
                  </p>

                  <div className="space-y-4">
                    {bodyParamNames.map((name, index) => (
                      <div key={`body_${index}`}>
                        <ElevatedInput
                          type="text"
                          label={
                            isNamedFormat
                              ? `${name} ({{${name}}})`
                              : `${t("send.parameter")} {{${name}}}`
                          }
                          value={bodyParams[index] ?? ""}
                          onChange={(e) => {
                            const newParams = [...bodyParams];
                            newParams[index] = e.target.value;
                            setBodyParams(newParams);
                          }}
                          icon={<User className="h-5 w-5" weight="fill" />}
                        />
                        {errors[`body_param_${index}`] && (
                          <p className="mt-1 text-xs text-destructive flex items-center gap-1">
                            <Warning className="h-3 w-3" />{" "}
                            {errors[`body_param_${index}`]}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </ElevatedContainer>
              </motion.div>
            )}

            {/* Submit Buttons */}
            <motion.div variants={itemVariants}>
              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  title={t("form.buttons.cancel")}
                  link={`/dashboard/whatsapp-templates/${templateId}`}
                  newTab={false}
                  className="flex-1"
                />
                <Button
                  variant="primary"
                  type="submit"
                  title={sending ? t("send.sending") : t("send.submit")}
                  icon={
                    sending ? (
                      <CircleNotch className="h-4 w-4 animate-spin" />
                    ) : (
                      <PaperPlaneTilt className="h-4 w-4" weight="fill" />
                    )
                  }
                  iconVisible
                  iconSide="left"
                  disabled={sending}
                  className="flex-1"
                />
              </div>
            </motion.div>

            {/* Debug Payload Section (admin only) */}
            {(debugInfo || sendError || sendSuccess) && (
              <motion.div variants={itemVariants}>
                <ElevatedContainer className="border border-border bg-card p-6">
                  <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                    <Code className="h-5 w-5 text-blue-500" weight="fill" />
                    {t("send.debug.title")}
                  </h2>

                  {/* Status Badge */}
                  <div className="mb-4">
                    {sendSuccess ? (
                      <div className="flex items-center gap-2 rounded-lg border border-healthy/20 bg-healthy/5 p-3">
                        <CheckCircle
                          className="h-5 w-5 text-healthy"
                          weight="fill"
                        />
                        <span className="text-sm font-medium text-healthy">
                          {debugInfo?.serverMessage ?? t("toast.sendSuccess")}
                        </span>
                        {debugInfo?.responseStatus && (
                          <span className="ml-auto rounded-[--radius] bg-healthy px-2 py-0.5 text-xs font-mono text-white">
                            {debugInfo.responseStatus}
                          </span>
                        )}
                      </div>
                    ) : sendError ? (
                      <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                        <XCircle
                          className="h-5 w-5 text-destructive"
                          weight="fill"
                        />
                        <span className="text-sm font-medium text-destructive break-all">
                          {sendError}
                        </span>
                        {debugInfo?.responseStatus && (
                          <span className="ml-auto rounded-[--radius] bg-destructive px-2 py-0.5 text-xs font-mono text-white">
                            {debugInfo.responseStatus}
                          </span>
                        )}
                      </div>
                    ) : null}
                  </div>

                  {debugInfo?.requestPayload && (
                    <div className="mb-4">
                      <h3 className="text-sm font-semibold text-muted-foreground mb-2">
                        {t("send.debug.requestPayload")}
                      </h3>
                      <pre className="rounded-lg bg-muted p-4 text-xs font-mono text-foreground overflow-x-auto max-h-[300px] overflow-y-auto whitespace-pre-wrap break-all">
                        {JSON.stringify(debugInfo.requestPayload, null, 2)}
                      </pre>
                    </div>
                  )}

                  {debugInfo?.responsePayload && (
                    <div>
                      <h3 className="text-sm font-semibold text-muted-foreground mb-2">
                        {t("send.debug.responsePayload")}
                      </h3>
                      <pre className="rounded-lg bg-muted p-4 text-xs font-mono text-foreground overflow-x-auto max-h-[300px] overflow-y-auto whitespace-pre-wrap break-all">
                        {JSON.stringify(debugInfo.responsePayload, null, 2)}
                      </pre>
                    </div>
                  )}
                </ElevatedContainer>
              </motion.div>
            )}
          </motion.div>

          {/* Preview Panel */}
          <motion.div variants={itemVariants}>
            <ElevatedContainer className="border border-border bg-card p-6 sticky top-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">
                {t("send.preview.title")}
              </h2>

              {/* Template Info */}
              <div className="mb-4 space-y-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-medium">
                    {t("send.preview.templateName")}:
                  </span>
                  <span className="font-mono">{template.name}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-medium">
                    {t("send.preview.language")}:
                  </span>
                  <span>{template.language}</span>
                </div>
                {template.parameterFormat && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-medium">
                      {t("send.preview.paramFormat")}:
                    </span>
                    <span className="rounded-[--radius] bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      {template.parameterFormat}
                    </span>
                  </div>
                )}
                {hasMediaHeader && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-medium">Header:</span>
                    <span className="rounded-[--radius] bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      {headerComponent?.format}
                    </span>
                  </div>
                )}
              </div>

              <div className="bg-[#e5ddd5] dark:bg-[#0b141a] rounded-[--radius] p-4 min-h-[300px]">
                <div className="max-w-[280px] bg-card rounded-lg shadow-sm overflow-hidden">
                  {/* Header - Media */}
                  {hasMediaHeader && (
                    <div className="bg-muted border-b border-border p-3 flex items-center justify-center min-h-[80px]">
                      {headerComponent?.format === "VIDEO" ? (
                        <VideoCamera
                          className="h-10 w-10 text-muted-foreground"
                          weight="fill"
                        />
                      ) : headerComponent?.format === "DOCUMENT" ? (
                        <File
                          className="h-10 w-10 text-muted-foreground"
                          weight="fill"
                        />
                      ) : (
                        <ImageIcon
                          className="h-10 w-10 text-muted-foreground"
                          weight="fill"
                        />
                      )}
                    </div>
                  )}

                  {/* Header - Text */}
                  {headerComponent?.format === "TEXT" &&
                    headerComponent?.text && (
                      <div className="px-3 py-2 bg-muted border-b border-border">
                        <p className="text-sm font-semibold text-foreground">
                          {getHeaderPreviewText()}
                        </p>
                      </div>
                    )}

                  {/* Body */}
                  <div className="px-3 py-2">
                    <p className="text-sm text-foreground whitespace-pre-wrap">
                      {getPreviewText()}
                    </p>
                  </div>

                  {/* Footer */}
                  {template.components.find((c) => c.type === "FOOTER")
                    ?.text && (
                    <div className="px-3 py-1">
                      <p className="text-xs text-muted-foreground">
                        {
                          template.components.find((c) => c.type === "FOOTER")
                            ?.text
                        }
                      </p>
                    </div>
                  )}

                  {/* Timestamp */}
                  <div className="px-3 py-1 text-right">
                    <span className="text-[10px] text-muted-foreground">
                      {new Date().toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>

                  {/* Buttons */}
                  {template.components.find((c) => c.type === "BUTTONS")
                    ?.buttons?.length ? (
                    <div className="border-t border-border">
                      {template.components
                        .find((c) => c.type === "BUTTONS")
                        ?.buttons?.map((button, index) => (
                          <button
                            key={index}
                            type="button"
                            className="w-full px-3 py-2 text-sm font-medium text-[#00a884] text-center border-b border-border last:border-b-0 hover:bg-muted"
                          >
                            {button.text}
                          </button>
                        ))}
                    </div>
                  ) : null}
                </div>
              </div>

              {phoneNumber && (
                <div className="mt-4 p-3 rounded-lg bg-healthy/10 border border-healthy/20">
                  <p className="text-xs text-healthy dark:text-green-400 flex items-center gap-2">
                    <Phone className="h-3 w-3" weight="fill" />
                    {t("send.preview.sendingTo")}:{" "}
                    <strong>{phoneNumber}</strong>
                  </p>
                </div>
              )}
            </ElevatedContainer>
          </motion.div>
        </div>
      </form>
    </motion.main>
  );
}
