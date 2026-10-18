"use client";

import {
  ChatCircle,
  Copy,
  File,
  Gif,
  Image as ImageIcon,
  Link,
  MapPin,
  Phone,
  PhoneCall,
  Plus,
  TextT,
  Trash,
  VideoCamera,
  type Icon,
} from "@/components/icons";

import { DraggableComponent } from "./DragDropBuilder";
import { Notice } from "@/components/ui/notice";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import ElevatedTextarea from "@/components/elevated-design/elevated-textarea";
import { CircuitRoutes } from "@/components/elevated-design/circuit-routes";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { useRef, useState, type ChangeEvent } from "react";
import { uploadTemplateHeaderMediaAction } from "@/app/actions/whatsapp-templates";
import type { TemplateCategory } from "@/lib/whatsapp-templates/types";
import { detectVariables } from "@/lib/whatsapp-templates/draft";
import { BUTTON_TEXT_LIMIT, FOOTER_TEXT_LIMIT, MAX_BUILDER_BUTTONS } from "@/lib/whatsapp-templates/builder";
import { BUTTON_ACTION_KINDS, offeredKinds } from "@/lib/whatsapp-templates/exit";
import { ButtonActionFields } from "./exit/ButtonActionFields";
import { FIELD_ANCHOR, QuickReplyChip, RouteCard } from "./exit/ButtonRoutePieces";
import { useButtonActionLabel } from "./exit/use-button-action-label";
import { ExitConfirmationField } from "./exit/ExitConfirmationField";

function headerAcceptFor(format?: string): string {
  switch (format) {
    case "IMAGE":
      return "image/png,image/jpeg";
    case "VIDEO":
      return "video/mp4";
    case "DOCUMENT":
      return "application/pdf";
    default:
      return "image/png,image/jpeg,video/mp4,application/pdf";
  }
}

interface ComponentEditorProps {
  component: DraggableComponent;
  onChange: (component: DraggableComponent) => void;
  category?: TemplateCategory;
  allowedKinds: readonly string[];
}

function CharCount({ count, limit }: { count: number; limit: number }) {
  const t = useTranslations("whatsappTemplates.form.editor");
  return (
    <p className="mt-1 text-xs tabular-nums text-muted-foreground">
      {t("charCount", { count, limit })}
    </p>
  );
}

export default function ComponentEditor({
  component,
  onChange,
  category = "MARKETING",
  allowedKinds,
}: ComponentEditorProps) {
  const updateData = (updates: Partial<DraggableComponent["data"]>) => {
    onChange({
      ...component,
      data: { ...component.data, ...updates },
    });
  };

  return (
    <div>
      <div className="space-y-4">
        {component.type === "HEADER" && (
          <HeaderEditor component={component} updateData={updateData} />
        )}
        {component.type === "BODY" && (
          <BodyEditor
            component={component}
            updateData={updateData}
            category={category}
          />
        )}
        {component.type === "FOOTER" && (
          <FooterEditor
            component={component}
            updateData={updateData}
            category={category}
          />
        )}
        {component.type === "BUTTONS" && (
          <ButtonsEditor
            component={component}
            updateData={updateData}
            category={category}
            allowedKinds={allowedKinds}
          />
        )}
        {component.type === "CALL_PERMISSION_REQUEST" && <CallPermissionEditor />}
      </div>
    </div>
  );
}

function CallPermissionEditor() {
  const t = useTranslations("whatsappTemplates.form.editor.callPermission");

  return (
    <div data-tour="wt-call-permission-editor" className="space-y-3">
      <div className="flex items-start gap-3">
        <div className="tile-info flex h-9 w-9 flex-shrink-0 items-center justify-center">
          <PhoneCall className="h-5 w-5" weight="duotone" />
        </div>
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-foreground">
            {t("title")}
          </h4>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("description")}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">{t("noFields")}</p>
        </div>
      </div>
    </div>
  );
}

