"use client";

import { AnimatePresence, motion } from "framer-motion";
import type {
  ButtonType,
  HeaderFormat,
  TemplateCategory,
  TemplateComponent,
  WhatsAppTemplate,
} from "@/lib/whatsapp-templates/types";
import {
  ChatCircle,
  CheckCircle,
  CircleNotch,
  Cursor,
  Plus,
  TextT,
  Trash,
  Warning,
  WhatsappLogo,
  X,
} from "@/components/icons";
import ElevatedSelect, {
  ElevatedSelectItem,
} from "@/components/elevated-design/elevated-select";
import { useState, useTransition } from "react";

import Button from "@/components/elevated-design/button";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import ElevatedTextarea from "@/components/elevated-design/elevated-textarea";
import { createPortal } from "react-dom";
import { createWhatsAppTemplateAction } from "@/app/actions/whatsapp-templates";
import { useToast } from "@/hooks/use-toast";
import { useTranslations } from "next-intl";

interface CreateTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTemplateCreated: (template: WhatsAppTemplate) => void;
  businessPhoneId?: string;
}

const categories: TemplateCategory[] = [
  "MARKETING",
  "UTILITY",
  "AUTHENTICATION",
];
const languageOptions = ["pt_BR", "en_US", "es", "de"];
const headerFormats: HeaderFormat[] = ["TEXT", "IMAGE", "VIDEO", "DOCUMENT"];
const buttonTypes: ButtonType[] = ["URL", "PHONE_NUMBER", "QUICK_REPLY"];

const POSITIONAL_VAR_REGEX = /\{\{(\d+)\}\}/g;
const NAMED_VAR_REGEX = /\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g;

function extractVariables(text: string): {
  type: "positional" | "named";
  variables: string[];
} {
  const positionalMatches = [...text.matchAll(POSITIONAL_VAR_REGEX)].map(
    (m) => m[1],
  );
  const namedMatches = [...text.matchAll(NAMED_VAR_REGEX)].map((m) => m[1]);

  if (positionalMatches.length > 0) {
    return { type: "positional", variables: [...new Set(positionalMatches)] };
  }
  if (namedMatches.length > 0) {
    return { type: "named", variables: [...new Set(namedMatches)] };
  }
  return { type: "positional", variables: [] };
}

function hasVariableAtBoundary(text: string): {
  atStart: boolean;
  atEnd: boolean;
} {
  const trimmed = text.trim();
  const atStart = /^\{\{[^}]+\}\}/.test(trimmed);
  const atEnd = /\{\{[^}]+\}\}$/.test(trimmed);
  return { atStart, atEnd };
}

