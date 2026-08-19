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
} from "@/components/icons";

import { DraggableComponent } from "./DragDropBuilder";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import ElevatedTextarea from "@/components/elevated-design/elevated-textarea";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { useRef, useState, type ChangeEvent } from "react";
import { uploadTemplateHeaderMediaAction } from "@/app/actions/whatsapp-templates";

// headerAcceptFor limits the file picker to the asset types WhatsApp accepts for
// the selected header format, matching the backend validation.
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
  component: DraggableComponent | null;
  onChange: (component: DraggableComponent) => void;
}

export default function ComponentEditor({
  component,
  onChange,
}: ComponentEditorProps) {
  const t = useTranslations("whatsappTemplates.form.editor");
  const componentTypeT = useTranslations("whatsappTemplates.componentType");

  if (!component) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
          <ChatCircle
            className="h-8 w-8 text-muted-foreground"
            weight="duotone"
          />
        </div>
        <h3 className="text-sm font-semibold text-foreground mb-1">
          {t("noSelection.title")}
        </h3>
        <p className="text-xs text-muted-foreground max-w-xs">
          {t("noSelection.description")}
        </p>
      </div>
    );
  }

  const updateData = (updates: Partial<DraggableComponent["data"]>) => {
    onChange({
      ...component,
      data: { ...component.data, ...updates },
    });
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="sticky top-0 bg-card border-b border-border p-4 mb-4 z-10">
        <h3 className="text-sm font-semibold text-foreground">
          {t("editComponent", { type: componentTypeT(component.type) })}
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          {t("configureHint")}
        </p>
      </div>

      <div className="p-4 space-y-4">
        {component.type === "HEADER" && (
          <HeaderEditor component={component} updateData={updateData} />
        )}
        {component.type === "BODY" && (
          <BodyEditor component={component} updateData={updateData} />
        )}
        {component.type === "FOOTER" && (
          <FooterEditor component={component} updateData={updateData} />
        )}
        {component.type === "BUTTONS" && (
          <ButtonsEditor component={component} updateData={updateData} />
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
      <div className="flex items-start gap-3 rounded-lg border border-border bg-muted p-4">
        <div className="tile-info flex h-9 w-9 flex-shrink-0 items-center justify-center">
          <PhoneCall className="h-5 w-5" weight="duotone" />
        </div>
        <div className="min-w-0">
          <h4 className="text-xs font-semibold text-foreground">
            {t("title")}
          </h4>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("description")}
          </p>
        </div>
      </div>
      <div className="rounded-lg bg-muted p-3">
        <p className="text-xs text-muted-foreground">{t("noFields")}</p>
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

  // Upload the chosen header asset to our storage and drop the returned public
  // URL straight into the example field, so the user never has to host it
  // elsewhere. The create flow consumes that URL exactly like a pasted link.
  const handleHeaderMediaUpload = async (
    e: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file after an error
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
    <div data-tour="wt-header-editor">
      <div>
        <label className="block text-xs font-medium text-foreground mb-2">
          {t("type")}
        </label>
        <div className="grid grid-cols-2 gap-2" data-tour="wt-header-formats">
          {formats.map((format) => {
            const Icon = format.icon;
            const isSelected = component.data.format === format.value;
            return (
              <button
                key={format.value}
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
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-left ${
                  isSelected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border hover:border-foreground/20 text-foreground"
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
        <>
          <ElevatedInput
            label={t("text")}
            placeholder={t("textPlaceholder")}
            value={component.data.text || ""}
            onChange={(e) => updateData({ text: e.target.value })}
            maxLength={60}
          />
          <p className="text-xs text-muted-foreground mt-1">
            {component.data.text?.length || 0}/60 characters
          </p>
        </>
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
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => headerFileInputRef.current?.click()}
                disabled={headerUploading}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-xs font-medium hover:border-foreground/20 disabled:opacity-60"
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
}: {
  component: DraggableComponent;
  updateData: (updates: Partial<DraggableComponent["data"]>) => void;
}) {
  const t = useTranslations("whatsappTemplates.form.editor");

  const insertVariable = () => {
    const text = component.data.text || "";
    const variableCount = (text.match(/\{\{\d+\}\}/g) || []).length;
    const newVariable = `{{${variableCount + 1}}}`;
    updateData({ text: text + newVariable });
  };

  const detectVariables = (
    text: string,
  ): { type: "positional" | "named"; variables: string[] } => {
    const positionalMatches = [...text.matchAll(/\{\{(\d+)\}\}/g)].map(
      (m) => m[1],
    );
    const namedMatches = [
      ...text.matchAll(/\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g),
    ].map((m) => m[1]);

    if (positionalMatches.length > 0) {
      return {
        type: "positional",
        variables: [...new Set(positionalMatches)].sort(
          (a, b) => parseInt(a) - parseInt(b),
        ),
      };
    }
    if (namedMatches.length > 0) {
      return { type: "named", variables: [...new Set(namedMatches)] };
    }
    return { type: "positional", variables: [] };
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
          <label className="block text-xs font-medium text-foreground">
            {t("body.messageText")}
          </label>
          <button
            onClick={insertVariable}
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary-ink hover:text-primary-ink hover:bg-muted rounded-lg transition-colors"
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
        <p className="text-xs text-muted-foreground mt-1">
          {component.data.text?.length || 0}/1024 characters
        </p>
      </div>

      {variables.length > 0 && (
        <div className="bg-muted border border-border rounded-lg p-3"data-tour="wt-body-variables">
          <h4 className="text-xs font-semibold text-warning-ink mb-2 flex items-center gap-1">
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-muted text-2xs font-semibold text-warning-ink">
              !
            </span>
            {t("body.examplesRequired.title")}
          </h4>
          <p className="text-xs text-warning-ink mb-3">
            {t("body.examplesRequired.description")}
          </p>
          <div className="space-y-2">
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
        </div>
      )}

      <div className="bg-muted border border-border rounded-lg p-3">
        <h4 className="text-xs font-semibold text-primary-ink mb-1">
          {t("body.variablesTitle")}
        </h4>
        <p className="text-xs text-primary-ink">{t("body.variablesHint")}</p>
      </div>
    </div>
  );
}

function FooterEditor({
  component,
  updateData,
}: {
  component: DraggableComponent;
  updateData: (updates: Partial<DraggableComponent["data"]>) => void;
}) {
  const t = useTranslations("whatsappTemplates.form.editor.footer");

  return (
    <div data-tour="wt-footer-editor">
      <ElevatedInput
        label={t("text")}
        placeholder={t("textPlaceholder")}
        value={component.data.text || ""}
        onChange={(e) => updateData({ text: e.target.value })}
        maxLength={60}
      />
      <p className="text-xs text-muted-foreground mt-1">
        {component.data.text?.length || 0}/60 characters
      </p>
    </div>
  );
}

function ButtonsEditor({
  component,
  updateData,
}: {
  component: DraggableComponent;
  updateData: (updates: Partial<DraggableComponent["data"]>) => void;
}) {
  const t = useTranslations("whatsappTemplates.form.editor.buttons");
  const buttons = component.data.buttons || [];

  const addButton = (type: string) => {
    if (buttons.length >= 3) return;

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

  const buttonTypes = [
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
          <div className="text-center py-6 px-4 border border-dashed border-border rounded-lg">
            <p className="text-xs text-muted-foreground mb-3">{t("empty")}</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {buttonTypes.map((type) => {
                const Icon = type.icon;
                return (
                  <button
                    key={type.value}
                    onClick={() => addButton(type.value)}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-foreground hover:text-primary-ink bg-card hover:bg-muted border border-border hover:border-border rounded-lg transition-all"
                  >
                    <Icon className="h-3 w-3" />
                    {type.label}
                  </button>
                );
              })}
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
                  {t("textLabel")} {index + 1} - {button.type.replace("_", " ")}
                </span>
                <button
                  onClick={() => removeButton(index)}
                  className="p-1 text-muted-foreground hover:text-destructive-ink hover:bg-muted rounded transition-colors"
                >
                  <Trash className="h-3 w-3" weight="bold" />
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
                    maxLength={20}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {button.text?.length || 0}/20 characters
                  </p>
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
                      maxLength={20}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {button.text?.length || 0}/20 characters
                    </p>
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
                      maxLength={20}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {button.text?.length || 0}/20 characters
                    </p>
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
            </motion.div>
          ))}
        </div>

        {buttons.length > 0 && buttons.length < 3 && (
          <div className="mt-3">
            <p className="text-xs text-muted-foreground mb-2">{t("add")}</p>
            <div className="flex flex-wrap gap-2">
              {buttonTypes.map((type) => {
                const Icon = type.icon;
                return (
                  <button
                    key={type.value}
                    onClick={() => addButton(type.value)}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-foreground hover:text-primary-ink bg-card hover:bg-muted border border-border hover:border-border rounded-lg transition-all"
                  >
                    <Icon className="h-3 w-3" />
                    {type.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {buttons.length >= 3 && (
        <div className="bg-muted border border-border rounded-lg p-3">
          <p className="text-xs text-warning-ink">{t("maxReached")}</p>
        </div>
      )}
    </>
  );
}
