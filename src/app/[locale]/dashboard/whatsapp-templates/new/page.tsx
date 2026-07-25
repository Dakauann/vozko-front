"use client";

import { useCallback, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import {
  Check,
  CheckCircle,
  CircleNotch,
  DeviceMobile,
  FlowArrow,
  Info,
  Warning,
  WhatsappLogo,
} from "@phosphor-icons/react";
import type {
  CreateTemplatePayload,
  TemplateCategory,
  TemplateComponent,
  HeaderFormat,
  ButtonType,
} from "@/lib/whatsapp-templates/types";
import type { WhatsAppBusinessPhone } from "@/lib/whatsapp-business-phones/types";
import Button from "@/components/elevated-design/button";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { ElevatedCommandSelect } from "@/components/elevated-design/elevated-command-select";
import {
  ElevatedSelect,
  ElevatedSelectItem,
} from "@/components/elevated-design/elevated-select";
import { createWhatsAppTemplateAction } from "@/app/actions/whatsapp-templates";
import { listBusinessPhonesAction } from "@/app/actions/whatsapp-business-phones";
import { useAuth } from "@/contexts/auth-context";
import { usePaginatedSelect } from "@/hooks/use-paginated-select";
import { useWorkspace } from "@/contexts/workspace-context";
import DragDropBuilder, {
  type DraggableComponent,
  getDefaultData as getDefaultComponentData,
} from "@/components/whatsapp/DragDropBuilder";
import ComponentEditor from "@/components/whatsapp/ComponentEditor";
import WhatsAppPreview from "@/components/whatsapp/WhatsAppPreview";
import TourGuide from "@/components/TourGuide";
import type { TourStep } from "@/components/TourGuide";
import {
  whatsappTemplatesTourSteps,
  whatsappTemplatesTourPalette,
  whatsappTemplatesTourSeed,
} from "@/data/tour-whatsapp-templates";

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

type ParameterFormatState = "named" | "positional" | "none" | "mixed";

// Mirrors the backend's source-of-truth inference: WhatsApp requires a single
// parameter_format per template. Numbered ({{1}}) and named ({{name}}) styles
// must not be mixed, or Meta rejects the template with INVALID_FORMAT.
const computeParameterFormat = (
  components: DraggableComponent[],
): ParameterFormatState => {
  let hasPositional = false;
  let hasNamed = false;
  for (const c of components) {
    const isTextComp =
      c.type === "BODY" || (c.type === "HEADER" && c.data.format === "TEXT");
    const text = isTextComp ? c.data.text || "" : "";
    if (!text) continue;
    if (/\{\{\d+\}\}/.test(text)) hasPositional = true;
    if (/\{\{[a-zA-Z_][a-zA-Z0-9_]*\}\}/.test(text)) hasNamed = true;
  }
  if (hasPositional && hasNamed) return "mixed";
  if (hasNamed) return "named";
  if (hasPositional) return "positional";
  return "none";
};

export default function NewWhatsAppTemplatePage() {
  const { toast } = useToast();
  const router = useRouter();
  const t = useTranslations("whatsappTemplates");
  const { user } = useAuth();
  const { can } = useWorkspace();
  const canCreate = can("whatsapp_templates", "create");

  useEffect(() => {
    if (user && !canCreate) {
      router.replace("/dashboard/whatsapp-templates");
    }
  }, [user, canCreate, router]);

  const [name, setName] = useState("");
  const [language, setLanguage] = useState("pt_BR");
  const [category, setCategory] = useState<TemplateCategory>("MARKETING");
  const [businessPhoneId, setBusinessPhoneId] = useState("");
  const [components, setComponents] = useState<DraggableComponent[]>([]);
  const [selectedComponent, setSelectedComponent] =
    useState<DraggableComponent | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

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

  const detectVariablesForValidation = (
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

  const checkVariablePosition = (
    text: string,
  ): { atStart: boolean; atEnd: boolean } => {
    const variablePattern = /\{\{[^}]+\}\}/;
    const trimmedText = text.trim();

    const atStart =
      variablePattern.test(trimmedText) && /^\{\{[^}]+\}\}/.test(trimmedText);

    const atEnd =
      variablePattern.test(trimmedText) && /\{\{[^}]+\}\}$/.test(trimmedText);

    return { atStart, atEnd };
  };

  const hasConsecutiveVariables = (text: string): boolean => {
    return /\{\{[^}]+\}\}\s*\{\{[^}]+\}\}/.test(text);
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = t("form.validation.nameRequired");
    } else if (!/^[a-z0-9_]+$/.test(name)) {
      newErrors.name = t("form.validation.nameInvalid");
    } else if (name.length > 512) {
      newErrors.name = t("form.validation.nameTooLong");
    }

    if (!businessPhoneId) {
      newErrors.businessPhone = t("form.validation.businessPhoneRequired");
    }

    const bodyComponent = components.find((c) => c.type === "BODY");
    if (!bodyComponent || !bodyComponent.data.text?.trim()) {
      newErrors.body = t("form.validation.bodyRequired");
    } else {
      const bodyText = bodyComponent.data.text || "";

      if (bodyText.length > 1024) {
        newErrors.body = t("form.validation.bodyTooLong");
      }

      const bodyVarPosition = checkVariablePosition(bodyText);
      if (bodyVarPosition.atStart) {
        newErrors.body = t("form.validation.noVariableAtStart");
      } else if (bodyVarPosition.atEnd) {
        newErrors.body = t("form.validation.noVariableAtEnd");
      }

      if (!newErrors.body && hasConsecutiveVariables(bodyText)) {
        newErrors.body = t("form.validation.noConsecutiveVariables");
      }

      if (!newErrors.body) {
        const bodyVars = detectVariablesForValidation(bodyText);
        if (bodyVars.variables.length > 0) {
          if (bodyVars.type === "positional") {
            const examples = bodyComponent.data.variableExamples || [];
            const missingExamples = bodyVars.variables.filter(
              (varNum) => !examples[parseInt(varNum) - 1]?.trim(),
            );
            if (missingExamples.length > 0) {
              newErrors.body = t("form.validation.examplesRequired", {
                variables: missingExamples.map((v) => `{{${v}}}`).join(", "),
              });
            }
          } else {
            const examples = bodyComponent.data.namedVariableExamples || {};
            const missingExamples = bodyVars.variables.filter(
              (varName) => !examples[varName]?.trim(),
            );
            if (missingExamples.length > 0) {
              newErrors.body = t("form.validation.examplesRequired", {
                variables: missingExamples.map((v) => `{{${v}}}`).join(", "),
              });
            }
          }
        }
      }
    }

    const headerComponent = components.find((c) => c.type === "HEADER");
    if (headerComponent) {
      if (headerComponent.data.format === "TEXT" && headerComponent.data.text) {
        const headerText = headerComponent.data.text;

        if (headerText.length > 60) {
          newErrors.header = t("form.validation.headerTooLong");
        }

        const headerVars = detectVariablesForValidation(headerText);
        if (headerVars.variables.length > 1) {
          newErrors.header = t("form.validation.headerMaxOneVariable");
        }

        if (!newErrors.header) {
          const headerVarPosition = checkVariablePosition(headerText);
          if (headerVarPosition.atStart) {
            newErrors.header = t("form.validation.noVariableAtStart");
          } else if (headerVarPosition.atEnd) {
            newErrors.header = t("form.validation.noVariableAtEnd");
          }
        }

        if (!newErrors.header && headerVars.variables.length > 0) {
          if (headerVars.type === "positional") {
            const examples = headerComponent.data.variableExamples || [];
            const missingExamples = headerVars.variables.filter(
              (varNum) => !examples[parseInt(varNum) - 1]?.trim(),
            );
            if (missingExamples.length > 0) {
              newErrors.header = t("form.validation.headerExamplesRequired", {
                variables: missingExamples.map((v) => `{{${v}}}`).join(", "),
              });
            }
          } else {
            const examples = headerComponent.data.namedVariableExamples || {};
            const missingExamples = headerVars.variables.filter(
              (varName) => !examples[varName]?.trim(),
            );
            if (missingExamples.length > 0) {
              newErrors.header = t("form.validation.headerExamplesRequired", {
                variables: missingExamples.map((v) => `{{${v}}}`).join(", "),
              });
            }
          }
        }
      }

      if (
        ["IMAGE", "VIDEO", "DOCUMENT", "GIF"].includes(
          headerComponent.data.format || "",
        )
      ) {
        if (!headerComponent.data.example?.trim()) {
          newErrors.header = t("form.validation.mediaHeaderRequiresExample");
        }
      }
    }

    const footerComponent = components.find((c) => c.type === "FOOTER");
    if (footerComponent && footerComponent.data.text) {
      const footerText = footerComponent.data.text;

      if (footerText.length > 60) {
        newErrors.footer = t("form.validation.footerTooLong");
      }

      const footerVars = detectVariablesForValidation(footerText);
      if (footerVars.variables.length > 0) {
        newErrors.footer = t("form.validation.footerNoVariables");
      }
    }

    const buttonsComponent = components.find((c) => c.type === "BUTTONS");
    if (buttonsComponent && buttonsComponent.data.buttons) {
      const buttons = buttonsComponent.data.buttons;

      if (buttons.length > 10) {
        newErrors.buttons = t("form.validation.maxButtons");
      }

      for (let i = 0; i < buttons.length; i++) {
        const btn = buttons[i];
        if (btn.text && btn.text.length > 25) {
          newErrors.buttons = t("form.validation.buttonTextTooLong", {
            index: i + 1,
          });
          break;
        }

        if (btn.type === "URL" && !btn.url?.trim()) {
          newErrors.buttons = t("form.validation.urlButtonRequiresUrl", {
            index: i + 1,
          });
          break;
        }

        if (btn.type === "URL" && btn.url) {
          const urlVars = detectVariablesForValidation(btn.url);
          if (urlVars.variables.length > 0 && !btn.example?.trim()) {
            newErrors.buttons = t("form.validation.urlButtonRequiresExample", {
              index: i + 1,
            });
            break;
          }
          if (urlVars.variables.length > 1) {
            newErrors.buttons = t("form.validation.urlMaxOneVariable", {
              index: i + 1,
            });
            break;
          }
        }

        if (btn.type === "PHONE_NUMBER" && !btn.phone_number?.trim()) {
          newErrors.buttons = t("form.validation.phoneButtonRequiresNumber", {
            index: i + 1,
          });
          break;
        }

        if (btn.type === "COPY_CODE" && !btn.example?.trim()) {
          newErrors.buttons = t("form.validation.copyCodeRequiresExample", {
            index: i + 1,
          });
          break;
        }
      }

      if (!newErrors.buttons && buttons.length > 1) {
        let foundNonQuickReply = false;
        let foundQuickReplyAfterOther = false;

        for (const btn of buttons) {
          if (btn.type === "QUICK_REPLY") {
            if (foundNonQuickReply) {
              foundQuickReplyAfterOther = true;
              break;
            }
          } else {
            if (!foundNonQuickReply) {
              const priorButtons = buttons.slice(0, buttons.indexOf(btn));
              if (priorButtons.some((b) => b.type === "QUICK_REPLY")) {
                foundNonQuickReply = true;
              }
            }
          }
        }

        const quickReplyIndices = buttons
          .map((btn, idx) => (btn.type === "QUICK_REPLY" ? idx : -1))
          .filter((i) => i >= 0);
        if (quickReplyIndices.length > 1) {
          for (let i = 1; i < quickReplyIndices.length; i++) {
            if (quickReplyIndices[i] - quickReplyIndices[i - 1] !== 1) {
              newErrors.buttons = t("form.validation.quickRepliesMustBeGrouped");
              break;
            }
          }
        }
      }
    }

    const hasCallPermission = components.some(
      (c) => c.type === "CALL_PERMISSION_REQUEST",
    );
    if (hasCallPermission && buttonsComponent) {
      newErrors.buttons = t("form.validation.callPermissionWithButtons");
    }

    if (computeParameterFormat(components) === "mixed") {
      newErrors.format = t("form.validation.mixedVariableFormat");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const convertToTemplateComponents = (
    draggableComponents: DraggableComponent[],
  ): TemplateComponent[] => {
    const result = draggableComponents.map((comp) => {
      const templateComp: TemplateComponent = {
        type: comp.type as TemplateComponent["type"],
      };

      if (comp.type === "HEADER" && comp.data.format) {
        templateComp.format = comp.data.format as HeaderFormat;
        if (comp.data.format === "TEXT") {
          templateComp.text = comp.data.text;
          const headerVars = detectVariablesForValidation(comp.data.text || "");
          if (headerVars.variables.length > 0) {
            if (headerVars.type === "named") {
              const namedExamples = comp.data.namedVariableExamples || {};
              templateComp.example = {
                header_text_named_params: headerVars.variables.map(
                  (varName) => ({
                    param_name: varName,
                    example: namedExamples[varName] || "",
                  }),
                ),
              };
            } else if (comp.data.variableExamples) {
              const headerExamples = headerVars.variables.map(
                (varNum) =>
                  comp.data.variableExamples?.[parseInt(varNum) - 1] || "",
              );
              if (headerExamples.some((e) => e)) {
                templateComp.example = {
                  header_text: headerExamples,
                };
              }
            }
          }
        } else {
          if (comp.data.format === "LOCATION") {
            templateComp.text = `${comp.data.locationName}\n${comp.data.locationAddress}`;
          }
          if (
            ["IMAGE", "VIDEO", "DOCUMENT", "GIF"].includes(comp.data.format) &&
            comp.data.example
          ) {
            templateComp.example = {
              header_handle: [comp.data.example],
            };
          }
        }
      } else if (comp.type === "BODY") {
        templateComp.text = comp.data.text;
        const bodyVars = detectVariablesForValidation(comp.data.text || "");
        if (bodyVars.variables.length > 0) {
          if (bodyVars.type === "named") {
            const namedExamples = comp.data.namedVariableExamples || {};
            templateComp.example = {
              body_text_named_params: bodyVars.variables.map((varName) => ({
                param_name: varName,
                example: namedExamples[varName] || "",
              })),
            };
          } else if (comp.data.variableExamples) {
            const bodyExamples = bodyVars.variables.map(
              (varNum) =>
                comp.data.variableExamples?.[parseInt(varNum) - 1] || "",
            );
            if (bodyExamples.some((e) => e)) {
              templateComp.example = {
                body_text: [bodyExamples],
              };
            }
          }
        }
      } else if (comp.type === "FOOTER") {
        templateComp.text = comp.data.text;
      } else if (comp.type === "BUTTONS" && comp.data.buttons) {
        templateComp.buttons = comp.data.buttons.map((btn) => {
          const button: {
            type: ButtonType;
            text: string;
            url?: string;
            phone_number?: string;
            example?: string | string[];
          } = {
            type: btn.type as ButtonType,
            text: btn.text || "",
          };
          if (btn.url) button.url = btn.url;
          if (btn.phone_number) button.phone_number = btn.phone_number;
          if (btn.example) {
            button.example = btn.type === "URL" ? [btn.example] : btn.example;
          }
          return button;
        });
      }

      return templateComp;
    });

    return result;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setSaving(true);

    const headerComponent = components.find((c) => c.type === "HEADER");
    const isMediaHeader =
      headerComponent?.data.format &&
      ["IMAGE", "VIDEO", "DOCUMENT", "GIF"].includes(
        headerComponent.data.format,
      );

    const detectedFormat = computeParameterFormat(components);

    const payload: CreateTemplatePayload = {
      businessPhoneId,
      name,
      language,
      category,
      components: convertToTemplateComponents(components),
      ...(detectedFormat === "named" || detectedFormat === "positional"
        ? { parameterFormat: detectedFormat }
        : {}),
      ...(isMediaHeader && headerComponent?.data.example
        ? { headerMediaUrl: headerComponent.data.example }
        : {}),
    };

    try {
      const result = await createWhatsAppTemplateAction(payload);

      if (result.error) {
        toast({
          title: t("toast.createError"),
          description: result.error,
          variant: "destructive",
        });
      } else if (result.template?.status === "REJECTED") {
        // The template reached Meta but was rejected on submission. Keep the
        // user on the page with the real reason so they can fix it.
        toast({
          title: t("toast.createRejected"),
          description: result.template.rejectedReason
            ? t("toast.createRejectedDesc", {
                reason: result.template.rejectedReason,
              })
            : t("toast.createErrorDesc"),
          variant: "destructive",
        });
      } else {
        toast({
          title: t("toast.createSuccess"),
          description: t("toast.createSuccessDesc"),
        });
        router.push("/dashboard/whatsapp-templates");
      }
    } catch {
      toast({
        title: t("toast.createError"),
        description: t("toast.createErrorDesc"),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleComponentChange = (updatedComponent: DraggableComponent) => {
    setComponents(
      components.map((c) =>
        c.id === updatedComponent.id ? updatedComponent : c,
      ),
    );
    setSelectedComponent(updatedComponent);
  };

  const handleTourStep = (_index: number, step: TourStep) => {
    const componentType = (step.data as any)?._selectComponent as string | undefined;
    if (!componentType) return;

    const shouldInjectVar = (step.data as any)?._injectVar;
    const existing = components.find((c) => c.type === componentType);

    if (existing) {
      if (shouldInjectVar && componentType === "BODY" && !/\{\{/.test(existing.data.text || "")) {
        const updated = { ...existing, data: { ...existing.data, text: (existing.data.text || "") + " {{1}}" } };
        setComponents(components.map((c) => c.id === updated.id ? updated : c));
        setSelectedComponent(updated);
      } else {
        setSelectedComponent(existing);
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

    setComponents(newComponents);
    setSelectedComponent(newComponent);
  };

  if (!canCreate) {
    return null;
  }

  const detectedFormat = computeParameterFormat(components);
  const hasCallComponent = components.some(
    (c) => c.type === "CALL_PERMISSION_REQUEST",
  );
  const formatBadge = {
    named: {
      label: t("new.guidelines.formatNamed"),
      cls: "bg-[#2463eb]/10 text-[#2463eb] border-[#2463eb]/20",
    },
    positional: {
      label: t("new.guidelines.formatPositional"),
      cls: "bg-[#2463eb]/10 text-[#2463eb] border-[#2463eb]/20",
    },
    none: {
      label: t("new.guidelines.formatNone"),
      cls: "bg-muted text-muted-foreground border-border",
    },
    mixed: {
      label: t("new.guidelines.formatMixed"),
      cls: "bg-amber-500/10 text-amber-700 border-amber-500/20",
    },
  }[detectedFormat];
  const guidelineKeys = [
    "variables",
    "position",
    "examples",
    "completeSentence",
    "footer",
    ...(hasCallComponent ? ["callPermission"] : []),
  ];

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
    <motion.main
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="w-full space-y-5"
    >
      {/* Header */}
      <motion.div variants={itemVariants}>
        <DashboardPageHeader
          back={{
            onClick: () => router.push("/dashboard/whatsapp-templates"),
            label: t("button.back"),
          }}
          icon={<WhatsappLogo className="h-5 w-5" weight="fill" />}
          badge={t("new.title")}
          title={t("new.title")}
          description={t("new.description")}
          colorClass="text-cyan-600"
          actions={
            <div className="flex items-center gap-2" data-tour="wt-submit">
              <Button
                variant="secondary"
                title={t("form.buttons.cancel")}
                link="/dashboard/whatsapp-templates"
                newTab={false}
                className="h-9"
              />
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
            </div>
          }
        />
      </motion.div>

      <form onSubmit={handleSubmit} className="flex gap-5 items-start">
        {/* Left column: Form + Builder */}
        <div className="flex-1 min-w-0 space-y-5">
          {/* Template Basic Info */}
          <motion.div variants={itemVariants} data-tour="wt-template-info">
            <ElevatedContainer className="border border-border/70 bg-card p-5">
              <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500">
                  <WhatsappLogo
                    className="h-3.5 w-3.5 text-white"
                    weight="fill"
                  />
                </div>
                {t("new.templateInfo")}
              </h2>

              <div className="grid gap-4 sm:grid-cols-2">
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
                    className={errors.name ? "border-red-300" : ""}
                  />
                  {errors.name ? (
                    <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                      <Warning className="h-3 w-3" /> {errors.name}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("form.hints.name")}
                    </p>
                  )}
                </div>

                <div>
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
                  {errors.businessPhone ? (
                    <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                      <Warning className="h-3 w-3" /> {errors.businessPhone}
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
            </ElevatedContainer>
          </motion.div>

          {/* Template Builder */}
          <motion.div variants={itemVariants}>
            <ElevatedContainer className="border border-border/70 bg-card p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-500">
                    <FlowArrow
                      className="h-3.5 w-3.5 text-white"
                      weight="bold"
                    />
                  </div>
                  {t("new.buildTemplate")}
                </h2>
                <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-md">
                  {t("new.dragDropBadge")}
                </span>
              </div>

              <div className="grid gap-5 lg:grid-cols-3">
                <div className="lg:col-span-2 min-h-[400px]">
                  <DragDropBuilder
                    components={components}
                    onChange={setComponents}
                    onComponentSelect={setSelectedComponent}
                    selectedComponentId={selectedComponent?.id}
                  />
                </div>

                <div className="border border-border rounded-xl bg-muted/30 min-h-[400px] overflow-hidden" data-tour="wt-component-editor">
                  <ComponentEditor
                    component={selectedComponent}
                    onChange={handleComponentChange}
                  />
                </div>
              </div>

              {/* Inline validation errors */}
              {(errors.body ||
                errors.header ||
                errors.footer ||
                errors.buttons ||
                errors.format) && (
                <div className="mt-4 space-y-2">
                  {[
                    errors.header,
                    errors.body,
                    errors.footer,
                    errors.buttons,
                    errors.format,
                  ]
                    .filter(Boolean)
                    .map((error, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 p-2.5 rounded-lg bg-destructive/10 border border-destructive/20"
                      >
                        <Warning
                          className="h-3.5 w-3.5 text-red-600 flex-shrink-0"
                          weight="fill"
                        />
                        <p className="text-xs text-red-700">{error}</p>
                      </div>
                    ))}
                </div>
              )}
            </ElevatedContainer>
          </motion.div>

          {/* Guidelines */}
          <motion.div variants={itemVariants}>
            <ElevatedContainer className="border border-border/70 bg-card p-5">
              <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[#2463eb]">
                    <Info className="h-3.5 w-3.5 text-white" weight="fill" />
                  </div>
                  {t("new.guidelines.title")}
                </h2>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-muted-foreground">
                    {t("new.guidelines.formatLabel")}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${formatBadge.cls}`}
                  >
                    {formatBadge.label}
                  </span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                {t("new.guidelines.subtitle")}
              </p>
              <ul className="space-y-2">
                {guidelineKeys.map((key) => (
                  <li
                    key={key}
                    className="flex items-start gap-2 text-xs text-muted-foreground leading-relaxed"
                  >
                    <Check
                      className="h-3.5 w-3.5 text-[#2463eb] flex-shrink-0 mt-0.5"
                      weight="bold"
                    />
                    <span>{t(`new.guidelines.${key}`)}</span>
                  </li>
                ))}
              </ul>
            </ElevatedContainer>
          </motion.div>
        </div>

        {/* Right column: Sticky Preview */}
        <motion.div
          variants={itemVariants}
          className="hidden xl:block w-[340px] flex-shrink-0 sticky top-6"
          data-tour="wt-preview"
        >
          <ElevatedContainer className="border border-border/70 bg-card p-5">
            <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-teal-500">
                <DeviceMobile
                  className="h-3.5 w-3.5 text-white"
                  weight="fill"
                />
              </div>
              {t("new.preview")}
            </h2>

            <div className="rounded-2xl overflow-hidden border border-border">
              <div className="h-[520px]">
                <WhatsAppPreview
                  components={components}
                  templateName={name || t("new.untitledTemplate")}
                  language={language}
                />
              </div>
            </div>

            <div className="mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <div className="flex items-start gap-2.5">
                <Warning
                  className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5"
                  weight="fill"
                />
                <div>
                  <h4 className="text-xs font-semibold text-amber-800 mb-0.5">
                    {t("new.approvalRequired.title")}
                  </h4>
                  <p className="text-[11px] text-amber-700 leading-relaxed">
                    {t("new.approvalRequired.description")}
                  </p>
                </div>
              </div>
            </div>
          </ElevatedContainer>
        </motion.div>
      </form>
    </motion.main>
    </>
  );
}