function HeaderEditor({
  component,
  updateData,
}: {
  component: DraggableComponent;
  updateData: (updates: Partial<DraggableComponent["data"]>) => void;
}) {
  const t = useTranslations("whatsappTemplates.form.editor.header");

  const formats = [
    { value: "TEXT", label: t("formats.text"), icon: TextT },
    { value: "IMAGE", label: t("formats.image"), icon: ImageIcon },
    { value: "VIDEO", label: t("formats.video"), icon: VideoCamera },
    { value: "DOCUMENT", label: t("formats.document"), icon: File },
    { value: "LOCATION", label: t("formats.location"), icon: MapPin },
    { value: "GIF", label: t("formats.gif"), icon: Gif },
  ];

  const headerFileInputRef = useRef<HTMLInputElement>(null);
  const [headerUploading, setHeaderUploading] = useState(false);
  const [headerUploadError, setHeaderUploadError] = useState<string | null>(null);

  const handleHeaderMediaUpload = async (
    e: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setHeaderUploadError(null);
    setHeaderUploading(true);
    try {
      const result = await uploadTemplateHeaderMediaAction(file);
      if (result.success && result.url) {
        updateData({ example: result.url });
      } else {
        setHeaderUploadError(result.error || t("mediaUploadError"));
      }
    } catch {
      setHeaderUploadError(t("mediaUploadError"));
    } finally {
      setHeaderUploading(false);
    }
  };

  return (
    <div data-tour="wt-header-editor" className="space-y-4">
      <div>
        <p className="legend mb-2">{t("type")}</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" data-tour="wt-header-formats">
          {formats.map((format) => {
            const Icon = format.icon;
            const isSelected = component.data.format === format.value;
            return (
              <button
                key={format.value}
                type="button"
                aria-pressed={isSelected}
                onClick={() =>
                  updateData({
                    format: format.value,
                    text:
                      format.value === "TEXT"
                        ? component.data.text || ""
                        : undefined,
                    example:
                      format.value !== "TEXT"
                        ? component.data.example
                        : undefined,
                  })
                }
                className={`flex items-center gap-2 rounded-[--radius] border px-3 py-2 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  isSelected
                    ? "border-primary-edge bg-primary text-primary-foreground shadow-button-primary"
                    : "border-control-edge bg-card text-foreground hover:bg-muted"
                }`}
              >
                <Icon className="h-4 w-4" weight="duotone" />
                <span className="text-xs font-medium">{format.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {component.data.format === "TEXT" && (
        <div>
          <ElevatedInput
            label={t("text")}
            placeholder={t("textPlaceholder")}
            value={component.data.text || ""}
            onChange={(e) => updateData({ text: e.target.value })}
            maxLength={60}
          />
          <CharCount count={component.data.text?.length || 0} limit={60} />
        </div>
      )}

      {component.data.format !== "TEXT" && (
        <>
          <div>
            <label className="block text-xs font-medium text-foreground mb-2">
              {t("mediaUrl")}
            </label>
            <p className="text-xs text-muted-foreground mb-2">
              {t("mediaUrlHint", {
                format: component.data.format?.toLowerCase() || "media",
              })}
            </p>
            <ElevatedInput
              placeholder={`https://example.com/${
                component.data.format?.toLowerCase() || "media"
              }.${
                component.data.format === "IMAGE"
                  ? "jpg"
                  : component.data.format === "VIDEO"
                    ? "mp4"
                    : component.data.format === "DOCUMENT"
                      ? "pdf"
                      : "gif"
              }`}
              value={component.data.example || ""}
              onChange={(e) => updateData({ example: e.target.value })}
            />
            <input
              ref={headerFileInputRef}
              type="file"
              accept={headerAcceptFor(component.data.format)}
              className="hidden"
              onChange={handleHeaderMediaUpload}
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => headerFileInputRef.current?.click()}
                disabled={headerUploading}
                className="inline-flex items-center gap-2 rounded-[--radius] border border-control-edge bg-card px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
              >
                <ImageIcon className="h-4 w-4" weight="duotone" />
                {headerUploading ? t("mediaUploading") : t("mediaUploadButton")}
              </button>
              <span className="text-xs text-muted-foreground">
                {t("mediaUploadHint")}
              </span>
            </div>
            {headerUploadError && (
              <p className="text-xs text-destructive-ink mt-1">{headerUploadError}</p>
            )}
          </div>

          {component.data.format === "LOCATION" && (
            <>
              <ElevatedInput
                label={t("locationName")}
                placeholder={t("locationNamePlaceholder")}
                value={component.data.locationName || ""}
                onChange={(e) => updateData({ locationName: e.target.value })}
              />
              <ElevatedInput
                label={t("locationAddress")}
                placeholder={t("locationAddressPlaceholder")}
                value={component.data.locationAddress || ""}
                onChange={(e) =>
                  updateData({ locationAddress: e.target.value })
                }
              />
            </>
          )}
        </>
      )}
    </div>
  );
}

function BodyEditor({
  component,
  updateData,
  category,
}: {
  component: DraggableComponent;
  updateData: (updates: Partial<DraggableComponent["data"]>) => void;
  category: TemplateCategory;
}) {
  const t = useTranslations("whatsappTemplates.form.editor");

  if (category === "AUTHENTICATION") {
    return <AuthenticationBodyEditor component={component} updateData={updateData} />;
  }

  const insertVariable = () => {
    const text = component.data.text || "";
    const variableCount = (text.match(/\{\{\d+\}\}/g) || []).length;
    const newVariable = `{{${variableCount + 1}}}`;
    updateData({ text: text + newVariable });
  };

  const { type: varType, variables } = detectVariables(
    component.data.text || "",
  );
  const variableExamples = component.data.variableExamples || [];
  const namedVariableExamples = component.data.namedVariableExamples || {};

  const updateVariableExample = (index: number, value: string) => {
    const newExamples = [...variableExamples];
    while (newExamples.length <= index) {
      newExamples.push("");
    }
    newExamples[index] = value;
    updateData({ variableExamples: newExamples });
  };

  const updateNamedVariableExample = (varName: string, value: string) => {
    updateData({
      namedVariableExamples: {
        ...namedVariableExamples,
        [varName]: value,
      },
    });
  };

  return (
    <div data-tour="wt-body-editor" className="space-y-4">
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="legend">
            {t("body.messageText")}
          </p>
          <button
            type="button"
            onClick={insertVariable}
            className="flex items-center gap-1 rounded-[--radius] px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Plus className="h-3 w-3" weight="bold" />
            {t("body.addVariable")}
          </button>
        </div>
        <ElevatedTextarea
          placeholder={t("body.messagePlaceholder")}
          value={component.data.text || ""}
          onChange={(e) => updateData({ text: e.target.value })}
          rows={6}
          maxLength={1024}
        />
        <CharCount count={component.data.text?.length || 0} limit={1024} />
      </div>

      {variables.length > 0 && (
        <div data-tour="wt-body-variables">
          <Notice tone="warning" title={t("body.examplesRequired.title")}>
          <p className="text-muted-foreground">
            {t("body.examplesRequired.description")}
          </p>
          <div className="space-y-2 pt-1">
            {varType === "positional"
              ?
                variables.map((varNum) => (
                  <div key={varNum} className="flex items-center gap-2">
                    <code className="bg-warning px-2 py-1 rounded text-xs font-mono text-warning-foreground shrink-0">
                      {`{{${varNum}}}`}
                    </code>
                    <ElevatedInput
                      placeholder={t("body.examplesRequired.placeholder", {
                        variable: `{{${varNum}}}`,
                      })}
                      value={variableExamples[parseInt(varNum) - 1] || ""}
                      onChange={(e) =>
                        updateVariableExample(
                          parseInt(varNum) - 1,
                          e.target.value,
                        )
                      }
                      className="flex-1 !py-1.5 !text-xs"
                    />
                  </div>
                ))
              :
                variables.map((varName) => (
                  <div key={varName} className="flex items-center gap-2">
                    <code className="bg-warning px-2 py-1 rounded text-xs font-mono text-warning-foreground shrink-0">
                      {`{{${varName}}}`}
                    </code>
                    <ElevatedInput
                      placeholder={t("body.examplesRequired.placeholder", {
                        variable: `{{${varName}}}`,
                      })}
                      value={namedVariableExamples[varName] || ""}
                      onChange={(e) =>
                        updateNamedVariableExample(varName, e.target.value)
                      }
                      className="flex-1 !py-1.5 !text-xs"
                    />
                  </div>
                ))}
          </div>
          </Notice>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">{t("body.variablesTitle")}: </span>
        {t("body.variablesHint")}
      </p>
    </div>
  );
}

function FooterEditor({
  component,
  updateData,
  category,
}: {
  component: DraggableComponent;
  updateData: (updates: Partial<DraggableComponent["data"]>) => void;
  category: TemplateCategory;
}) {
  const t = useTranslations("whatsappTemplates.form.editor.footer");
  const exitT = useTranslations("templateExit.builder");

  if (category === "AUTHENTICATION") {
    return <AuthenticationFooterEditor component={component} updateData={updateData} />;
  }

  return (
    <div data-tour="wt-footer-editor">
      <ElevatedInput
        label={t("text")}
        placeholder={t("textPlaceholder")}
        value={component.data.text || ""}
        onChange={(e) => updateData({ text: e.target.value })}
        maxLength={FOOTER_TEXT_LIMIT}
      />
      <CharCount count={component.data.text?.length || 0} limit={FOOTER_TEXT_LIMIT} />
      <p className="mt-2 text-xs text-muted-foreground">{exitT("footerHint")}</p>
      <div className="mt-4">
        <ExitConfirmationField value={component.data.exitConfirmation ?? ""} onChange={(exitConfirmation) => updateData({ exitConfirmation })} />
      </div>
    </div>
  );
}

function ButtonsEditor({
  component,
  updateData,
  category,
  allowedKinds,
}: {
  component: DraggableComponent;
  updateData: (updates: Partial<DraggableComponent["data"]>) => void;
  category: TemplateCategory;
  allowedKinds: readonly string[];
}) {
  const t = useTranslations("whatsappTemplates.form.editor.buttons");
  const exitT = useTranslations("templateExit");
  const labelOf = useButtonActionLabel();
  const buttons = component.data.buttons || [];

  const addButton = (type: string) => {
    if (buttons.length >= MAX_BUILDER_BUTTONS) return;

    const newButton: NonNullable<DraggableComponent["data"]["buttons"]>[0] = {
      id: `btn-${crypto.randomUUID()}`,
      type,
    };

    if (type === "QUICK_REPLY") {
      newButton.text = "";
    } else if (type === "URL") {
      newButton.text = "";
      newButton.url = "";
    } else if (type === "PHONE_NUMBER") {
      newButton.text = "";
      newButton.phone_number = "";
    } else if (type === "COPY_CODE") {
      newButton.example = "";
    } else if (type === "OTP") {
      newButton.otp_type = "COPY_CODE";
    }

    updateData({ buttons: [...buttons, newButton] });
  };

  const removeButton = (index: number) => {
    updateData({ buttons: buttons.filter((_button, i) => i !== index) });
  };

  const updateButton = (
    index: number,
    updates: Partial<NonNullable<DraggableComponent["data"]["buttons"]>[0]>,
  ) => {
    const newButtons = [...buttons];
    newButtons[index] = { ...newButtons[index], ...updates };
    updateData({ buttons: newButtons });
  };

  const buttonTypes =
    category === "AUTHENTICATION"
      ? [{ value: "OTP", label: t("types.otp"), icon: Copy }]
      : [
          { value: "QUICK_REPLY", label: t("types.quickReply"), icon: ChatCircle },
          { value: "URL", label: t("types.url"), icon: Link },
          { value: "PHONE_NUMBER", label: t("types.phone"), icon: Phone },
          { value: "COPY_CODE", label: t("types.copyCode"), icon: Copy },
        ];

  return (
    <>
      <div data-tour="wt-buttons-editor">
        <label className="block text-xs font-medium text-foreground mb-2">
          {t("title", { count: buttons.length })}
        </label>

        {buttons.length === 0 && (
          <div className="rounded-lg border border-dashed border-border-strong px-4 py-5 text-center">
            <p className="text-xs text-muted-foreground mb-3">{t("empty")}</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {buttonTypes.map((type) => (
                <AddButtonChip key={type.value} icon={type.icon} label={type.label} onClick={() => addButton(type.value)} />
              ))}
            </div>
          </div>
        )}

        <div className="space-y-3">
          {buttons.map((button, index: number) => (
            <motion.div
              key={button.id}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="border border-border rounded-lg p-3 bg-card"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-foreground">
                  {t("item", { index: index + 1 })} · {buttonTypes.find((type) => type.value === button.type)?.label ?? button.type}
                </span>
                <button
                  type="button"
                  aria-label={t("remove", { index: index + 1 })}
                  onClick={() => removeButton(index)}
                  className="rounded-[--radius] p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Trash className="h-3.5 w-3.5" />
                </button>
              </div>

              {button.type === "QUICK_REPLY" && (
                <>
                  <ElevatedInput
                    placeholder={t("textPlaceholder")}
                    value={button.text || ""}
                    onChange={(e) =>
                      updateButton(index, { text: e.target.value })
                    }
                    maxLength={BUTTON_TEXT_LIMIT}
                  />
                  <CharCount count={button.text?.length || 0} limit={BUTTON_TEXT_LIMIT} />
                  <CircuitRoutes
                    className="mt-3"
                    label={exitT("campaign.destinations")}
                    routes={[
                      {
                        key: button.id,
                        name: exitT("campaign.destination", { text: button.text || t("textPlaceholder"), action: labelOf(button.action ?? null) }),
                        state: button.action ? "linked" : "open",
                        targetAnchor: FIELD_ANCHOR,
                        source: <QuickReplyChip text={button.text || t("textPlaceholder")} />,
                        target: (
                          <RouteCard>
                            <ButtonActionFields
                              value={button.action ?? null}
                              kinds={offeredKinds(BUTTON_ACTION_KINDS, allowedKinds)}
                              onChange={(action) => updateButton(index, { action: action ?? undefined })}
                            />
                          </RouteCard>
                        ),
                      },
                    ]}
                  />
                </>
              )}

              {button.type === "URL" && (
                <div className="space-y-2">
                  <div>
                    <ElevatedInput
                      placeholder={t("textPlaceholder")}
                      value={button.text || ""}
                      onChange={(e) =>
                        updateButton(index, { text: e.target.value })
                      }
                      maxLength={BUTTON_TEXT_LIMIT}
                    />
                    <CharCount count={button.text?.length || 0} limit={BUTTON_TEXT_LIMIT} />
                  </div>
                  <ElevatedInput
                    placeholder={t("urlPlaceholder")}
                    value={button.url || ""}
                    onChange={(e) =>
                      updateButton(index, { url: e.target.value })
                    }
                  />
                </div>
              )}

              {button.type === "PHONE_NUMBER" && (
                <div className="space-y-2">
                  <div>
                    <ElevatedInput
                      placeholder={t("textPlaceholder")}
                      value={button.text || ""}
                      onChange={(e) =>
                        updateButton(index, { text: e.target.value })
                      }
                      maxLength={BUTTON_TEXT_LIMIT}
                    />
                    <CharCount count={button.text?.length || 0} limit={BUTTON_TEXT_LIMIT} />
                  </div>
                  <ElevatedInput
                    placeholder={t("phonePlaceholder")}
                    value={button.phone_number || ""}
                    onChange={(e) =>
                      updateButton(index, { phone_number: e.target.value })
                    }
                  />
                </div>
              )}

              {button.type === "COPY_CODE" && (
                <ElevatedInput
                  placeholder={t("codePlaceholder")}
                  value={button.example || ""}
                  onChange={(e) =>
                    updateButton(index, { example: e.target.value })
                  }
                />
              )}

              {button.type === "OTP" && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    {t("otpHint")}
                  </p>
                  <div>
                    <ElevatedInput
                      placeholder={t("otpLabelPlaceholder")}
                      value={button.text || ""}
                      onChange={(e) =>
                        updateButton(index, { text: e.target.value })
                      }
                      maxLength={25}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("otpLabelOptional")}
                    </p>
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {buttons.length > 0 && buttons.length < MAX_BUILDER_BUTTONS && (
          <div className="mt-3">
            <p className="text-xs text-muted-foreground mb-2">{t("add")}</p>
            <div className="flex flex-wrap gap-2">
              {buttonTypes.map((type) => (
                <AddButtonChip key={type.value} icon={type.icon} label={type.label} onClick={() => addButton(type.value)} />
              ))}
            </div>
          </div>
        )}
      </div>

      {buttons.length >= MAX_BUILDER_BUTTONS && (
        <Notice tone="warning" className="mt-3">{t("maxReached")}</Notice>
      )}
    </>
  );
}

function AddButtonChip({ icon: Glyph, label, onClick }: { icon: Icon; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-[--radius] border border-control-edge bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors duration-150 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Plus className="h-3 w-3" weight="bold" aria-hidden />
      <Glyph className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
      {label}
    </button>
  );
}

function AuthenticationBodyEditor({
  component,
  updateData,
}: {
  component: DraggableComponent;
  updateData: (updates: Partial<DraggableComponent["data"]>) => void;
}) {
  const t = useTranslations("whatsappTemplates.form.editor.authentication");

  return (
    <div className="space-y-3" data-tour="wt-auth-body-editor">
      <div className="rounded-lg border border-border bg-muted p-3">
        <p className="text-xs text-muted-foreground">{t("bodyOwnedByMeta")}</p>
      </div>

      <label className="flex cursor-pointer items-start gap-2.5 text-xs text-foreground">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={component.data.add_security_recommendation ?? false}
          onChange={(e) =>
            updateData({ add_security_recommendation: e.target.checked })
          }
        />
        <span>
          {t("securityRecommendation")}
          <span className="mt-0.5 block text-muted-foreground">
            {t("securityRecommendationHint")}
          </span>
        </span>
      </label>
    </div>
  );
}

function AuthenticationFooterEditor({
  component,
  updateData,
}: {
  component: DraggableComponent;
  updateData: (updates: Partial<DraggableComponent["data"]>) => void;
}) {
  const t = useTranslations("whatsappTemplates.form.editor.authentication");
  const minutes = component.data.code_expiration_minutes;

  return (
    <div className="space-y-3" data-tour="wt-auth-footer-editor">
      <div className="rounded-lg border border-border bg-muted p-3">
        <p className="text-xs text-muted-foreground">{t("footerOwnedByMeta")}</p>
      </div>

      <label className="flex cursor-pointer items-center gap-2.5 text-xs text-foreground">
        <input
          type="checkbox"
          checked={minutes !== undefined}
          onChange={(e) =>
            updateData({
              code_expiration_minutes: e.target.checked ? 10 : undefined,
            })
          }
        />
        {t("showExpiry")}
      </label>

      {minutes !== undefined && (
        <div>
          <ElevatedInput
            type="number"
            min={1}
            max={90}
            label={t("expiryMinutes")}
            value={String(minutes)}
            onChange={(e) => {
              const next = Number(e.target.value);
              if (Number.isNaN(next)) return;
              updateData({
                code_expiration_minutes: Math.min(90, Math.max(1, next)),
              });
            }}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            {t("expiryMinutesHint")}
          </p>
        </div>
      )}
    </div>
  );
}
