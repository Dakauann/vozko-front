"use client";

import type {
  AgentToolDefinition,
  ToolConfig,
  ToolConfigSchemaField,
} from "@/lib/agents/types";
import { CheckCircle, Gear, Info, Warning } from "@/components/icons";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ElevatedSelect,
  ElevatedSelectItem,
} from "@/components/elevated-design/elevated-select";
import { useCallback, useMemo, useState } from "react";

import Button from "@/components/elevated-design/button";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import ElevatedTextarea from "@/components/elevated-design/elevated-textarea";
import { IconBox } from "@/components/elevated-design/listing-card";
import { buildInitialToolConfig } from "@/lib/agents/tool-config-defaults";
import { useTranslations } from "next-intl";

interface ToolConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tool: AgentToolDefinition | null;
  existingConfig?: ToolConfig;
  onSave: (config: ToolConfig) => void;
}

function prettifyConfigKey(key: string) {
  return key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function ToolConfigDialog({
  open,
  onOpenChange,
  tool,
  existingConfig,
  onSave,
}: ToolConfigDialogProps) {
  if (!tool) return null;

  return (
    <ToolConfigDialogContent
      key={`${tool.name}:${open ? "open" : "closed"}`}
      open={open}
      onOpenChange={onOpenChange}
      tool={tool}
      existingConfig={existingConfig}
      onSave={onSave}
    />
  );
}

interface ToolConfigDialogContentProps extends ToolConfigDialogProps {
  tool: AgentToolDefinition;
}

function ToolConfigDialogContent({
  open,
  onOpenChange,
  tool,
  existingConfig,
  onSave,
}: ToolConfigDialogContentProps) {
  const t = useTranslations("agents.form.toolConfig");
  const [config, setConfig] = useState<ToolConfig>(() =>
    buildInitialToolConfig(tool, existingConfig),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (newOpen && tool) {
        setConfig(buildInitialToolConfig(tool, existingConfig));
        setErrors({});
      }
      onOpenChange(newOpen);
    },
    [existingConfig, onOpenChange, tool],
  );

  const configSchema = useMemo(
    () => tool.configSchema ?? {},
    [tool.configSchema],
  );
  const requiredFields = useMemo(
    () => new Set(tool.requiredConfig ?? []),
    [tool.requiredConfig],
  );

  const schemaEntries = useMemo(() => {
    return Object.entries(configSchema);
  }, [configSchema]);

  const requiredFieldLabels = useMemo(() => {
    return Array.from(requiredFields).map((key) => {
      const schema = configSchema[key];
      return schema?.displayName || prettifyConfigKey(key);
    });
  }, [configSchema, requiredFields]);

  const handleFieldChange = (key: string, value: unknown) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const handleJsonFieldChange = (key: string, value: string) => {
    try {
      const parsed = JSON.parse(value);
      handleFieldChange(key, parsed);
    } catch {
      handleFieldChange(key, value);
    }
  };

  const validateConfig = (): boolean => {
    const newErrors: Record<string, string> = {};

    for (const field of requiredFields) {
      const value = config[field];
      if (value === undefined || value === null || value === "") {
        newErrors[field] = t("errors.required");
      }
    }

    for (const [key, schema] of schemaEntries) {
      const value = config[key];
      if (value === undefined || value === null || value === "") continue;

      if (schema.type === "object" || schema.type === "array") {
        if (typeof value === "string") {
          try {
            JSON.parse(value);
          } catch {
            newErrors[key] = t("errors.invalidJson");
          }
        }
      }

      if (schema.type === "number" && typeof value === "string") {
        const num = Number(value);
        if (isNaN(num)) {
          newErrors[key] = t("errors.invalidNumber");
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validateConfig()) return;

    const normalizedConfig: ToolConfig = {};
    for (const [key, schema] of schemaEntries) {
      let value = config[key];
      if (value === undefined || value === null || value === "") continue;

      if (
        (schema.type === "object" || schema.type === "array") &&
        typeof value === "string"
      ) {
        try {
          value = JSON.parse(value);
        } catch {
          // This shouldn't happen if validation passed
        }
      }

      if (schema.type === "number" && typeof value === "string") {
        value = Number(value);
      }

      if (schema.type === "boolean" && typeof value === "string") {
        value = value === "true";
      }

      normalizedConfig[key] = value;
    }

    onSave(normalizedConfig);
    onOpenChange(false);
  };

  const renderField = (key: string, schema: ToolConfigSchemaField) => {
    const value = config[key];
    const isRequired = requiredFields.has(key);
    const error = errors[key];
    const fieldLabel = schema.displayName || prettifyConfigKey(key);
    const fieldDescription = schema.displayDescription || schema.description;
    const defaultPlaceholder =
      schema.defaultValue !== undefined && schema.defaultValue !== null
        ? String(schema.defaultValue)
        : fieldDescription;

    const labelText = (
      <span className="flex items-center gap-2">
        <span className="font-medium">{fieldLabel}</span>
        {isRequired && (
          <span className="rounded-md bg-warning px-1.5 py-0.5 text-xs font-semibold text-warning-foreground">
            {t("required")}
          </span>
        )}
      </span>
    );

    if (schema.options?.length) {
      return (
        <div key={key} className="space-y-2">
          <label className="block text-sm text-foreground">
            {labelText}
            <span className="block text-xs text-muted-foreground mt-1">
              {fieldDescription}
            </span>
          </label>
          <ElevatedSelect
            value={value !== undefined && value !== null ? String(value) : ""}
            onValueChange={(nextValue) => {
              handleFieldChange(
                key,
                schema.type === "number" ? Number(nextValue) : nextValue,
              );
            }}
            placeholder={defaultPlaceholder}
          >
            {schema.options.map((option) => (
              <ElevatedSelectItem key={option.value} value={option.value}>
                {option.label}
              </ElevatedSelectItem>
            ))}
          </ElevatedSelect>
          {error && (
            <p className="text-xs font-semibold text-destructive">{error}</p>
          )}
        </div>
      );
    }

    switch (schema.type) {
      case "object":
      case "array":
        const jsonValue =
          typeof value === "string"
            ? value
            : value !== undefined
              ? JSON.stringify(value, null, 2)
              : "";
        const jsonPlaceholder =
          schema.defaultValue !== undefined
            ? JSON.stringify(schema.defaultValue, null, 2)
            : `{\n  "key": "value"\n}`;
        return (
          <div key={key} className="space-y-2">
            <label className="block text-sm text-foreground">
              {labelText}
              <span className="block text-xs text-muted-foreground mt-1">
                {fieldDescription}
              </span>
            </label>
            <ElevatedTextarea
              value={jsonValue}
              onChange={(e) => handleJsonFieldChange(key, e.target.value)}
              placeholder={jsonPlaceholder}
              rows={4}
              className="font-mono text-sm"
            />
            {error && (
              <p className="text-xs font-semibold text-destructive">{error}</p>
            )}
          </div>
        );

      case "boolean":
        const boolValue = typeof value === "boolean" ? value : value === "true";
        return (
          <div key={key} className="space-y-2">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={boolValue}
                onChange={(e) => handleFieldChange(key, e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-foreground/20 text-primary-ink focus:ring-ring"
              />
              <div>
                <span className="text-sm font-medium text-foreground">
                  {fieldLabel}
                </span>
                {isRequired && (
                  <span className="ml-2 rounded-md bg-warning px-1.5 py-0.5 text-xs font-semibold text-warning-foreground">
                    {t("required")}
                  </span>
                )}
                <p className="text-xs text-muted-foreground mt-0.5">
                  {fieldDescription}
                </p>
              </div>
            </label>
          </div>
        );

      case "number":
        return (
          <div key={key} className="space-y-2">
            <label className="block text-sm text-foreground">
              {labelText}
              <span className="block text-xs text-muted-foreground mt-1">
                {fieldDescription}
              </span>
            </label>
            <ElevatedInput
              type="number"
              value={value !== undefined ? String(value) : ""}
              onChange={(e) => handleFieldChange(key, e.target.value)}
              placeholder={defaultPlaceholder}
            />
            {error && (
              <p className="text-xs font-semibold text-destructive">{error}</p>
            )}
          </div>
        );

      default:
        return (
          <div key={key} className="space-y-2">
            <label className="block text-sm text-foreground">
              {labelText}
              <span className="block text-xs text-muted-foreground mt-1">
                {fieldDescription}
              </span>
            </label>
            <ElevatedInput
              value={typeof value === "string" ? value : ""}
              onChange={(e) => handleFieldChange(key, e.target.value)}
              placeholder={defaultPlaceholder}
            />
            {error && (
              <p className="text-xs font-semibold text-destructive">{error}</p>
            )}
          </div>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[86vh] max-w-2xl flex-col overflow-hidden p-0">
        <DialogHeader className="border-b border-border bg-card px-6 py-5">
          <DialogTitle className="flex items-center gap-3">
            <IconBox color="blue" size="sm">
              <Gear weight="fill" />
            </IconBox>
            <div>
              <span className="block">{t("title")}</span>
              <span className="block text-sm font-normal text-muted-foreground">
                {tool.displayName || tool.name}
              </span>
            </div>
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t("description", { toolName: tool.displayName || tool.name })}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-5 overflow-y-auto bg-muted px-6 py-5">
          {/* Info banner */}
          <div className="flex items-start gap-3 rounded-[--radius] border border-border bg-card p-4">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[--radius] bg-muted text-muted-foreground shadow-sm">
              <Info weight="fill" className="h-4 w-4" />
            </span>
            <div className="text-sm">
              <p className="font-semibold text-foreground">{t("infoTitle")}</p>
              <p className="mt-1 text-muted-foreground">
                {tool.displayDescription || tool.description}
              </p>
            </div>
          </div>

          {/* Required fields warning */}
          {requiredFields.size > 0 && (
            <div className="flex items-start gap-3 rounded-[--radius] border border-warning/30 bg-card p-4">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[--radius] bg-muted text-muted-foreground shadow-sm">
                <Warning weight="fill" className="h-4 w-4" />
              </span>
              <div className="text-sm">
                <p className="font-semibold text-foreground">
                  {t("requiredWarning")}
                </p>
                <p className="mt-1 text-muted-foreground">
                  {t("requiredFields")}: {requiredFieldLabels.join(", ")}
                </p>
              </div>
            </div>
          )}

          {/* Configuration fields */}
          <div className="rounded-[--radius] border border-border bg-card p-5">
            <h3 className="text-sm font-semibold text-foreground">
              {t("configurationFields")}
            </h3>
            {schemaEntries.length > 0 ? (
              <div className="mt-4 space-y-5">
                {schemaEntries.map(([key, schema]) => renderField(key, schema))}
              </div>
            ) : (
              <p className="mt-4 text-sm italic text-muted-foreground">
                {t("noConfigFields")}
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 border-t border-border bg-card px-6 py-4">
          <Button
            type="button"
            variant="ghost"
            title={t("cancel")}
            onClick={() => onOpenChange(false)}
          />
          <Button
            type="button"
            variant="action"
            title={t("save")}
            onClick={handleSave}
            icon={<CheckCircle weight="fill" className="h-4 w-4" />}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