export default function CreateTemplateDialog({
  open,
  onOpenChange,
  onTemplateCreated,
  businessPhoneId: propBusinessPhoneId,
}: CreateTemplateDialogProps) {
  const t = useTranslations("whatsappTemplates");
  const tAgents = useTranslations("agents.form");
  const { toast } = useToast();
  const [saving, startSaving] = useTransition();

  const [name, setName] = useState("");
  const [category, setCategory] = useState<TemplateCategory>("UTILITY");
  const [language, setLanguage] = useState("pt_BR");
  const [components, setComponents] = useState<TemplateComponent[]>([
    { type: "BODY", text: "" },
  ]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [bodyExamples, setBodyExamples] = useState<Record<string, string>>({});
  const [headerExamples, setHeaderExamples] = useState<Record<string, string>>(
    {},
  );

  const bodyComponent = components.find((c) => c.type === "BODY");
  const headerComponent = components.find((c) => c.type === "HEADER");

  const bodyVars = bodyComponent?.text
    ? extractVariables(bodyComponent.text)
    : { type: "positional" as const, variables: [] };
  const headerVars =
    headerComponent?.text && headerComponent.format === "TEXT"
      ? extractVariables(headerComponent.text)
      : { type: "positional" as const, variables: [] };

  const hasHeader = components.some((c) => c.type === "HEADER");
  const hasFooter = components.some((c) => c.type === "FOOTER");
  const hasButtons = components.some((c) => c.type === "BUTTONS");

  const addComponent = (type: TemplateComponent["type"]) => {
    if (type === "HEADER") {
      setComponents([
        { type: "HEADER", format: "TEXT", text: "" },
        ...components,
      ]);
    } else if (type === "FOOTER") {
      setComponents([...components, { type: "FOOTER", text: "" }]);
    } else if (type === "BUTTONS") {
      setComponents([
        ...components,
        { type: "BUTTONS", buttons: [{ type: "QUICK_REPLY", text: "" }] },
      ]);
    }
  };

  const removeComponent = (type: TemplateComponent["type"]) => {
    setComponents(components.filter((c) => c.type !== type));
  };

  const updateComponent = (
    type: TemplateComponent["type"],
    updates: Partial<TemplateComponent>,
  ) => {
    setComponents(
      components.map((c) => (c.type === type ? { ...c, ...updates } : c)),
    );
  };

  const addButton = () => {
    const buttonsComponent = components.find((c) => c.type === "BUTTONS");
    if (buttonsComponent && (buttonsComponent.buttons?.length ?? 0) < 3) {
      updateComponent("BUTTONS", {
        buttons: [
          ...(buttonsComponent.buttons ?? []),
          { type: "QUICK_REPLY", text: "" },
        ],
      });
    }
  };

  const removeButton = (index: number) => {
    const buttonsComponent = components.find((c) => c.type === "BUTTONS");
    if (buttonsComponent) {
      const newButtons = [...(buttonsComponent.buttons ?? [])];
      newButtons.splice(index, 1);
      if (newButtons.length === 0) {
        removeComponent("BUTTONS");
      } else {
        updateComponent("BUTTONS", { buttons: newButtons });
      }
    }
  };

  const updateButton = (
    index: number,
    updates: Partial<{
      type: ButtonType;
      text: string;
      url?: string;
      phone_number?: string;
    }>,
  ) => {
    const buttonsComponent = components.find((c) => c.type === "BUTTONS");
    if (buttonsComponent) {
      const newButtons = [...(buttonsComponent.buttons ?? [])];
      newButtons[index] = { ...newButtons[index], ...updates };
      updateComponent("BUTTONS", { buttons: newButtons });
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = t("form.validation.nameRequired");
    }

    const bodyComp = components.find((c) => c.type === "BODY");
    if (!bodyComp?.text?.trim()) {
      newErrors.body = t("form.validation.bodyRequired");
    } else {
      const bodyBoundary = hasVariableAtBoundary(bodyComp.text);
      if (bodyBoundary.atStart) {
        newErrors.bodyStart = t("form.validation.noVariableAtStart");
      }
      if (bodyBoundary.atEnd) {
        newErrors.bodyEnd = t("form.validation.noVariableAtEnd");
      }

      if (bodyVars.variables.length > 0) {
        const missingExamples = bodyVars.variables.filter(
          (v) => !bodyExamples[v]?.trim(),
        );
        if (missingExamples.length > 0) {
          newErrors.bodyExamples = t("form.validation.examplesRequired", {
            variables: missingExamples.map((v) => `{{${v}}}`).join(", "),
          });
        }
      }
    }

    const headerComp = components.find((c) => c.type === "HEADER");
    if (headerComp?.text?.trim() && headerComp.format === "TEXT") {
      const headerBoundary = hasVariableAtBoundary(headerComp.text);
      if (headerBoundary.atStart) {
        newErrors.headerStart = t("form.validation.noVariableAtStart");
      }
      if (headerBoundary.atEnd) {
        newErrors.headerEnd = t("form.validation.noVariableAtEnd");
      }

      if (headerVars.variables.length > 0) {
        const missingHeaderExamples = headerVars.variables.filter(
          (v) => !headerExamples[v]?.trim(),
        );
        if (missingHeaderExamples.length > 0) {
          newErrors.headerExamples = t(
            "form.validation.headerExamplesRequired",
            {
              variables: missingHeaderExamples
                .map((v) => `{{${v}}}`)
                .join(", "),
            },
          );
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    startSaving(async () => {
      const processedComponents = components
        .filter((c) => {
          if (c.type === "BODY") return true;
          if (c.type === "HEADER" && c.text?.trim()) return true;
          if (c.type === "FOOTER" && c.text?.trim()) return true;
          if (c.type === "BUTTONS" && c.buttons?.length) return true;
          return false;
        })
        .map((c) => {
          if (c.type === "BODY" && bodyVars.variables.length > 0) {
            const example =
              bodyVars.type === "named"
                ? {
                    body_text_named_params: bodyVars.variables.map((v) => ({
                      param_name: v,
                      example: bodyExamples[v] || "",
                    })),
                  }
                : {
                    body_text: [
                      bodyVars.variables.map((v) => bodyExamples[v] || ""),
                    ],
                  };
            return { ...c, example };
          }

          if (
            c.type === "HEADER" &&
            c.format === "TEXT" &&
            headerVars.variables.length > 0
          ) {
            const example =
              headerVars.type === "named"
                ? {
                    header_text_named_params: headerVars.variables.map((v) => ({
                      param_name: v,
                      example: headerExamples[v] || "",
                    })),
                  }
                : {
                    header_text: headerVars.variables.map(
                      (v) => headerExamples[v] || "",
                    ),
                  };
            return { ...c, example };
          }

          return c;
        });

      const usesNamedParams =
        bodyVars.type === "named" || headerVars.type === "named";

      const payload = {
        name: name.trim(),
        category,
        language,
        businessPhoneId: propBusinessPhoneId ?? "",
        ...(usesNamedParams && { parameterFormat: "named" as const }),
        components: processedComponents,
      };

      const result = await createWhatsAppTemplateAction(payload);

      if (result.error || !result.template) {
        toast({
          title: t("toast.createError"),
          description: result.error ?? t("toast.createErrorDesc"),
          variant: "destructive",
        });
        return;
      }

      toast({
        title: t("toast.createSuccess"),
        description: t("toast.createSuccessDesc"),
      });

      onTemplateCreated(result.template);
      resetForm();
    });
  };

  const resetForm = () => {
    setName("");
    setCategory("UTILITY");
    setLanguage("pt_BR");
    setComponents([{ type: "BODY", text: "" }]);
    setErrors({});
    setBodyExamples({});
    setHeaderExamples({});
  };

  const handleClose = () => {
    onOpenChange(false);
    resetForm();
  };

  if (!open || typeof window === "undefined") return null;

  const dialogContent = (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 z-50 bg-black/50"
          />

          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="w-full max-w-2xl max-h-[90vh] overflow-y-auto pointer-events-auto"
            >
              <div className="rounded-[--radius] border border-border bg-card p-6 shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-[--radius] tile-healthy">
                      <WhatsappLogo
                        className="h-6 w-6 text-healthy-ink"
                        weight="fill"
                      />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-foreground">
                        {tAgents("dialog.createTemplate.title")}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {tAgents("dialog.createTemplate.description")}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleClose}
                    className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-muted-foreground transition-colors"
                  >
                    <X className="h-5 w-5" weight="bold" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="md:col-span-3">
                      <ElevatedInput
                        type="text"
                        label={t("form.labels.name")}
                        value={name}
                        onChange={(e) =>
                          setName(
                            e.target.value
                              .toLowerCase()
                              .replace(/[^a-z0-9_]/g, "_"),
                          )
                        }
                        className={errors.name ? "border-destructive/30" : ""}
                      />
                      {errors.name && (
                        <p className="mt-1 text-xs text-destructive-ink flex items-center gap-1">
                          <Warning className="h-3 w-3" /> {errors.name}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t("form.hints.name")}
                      </p>
                    </div>

                    <ElevatedSelect
                      value={language}
                      onValueChange={setLanguage}
                      label={t("form.labels.language")}
                    >
                      {languageOptions.map((lang) => (
                        <ElevatedSelectItem key={lang} value={lang}>
                          {t(`form.languages.${lang}`)}
                        </ElevatedSelectItem>
                      ))}
                    </ElevatedSelect>

                    <ElevatedSelect
                      value={category}
                      onValueChange={(v) => setCategory(v as TemplateCategory)}
                      label={t("form.labels.category")}
                    >
                      {categories.map((cat) => (
                        <ElevatedSelectItem key={cat} value={cat}>
                          {t(`category.${cat.toLowerCase()}`)}
                        </ElevatedSelectItem>
                      ))}
                    </ElevatedSelect>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-foreground">
                        {t("form.sections.components.title")}
                      </h3>
                      <div className="flex gap-2">
                        {!hasHeader && (
                          <button
                            type="button"
                            onClick={() => addComponent("HEADER")}
                            className="text-xs font-medium text-healthy-ink hover:text-healthy-ink"
                          >
                            + {t("form.addHeader")}
                          </button>
                        )}
                        {!hasFooter && (
                          <button
                            type="button"
                            onClick={() => addComponent("FOOTER")}
                            className="text-xs font-medium text-healthy-ink hover:text-healthy-ink"
                          >
                            + {t("form.addFooter")}
                          </button>
                        )}
                        {!hasButtons && (
                          <button
                            type="button"
                            onClick={() => addComponent("BUTTONS")}
                            className="text-xs font-medium text-healthy-ink hover:text-healthy-ink"
                          >
                            + {t("form.addButtons")}
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3">
                      {components.map((component) => (
                        <div
                          key={component.type}
                          className="p-4 rounded-[--radius] bg-muted border border-border"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              {component.type === "HEADER" && (
                                <TextT
                                  className="h-4 w-4 text-muted-foreground"
                                  weight="bold"
                                />
                              )}
                              {component.type === "BODY" && (
                                <ChatCircle
                                  className="h-4 w-4 text-muted-foreground"
                                  weight="fill"
                                />
                              )}
                              {component.type === "FOOTER" && (
                                <TextT
                                  className="h-4 w-4 text-muted-foreground"
                                  weight="bold"
                                />
                              )}
                              {component.type === "BUTTONS" && (
                                <Cursor
                                  className="h-4 w-4 text-muted-foreground"
                                  weight="fill"
                                />
                              )}
                              <span className="font-medium text-foreground">
                                {t(`componentType.${component.type}`)}
                              </span>
                              {component.type === "BODY" && (
                                <span className="text-xs text-destructive-ink">*</span>
                              )}
                            </div>
                            {component.type !== "BODY" && (
                              <button
                                type="button"
                                onClick={() => removeComponent(component.type)}
                                className="p-1 text-muted-foreground hover:text-destructive-ink"
                              >
                                <Trash className="h-4 w-4" weight="bold" />
                              </button>
                            )}
                          </div>

                          {component.type === "HEADER" && (
                            <div className="space-y-3">
                              <ElevatedSelect
                                value={component.format || "TEXT"}
                                onValueChange={(v) =>
                                  updateComponent("HEADER", {
                                    format: v as HeaderFormat,
                                  })
                                }
                                label={t("form.labels.format")}
                              >
                                {headerFormats.map((format) => (
                                  <ElevatedSelectItem
                                    key={format}
                                    value={format}
                                  >
                                    {t(`headerFormat.${format}`)}
                                  </ElevatedSelectItem>
                                ))}
                              </ElevatedSelect>
                              {component.format === "TEXT" && (
                                <>
                                  <ElevatedInput
                                    type="text"
                                    label={t("form.labels.headerText")}
                                    value={component.text || ""}
                                    onChange={(e) =>
                                      updateComponent("HEADER", {
                                        text: e.target.value,
                                      })
                                    }
                                  />
                                  {(errors.headerStart || errors.headerEnd) && (
                                    <p className="text-xs text-destructive-ink flex items-center gap-1">
                                      <Warning className="h-3 w-3" />{" "}
                                      {errors.headerStart || errors.headerEnd}
                                    </p>
                                  )}

                                  {/* Header variable examples */}
                                  {headerVars.variables.length > 0 && (
                                    <div className="p-3 rounded-lg bg-muted border border-border">
                                      <p className="text-xs font-medium text-warning-ink mb-2">
                                        {t(
                                          "form.editor.body.examplesRequired.title",
                                        )}
                                      </p>
                                      <div className="grid gap-2">
                                        {headerVars.variables.map((varName) => (
                                          <ElevatedInput
                                            key={varName}
                                            type="text"
                                            label={t(
                                              "form.editor.body.examplesRequired.placeholder",
                                              { variable: `{{${varName}}}` },
                                            )}
                                            value={
                                              headerExamples[varName] || ""
                                            }
                                            onChange={(e) =>
                                              setHeaderExamples((prev) => ({
                                                ...prev,
                                                [varName]: e.target.value,
                                              }))
                                            }
                                          />
                                        ))}
                                      </div>
                                      {errors.headerExamples && (
                                        <p className="mt-2 text-xs text-destructive-ink flex items-center gap-1">
                                          <Warning className="h-3 w-3" />{" "}
                                          {errors.headerExamples}
                                        </p>
                                      )}
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          )}

                          {component.type === "BODY" && (
                            <div className="space-y-2">
                              <ElevatedTextarea
                                label={t("form.labels.bodyText")}
                                value={component.text || ""}
                                onChange={(e) =>
                                  updateComponent("BODY", {
                                    text: e.target.value,
                                  })
                                }
                                rows={3}
                              />
                              <p className="text-xs text-muted-foreground">
                                {t("form.hints.body")}
                              </p>
                              {errors.body && (
                                <p className="text-xs text-destructive-ink flex items-center gap-1">
                                  <Warning className="h-3 w-3" /> {errors.body}
                                </p>
                              )}
                              {(errors.bodyStart || errors.bodyEnd) && (
                                <p className="text-xs text-destructive-ink flex items-center gap-1">
                                  <Warning className="h-3 w-3" />{" "}
                                  {errors.bodyStart || errors.bodyEnd}
                                </p>
                              )}

                              {/* Variable examples section */}
                              {bodyVars.variables.length > 0 && (
                                <div className="mt-3 p-3 rounded-lg bg-muted border border-border">
                                  <p className="text-xs font-medium text-warning-ink mb-2">
                                    {t(
                                      "form.editor.body.examplesRequired.title",
                                    )}
                                  </p>
                                  <p
                                    className="text-xs text-warning-ink mb-3"
                                    dangerouslySetInnerHTML={{
                                      __html: t(
                                        "form.editor.body.examplesRequired.description",
                                      ),
                                    }}
                                  />
                                  <div className="grid gap-2">
                                    {bodyVars.variables.map((varName) => (
                                      <ElevatedInput
                                        key={varName}
                                        type="text"
                                        label={t(
                                          "form.editor.body.examplesRequired.placeholder",
                                          { variable: `{{${varName}}}` },
                                        )}
                                        value={bodyExamples[varName] || ""}
                                        onChange={(e) =>
                                          setBodyExamples((prev) => ({
                                            ...prev,
                                            [varName]: e.target.value,
                                          }))
                                        }
                                      />
                                    ))}
                                  </div>
                                  {errors.bodyExamples && (
                                    <p className="mt-2 text-xs text-destructive-ink flex items-center gap-1">
                                      <Warning className="h-3 w-3" />{" "}
                                      {errors.bodyExamples}
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          {component.type === "FOOTER" && (
                            <ElevatedInput
                              type="text"
                              label={t("form.labels.footerText")}
                              value={component.text || ""}
                              onChange={(e) =>
                                updateComponent("FOOTER", {
                                  text: e.target.value,
                                })
                              }
                            />
                          )}

                          {component.type === "BUTTONS" && (
                            <div className="space-y-3">
                              {component.buttons?.map((button, index) => (
                                <div
                                  key={index}
                                  className="flex gap-2 items-start"
                                >
                                  <div className="flex-1 space-y-2">
                                    <div className="grid grid-cols-2 gap-2">
                                      <ElevatedSelect
                                        value={button.type}
                                        onValueChange={(v) =>
                                          updateButton(index, {
                                            type: v as ButtonType,
                                          })
                                        }
                                        label={t("form.labels.buttonType")}
                                      >
                                        {buttonTypes.map((type) => (
                                          <ElevatedSelectItem
                                            key={type}
                                            value={type}
                                          >
                                            {t(`buttonType.${type}`)}
                                          </ElevatedSelectItem>
                                        ))}
                                      </ElevatedSelect>
                                      <ElevatedInput
                                        type="text"
                                        label={t("form.labels.buttonText")}
                                        value={button.text}
                                        onChange={(e) =>
                                          updateButton(index, {
                                            text: e.target.value,
                                          })
                                        }
                                      />
                                    </div>
                                    {button.type === "URL" && (
                                      <ElevatedInput
                                        type="text"
                                        label={t("form.labels.buttonUrl")}
                                        value={button.url || ""}
                                        onChange={(e) =>
                                          updateButton(index, {
                                            url: e.target.value,
                                          })
                                        }
                                      />
                                    )}
                                    {button.type === "PHONE_NUMBER" && (
                                      <ElevatedInput
                                        type="text"
                                        label={t("form.labels.buttonPhone")}
                                        value={button.phone_number || ""}
                                        onChange={(e) =>
                                          updateButton(index, {
                                            phone_number: e.target.value,
                                          })
                                        }
                                      />
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => removeButton(index)}
                                    className="p-2 text-muted-foreground hover:text-destructive-ink mt-6"
                                  >
                                    <Trash className="h-4 w-4" weight="bold" />
                                  </button>
                                </div>
                              ))}
                              {(component.buttons?.length || 0) < 3 && (
                                <button
                                  type="button"
                                  onClick={addButton}
                                  className="flex items-center gap-1 text-xs font-medium text-healthy-ink hover:text-healthy-ink"
                                >
                                  <Plus className="h-3 w-3" />{" "}
                                  {t("form.addButton")}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                    <Button
                      type="button"
                      variant="ghost"
                      title={t("form.buttons.cancel")}
                      onClick={handleClose}
                      disabled={saving}
                    />
                    <Button
                      type="submit"
                      variant="action"
                      title={
                        saving
                          ? t("form.buttons.saving")
                          : t("form.buttons.create")
                      }
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
                    />
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );

  return createPortal(dialogContent, document.body);
}
