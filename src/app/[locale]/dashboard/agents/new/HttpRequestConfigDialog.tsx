"use client";

import type { AgentToolDefinition, ToolConfig } from "@/lib/agents/types";
import {
  CaretDown,
  CaretRight,
  CheckCircle,
  Code,
  Gear,
  Info,
  Plus,
  Trash,
} from "@/components/icons";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import ElevatedSelect, {
  ElevatedSelectItem,
} from "@/components/elevated-design/elevated-select";
import { type ReactNode, useCallback, useMemo, useState } from "react";

import Button from "@/components/elevated-design/button";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import ElevatedTextarea from "@/components/elevated-design/elevated-textarea";
import { IconBox } from "@/components/elevated-design/listing-card";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
type ParameterType = "string" | "number" | "boolean" | "object" | "array";

interface SchemaParameter {
  id: string;
  name: string;
  type: ParameterType;
  description: string;
  required: boolean;
  example: string;
  properties?: SchemaParameter[];
  items?: SchemaParameter;
}

interface HeaderEntry {
  id: string;
  key: string;
  value: string;
}

interface HttpRequestConfig {
  url: string;
  method: HttpMethod;
  timeoutSeconds: number | null;
  headers: HeaderEntry[];
  pathParams: SchemaParameter[];
  querySchema: SchemaParameter[];
  bodySchema: SchemaParameter[];
}

interface HttpRequestConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tool: AgentToolDefinition | null;
  existingConfig?: ToolConfig;
  onSave: (config: ToolConfig) => void;
}

const generateId = () => Math.random().toString(36).substring(2, 9);

const HTTP_METHODS: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE"];
const PARAMETER_TYPES: ParameterType[] = [
  "string",
  "number",
  "boolean",
  "object",
  "array",
];

function createEmptyParameter(required = false): SchemaParameter {
  return {
    id: generateId(),
    name: "",
    type: "string",
    description: "",
    required,
    example: "",
  };
}

function DialogIcon({ children }: { children: ReactNode }) {
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[--radius] bg-muted text-muted-foreground shadow-sm [&>svg]:h-5 [&>svg]:w-5">
      {children}
    </span>
  );
}

function ConfigSection({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[--radius] border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">
            {title}
          </h3>
          {description ? (
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

function AddConfigButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-[--radius] border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
    >
      <Plus className="h-4 w-4" />
      {label}
    </button>
  );
}

function EmptyConfig({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[--radius] border border-dashed border-border bg-background px-4 py-5 text-sm text-muted-foreground">
      {children}
    </div>
  );
}

function paramToApiFormat(p: SchemaParameter): Record<string, unknown> {
  const result: Record<string, unknown> = {
    name: p.name,
    type: p.type,
    description: p.description,
    required: p.required,
  };

  if (p.example) {
    result.example = p.example;
  }

  if (p.type === "object" && p.properties && p.properties.length > 0) {
    result.properties = p.properties
      .filter((prop) => prop.name.trim())
      .map(paramToApiFormat);
  }

  if (p.type === "array" && p.items) {
    const itemsResult: Record<string, unknown> = {
      type: p.items.type,
      description: p.items.description,
    };
    if (
      p.items.type === "object" &&
      p.items.properties &&
      p.items.properties.length > 0
    ) {
      itemsResult.properties = p.items.properties
        .filter((prop) => prop.name.trim())
        .map(paramToApiFormat);
    }
    result.items = itemsResult;
  }

  return result;
}

function configToApiFormat(config: HttpRequestConfig): ToolConfig {
  const result: ToolConfig = {
    url: config.url,
    method: config.method,
  };

  if (config.timeoutSeconds && config.timeoutSeconds > 0) {
    result.timeout_seconds = config.timeoutSeconds;
  }

  if (config.headers.length > 0) {
    const headersObj: Record<string, string> = {};
    for (const h of config.headers) {
      if (h.key.trim()) {
        headersObj[h.key] = h.value;
      }
    }
    if (Object.keys(headersObj).length > 0) {
      result.headers = headersObj;
    }
  }

  if (config.pathParams.length > 0) {
    result.path_params = config.pathParams
      .filter((p) => p.name.trim())
      .map(paramToApiFormat);
  }

  if (config.querySchema.length > 0) {
    result.query_schema = config.querySchema
      .filter((p) => p.name.trim())
      .map(paramToApiFormat);
  }

  if (
    ["POST", "PUT", "PATCH"].includes(config.method) &&
    config.bodySchema.length > 0
  ) {
    result.body_schema = config.bodySchema
      .filter((p) => p.name.trim())
      .map(paramToApiFormat);
  }

  return result;
}

function parseApiParam(p: Record<string, unknown>): SchemaParameter {
  const param: SchemaParameter = {
    id: generateId(),
    name: (p.name as string) || "",
    type: (p.type as ParameterType) || "string",
    description: (p.description as string) || "",
    required: (p.required as boolean) || false,
    example: (p.example as string) || "",
  };

  if (param.type === "object" && Array.isArray(p.properties)) {
    param.properties = (p.properties as Array<Record<string, unknown>>).map(
      parseApiParam,
    );
  }

  if (param.type === "array" && p.items) {
    const items = p.items as Record<string, unknown>;
    param.items = {
      id: generateId(),
      name: "",
      type: (items.type as ParameterType) || "object",
      description: (items.description as string) || "",
      required: false,
      example: "",
    };
    if (Array.isArray(items.properties)) {
      param.items.properties = (
        items.properties as Array<Record<string, unknown>>
      ).map(parseApiParam);
    }
  }

  return param;
}

function apiFormatToConfig(
  apiConfig: ToolConfig | undefined,
): HttpRequestConfig {
  const defaultConfig: HttpRequestConfig = {
    url: "",
    method: "GET",
    timeoutSeconds: null,
    headers: [],
    pathParams: [],
    querySchema: [],
    bodySchema: [],
  };

  if (!apiConfig) return defaultConfig;

  const config: HttpRequestConfig = {
    url: (apiConfig.url as string) || "",
    method: (apiConfig.method as HttpMethod) || "GET",
    timeoutSeconds: (apiConfig.timeout_seconds as number) || null,
    headers: [],
    pathParams: [],
    querySchema: [],
    bodySchema: [],
  };

  if (apiConfig.headers && typeof apiConfig.headers === "object") {
    const headers = apiConfig.headers as Record<string, string>;
    config.headers = Object.entries(headers).map(([key, value]) => ({
      id: generateId(),
      key,
      value: String(value),
    }));
  }

  if (Array.isArray(apiConfig.path_params)) {
    config.pathParams = (
      apiConfig.path_params as Array<Record<string, unknown>>
    ).map(parseApiParam);
  }

  if (Array.isArray(apiConfig.query_schema)) {
    config.querySchema = (
      apiConfig.query_schema as Array<Record<string, unknown>>
    ).map(parseApiParam);
  }

  if (Array.isArray(apiConfig.body_schema)) {
    config.bodySchema = (
      apiConfig.body_schema as Array<Record<string, unknown>>
    ).map(parseApiParam);
  }

  return config;
}

function NestedSchemaParameterRow({
  param,
  onChange,
  onRemove,
  t,
  depth = 0,
  showRequired = true,
  showName = true,
}: {
  param: SchemaParameter;
  onChange: (updated: SchemaParameter) => void;
  onRemove: () => void;
  t: (key: string) => string;
  depth?: number;
  showRequired?: boolean;
  showName?: boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasNested = param.type === "object" || param.type === "array";
  const maxDepth = 4; 

  const addNestedProperty = () => {
    if (param.type === "object") {
      onChange({
        ...param,
        properties: [...(param.properties || []), createEmptyParameter()],
      });
    }
  };

  const addArrayItemProperty = () => {
    if (param.type === "array" && param.items) {
      onChange({
        ...param,
        items: {
          ...param.items,
          properties: [
            ...(param.items.properties || []),
            createEmptyParameter(),
          ],
        },
      });
    }
  };

  const handleTypeChange = (newType: ParameterType) => {
    const updated: SchemaParameter = { ...param, type: newType };

    if (newType === "object" && !updated.properties) {
      updated.properties = [];
    } else if (newType !== "object") {
      delete updated.properties;
    }

    if (newType === "array" && !updated.items) {
      updated.items = {
        id: generateId(),
        name: "",
        type: "object",
        description: "",
        required: false,
        example: "",
        properties: [],
      };
    } else if (newType !== "array") {
      delete updated.items;
    }

    onChange(updated);
  };

  const depthColors = [
    "border-border bg-background",
    "border-border bg-muted",
    "border-border bg-background",
    "border-border bg-muted",
    "border-border bg-background",
  ];

  return (
    <div
      className={cn(
        "rounded-[--radius] border p-4 space-y-3",
        depthColors[depth % depthColors.length],
      )}
    >
      {/* Header row with expand/collapse for nested types */}
      <div className="flex items-start gap-2">
        {hasNested && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="mt-8 p-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            {expanded ? (
              <CaretDown className="h-4 w-4" />
            ) : (
              <CaretRight className="h-4 w-4" />
            )}
          </button>
        )}

        <div
          className={cn(
            "grid flex-1 gap-3",
            showName ? "md:grid-cols-3" : "md:grid-cols-2",
          )}
        >
          {showName && (
            <ElevatedInput
              value={param.name}
              onChange={(e) => onChange({ ...param, name: e.target.value })}
              label={t("httpConfig.paramName")}
              placeholder="user_id"
            />
          )}
          <ElevatedSelect
            value={param.type}
            onValueChange={handleTypeChange}
            label={t("httpConfig.dataType")}
          >
            {PARAMETER_TYPES.map((type) => (
              <ElevatedSelectItem key={type} value={type}>
                {type}
              </ElevatedSelectItem>
            ))}
          </ElevatedSelect>
          {param.type !== "object" && param.type !== "array" && (
            <ElevatedInput
              value={param.example}
              onChange={(e) => onChange({ ...param, example: e.target.value })}
              label={t("httpConfig.example")}
              placeholder="123"
            />
          )}
        </div>
      </div>

      {/* Description */}
      <ElevatedInput
        value={param.description}
        onChange={(e) => onChange({ ...param, description: e.target.value })}
        label={t("httpConfig.description")}
        placeholder={t("httpConfig.paramDescriptionPlaceholder")}
      />

      {/* Required + Remove */}
      <div className="flex items-center justify-between">
        {showRequired && (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={param.required}
              onChange={(e) =>
                onChange({ ...param, required: e.target.checked })
              }
              className="h-4 w-4 rounded border-foreground/20 text-primary-ink focus:ring-ring"
            />
            <span className="text-sm text-foreground">
              {t("httpConfig.required")}
            </span>
          </label>
        )}
        <button
          type="button"
          onClick={onRemove}
          className="flex items-center gap-1.5 text-sm text-destructive-ink hover:text-destructive-ink transition-colors"
        >
          <Trash className="h-4 w-4" />
          {t("httpConfig.remove")}
        </button>
      </div>

      {/* Nested properties for object type */}
      {expanded && param.type === "object" && depth < maxDepth && (
        <div className="mt-4 space-y-3 border-l-2 border-dashed border-border pl-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">
              {t("httpConfig.properties")}
            </span>
            <AddConfigButton
              label={t("httpConfig.addProperty")}
              onClick={addNestedProperty}
            />
          </div>
          {param.properties && param.properties.length > 0 ? (
            <div className="space-y-3">
              {param.properties.map((prop, i) => (
                <NestedSchemaParameterRow
                  key={prop.id}
                  param={prop}
                  onChange={(updated) => {
                    const newProps = [...(param.properties || [])];
                    newProps[i] = updated;
                    onChange({ ...param, properties: newProps });
                  }}
                  onRemove={() => {
                    onChange({
                      ...param,
                      properties: param.properties?.filter(
                        (_, idx) => idx !== i,
                      ),
                    });
                  }}
                  t={t}
                  depth={depth + 1}
                />
              ))}
            </div>
          ) : (
            <EmptyConfig>{t("httpConfig.noProperties")}</EmptyConfig>
          )}
        </div>
      )}

      {/* Items schema for array type */}
      {expanded &&
        param.type === "array" &&
        param.items &&
        depth < maxDepth && (
          <div className="mt-4 space-y-3 border-l-2 border-dashed border-border pl-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">
                {t("httpConfig.arrayItems")}
              </span>
            </div>

            {/* Item type selector */}
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                {t("httpConfig.itemType")}:
              </span>
              <ElevatedSelect
                value={param.items.type}
                onValueChange={(v) => {
                  const newItems = {
                    ...param.items!,
                    type: v as ParameterType,
                  };
                  if (v === "object" && !newItems.properties) {
                    newItems.properties = [];
                  } else if (v !== "object") {
                    delete newItems.properties;
                  }
                  onChange({ ...param, items: newItems });
                }}
              >
                {PARAMETER_TYPES.filter((t) => t !== "array").map((type) => (
                  <ElevatedSelectItem key={type} value={type}>
                    {type}
                  </ElevatedSelectItem>
                ))}
              </ElevatedSelect>
            </div>

            {/* Item description */}
            <ElevatedInput
              value={param.items.description}
              onChange={(e) =>
                onChange({
                  ...param,
                  items: { ...param.items!, description: e.target.value },
                })
              }
              label={t("httpConfig.itemDescription")}
              placeholder={t("httpConfig.itemDescriptionPlaceholder")}
            />

            {/* Nested properties for object items */}
            {param.items.type === "object" && (
              <div className="mt-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">
                    {t("httpConfig.itemProperties")}
                  </span>
                  <AddConfigButton
                    label={t("httpConfig.addProperty")}
                    onClick={addArrayItemProperty}
                  />
                </div>
                {param.items.properties && param.items.properties.length > 0 ? (
                  <div className="space-y-3">
                    {param.items.properties.map((prop, i) => (
                      <NestedSchemaParameterRow
                        key={prop.id}
                        param={prop}
                        onChange={(updated) => {
                          const newProps = [...(param.items!.properties || [])];
                          newProps[i] = updated;
                          onChange({
                            ...param,
                            items: { ...param.items!, properties: newProps },
                          });
                        }}
                        onRemove={() => {
                          onChange({
                            ...param,
                            items: {
                              ...param.items!,
                              properties: param.items!.properties?.filter(
                                (_, idx) => idx !== i,
                              ),
                            },
                          });
                        }}
                        t={t}
                        depth={depth + 1}
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyConfig>{t("httpConfig.noProperties")}</EmptyConfig>
                )}
              </div>
            )}
          </div>
        )}
    </div>
  );
}

function SimpleSchemaParameterRow({
  param,
  onChange,
  onRemove,
  t,
}: {
  param: SchemaParameter;
  onChange: (updated: SchemaParameter) => void;
  onRemove: () => void;
  t: (key: string) => string;
}) {
  return (
    <div className="space-y-3 rounded-[--radius] border border-border bg-background p-4">
      <div className="grid gap-3 md:grid-cols-3">
        <ElevatedInput
          value={param.name}
          onChange={(e) => onChange({ ...param, name: e.target.value })}
          label={t("httpConfig.paramName")}
          placeholder="user_id"
        />
        <ElevatedSelect
          value={param.type}
          onValueChange={(v) =>
            onChange({ ...param, type: v as ParameterType })
          }
          label={t("httpConfig.dataType")}
        >
          {["string", "number"].map((type) => (
            <ElevatedSelectItem key={type} value={type}>
              {type}
            </ElevatedSelectItem>
          ))}
        </ElevatedSelect>
        <ElevatedInput
          value={param.example}
          onChange={(e) => onChange({ ...param, example: e.target.value })}
          label={t("httpConfig.example")}
          placeholder="abc123"
        />
      </div>
      <ElevatedInput
        value={param.description}
        onChange={(e) => onChange({ ...param, description: e.target.value })}
        label={t("httpConfig.description")}
        placeholder={t("httpConfig.paramDescriptionPlaceholder")}
      />
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onRemove}
          className="flex items-center gap-1.5 text-sm text-destructive-ink hover:text-destructive-ink transition-colors"
        >
          <Trash className="h-4 w-4" />
          {t("httpConfig.remove")}
        </button>
      </div>
    </div>
  );
}

function HeaderRow({
  header,
  onChange,
  onRemove,
  t,
}: {
  header: HeaderEntry;
  onChange: (updated: HeaderEntry) => void;
  onRemove: () => void;
  t: (key: string) => string;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-[--radius] border border-border bg-background p-4 md:flex-row md:items-end">
      <div className="flex-1">
        <ElevatedInput
          value={header.key}
          onChange={(e) => onChange({ ...header, key: e.target.value })}
          label={t("httpConfig.headerKey")}
          placeholder="Authorization"
        />
      </div>
      <div className="flex-1">
        <ElevatedInput
          value={header.value}
          onChange={(e) => onChange({ ...header, value: e.target.value })}
          label={t("httpConfig.headerValue")}
          placeholder="Bearer token..."
        />
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive hover:text-destructive-foreground"
      >
        <Trash className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function HttpRequestConfigDialog({
  open,
  onOpenChange,
  tool,
  existingConfig,
  onSave,
}: HttpRequestConfigDialogProps) {
  const t = useTranslations("agents.form");
  const [config, setConfig] = useState<HttpRequestConfig>(() =>
    apiFormatToConfig(existingConfig),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [jsonMode, setJsonMode] = useState(false);
  const [jsonText, setJsonText] = useState("");

  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (newOpen && tool) {
        const parsedConfig = apiFormatToConfig(existingConfig);
        setConfig(parsedConfig);
        setJsonText(JSON.stringify(configToApiFormat(parsedConfig), null, 2));
        setErrors({});
        setJsonMode(false);
      }
      onOpenChange(newOpen);
    },
    [existingConfig, onOpenChange, tool],
  );

  const supportsBody = useMemo(
    () => ["POST", "PUT", "PATCH"].includes(config.method),
    [config.method],
  );

  const validateConfig = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!config.url.trim()) {
      newErrors.url = t("toolConfig.errors.required");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (jsonMode) {
      try {
        const parsed = JSON.parse(jsonText);
        onSave(parsed);
        onOpenChange(false);
      } catch {
        setErrors({ json: t("toolConfig.errors.invalidJson") });
      }
      return;
    }

    if (!validateConfig()) return;

    const apiConfig = configToApiFormat(config);
    onSave(apiConfig);
    onOpenChange(false);
  };

  const addPathParam = () => {
    setConfig((prev) => ({
      ...prev,
      pathParams: [...prev.pathParams, createEmptyParameter(true)],
    }));
  };

  const addQueryParam = () => {
    setConfig((prev) => ({
      ...prev,
      querySchema: [...prev.querySchema, createEmptyParameter()],
    }));
  };

  const addBodyParam = () => {
    setConfig((prev) => ({
      ...prev,
      bodySchema: [...prev.bodySchema, createEmptyParameter()],
    }));
  };

  const addHeader = () => {
    setConfig((prev) => ({
      ...prev,
      headers: [...prev.headers, { id: generateId(), key: "", value: "" }],
    }));
  };

  const toggleJsonMode = () => {
    if (!jsonMode) {
      setJsonText(JSON.stringify(configToApiFormat(config), null, 2));
    } else {
      try {
        const parsed = JSON.parse(jsonText);
        setConfig(apiFormatToConfig(parsed));
      } catch {
        // Keep current config if JSON is invalid
      }
    }
    setJsonMode(!jsonMode);
  };

  if (!tool) return null;

  const toolName = tool.displayName || tool.name;
  const toolDescription = tool.displayDescription || tool.description;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-5xl flex-col overflow-hidden p-0">
        <DialogHeader className="border-b border-border bg-card px-6 py-5">
          <DialogTitle className="flex items-center gap-3">
            <IconBox color="blue" size="sm">
              <Gear weight="fill" />
            </IconBox>
            <div className="min-w-0">
              <span className="block">{t("toolConfig.title")}</span>
              <span className="mt-0.5 block truncate text-sm font-normal text-muted-foreground">
                {toolName}
              </span>
            </div>
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t("toolConfig.description", { toolName })}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-5 overflow-y-auto bg-muted px-6 py-5">
          {/* JSON mode toggle */}
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={toggleJsonMode}
              className="inline-flex items-center gap-2 rounded-[--radius] border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
            >
              <Code className="h-4 w-4" />
              {jsonMode ? t("httpConfig.formMode") : t("httpConfig.jsonMode")}
            </button>
          </div>

          {jsonMode ? (
            <div className="rounded-[--radius] border border-border bg-card p-5">
              <ElevatedTextarea
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                rows={20}
                className="font-mono text-sm"
                placeholder='{\n  "url": "https://api.example.com",\n  "method": "POST"\n}'
              />
              {errors.json && (
                <p className="text-xs font-semibold text-destructive-ink">
                  {errors.json}
                </p>
              )}
            </div>
          ) : (
            <>
              {/* Info banner */}
              <div className="flex items-start gap-3 rounded-[--radius] border border-border bg-card p-4 shadow-sm">
                <DialogIcon>
                  <Info weight="fill" />
                </DialogIcon>
                <div className="min-w-0 text-sm">
                  <p className="font-semibold text-foreground">
                    {t("toolConfig.infoTitle")}
                  </p>
                  <p className="mt-1 leading-relaxed text-muted-foreground">
                    {toolDescription}
                  </p>
                </div>
              </div>

              {/* Basic Config */}
              <ConfigSection title={t("httpConfig.basicConfig")}>
                <div className="grid gap-4 lg:grid-cols-4">
                  <div className="lg:col-span-2">
                    <ElevatedInput
                      value={config.url}
                      onChange={(e) =>
                        setConfig((prev) => ({ ...prev, url: e.target.value }))
                      }
                      label={t("httpConfig.url")}
                      placeholder="https://api.example.com/users/{user_id}"
                    />
                    {errors.url && (
                      <p className="mt-1 text-xs font-semibold text-destructive-ink">
                        {errors.url}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("httpConfig.urlHint")}
                    </p>
                  </div>
                  <ElevatedSelect
                    value={config.method}
                    onValueChange={(v) =>
                      setConfig((prev) => ({
                        ...prev,
                        method: v as HttpMethod,
                      }))
                    }
                    label={t("httpConfig.method")}
                  >
                    {HTTP_METHODS.map((method) => (
                      <ElevatedSelectItem key={method} value={method}>
                        {method}
                      </ElevatedSelectItem>
                    ))}
                  </ElevatedSelect>
                  <ElevatedInput
                    type="number"
                    value={config.timeoutSeconds?.toString() || ""}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        timeoutSeconds: e.target.value
                          ? parseInt(e.target.value)
                          : null,
                      }))
                    }
                    label={t("httpConfig.timeout")}
                    placeholder="30"
                  />
                </div>
              </ConfigSection>

              {/* Headers */}
              <ConfigSection
                action={
                  <AddConfigButton
                    label={t("httpConfig.addHeader")}
                    onClick={addHeader}
                  />
                }
                description={t("httpConfig.headersHint")}
                title={t("httpConfig.headers")}
              >
                {config.headers.length > 0 && (
                  <div className="space-y-2">
                    {config.headers.map((header, i) => (
                      <HeaderRow
                        key={header.id}
                        header={header}
                        onChange={(updated) => {
                          const newHeaders = [...config.headers];
                          newHeaders[i] = updated;
                          setConfig((prev) => ({
                            ...prev,
                            headers: newHeaders,
                          }));
                        }}
                        onRemove={() =>
                          setConfig((prev) => ({
                            ...prev,
                            headers: prev.headers.filter((_, idx) => idx !== i),
                          }))
                        }
                        t={t}
                      />
                    ))}
                  </div>
                )}
                {config.headers.length === 0 ? (
                  <EmptyConfig>{t("httpConfig.headersHint")}</EmptyConfig>
                ) : null}
              </ConfigSection>

              {/* Path Parameters */}
              <ConfigSection
                action={
                  <AddConfigButton
                    label={t("httpConfig.addParam")}
                    onClick={addPathParam}
                  />
                }
                description={t("httpConfig.pathParamsHint")}
                title={t("httpConfig.pathParams")}
              >
                {config.pathParams.length > 0 && (
                  <div className="space-y-3">
                    {config.pathParams.map((param, i) => (
                      <SimpleSchemaParameterRow
                        key={param.id}
                        param={param}
                        onChange={(updated) => {
                          const newParams = [...config.pathParams];
                          newParams[i] = updated;
                          setConfig((prev) => ({
                            ...prev,
                            pathParams: newParams,
                          }));
                        }}
                        onRemove={() =>
                          setConfig((prev) => ({
                            ...prev,
                            pathParams: prev.pathParams.filter(
                              (_, idx) => idx !== i,
                            ),
                          }))
                        }
                        t={t}
                      />
                    ))}
                  </div>
                )}
                {config.pathParams.length === 0 ? (
                  <EmptyConfig>{t("httpConfig.pathParamsHint")}</EmptyConfig>
                ) : null}
              </ConfigSection>

              {/* Query Schema */}
              <ConfigSection
                action={
                  <AddConfigButton
                    label={t("httpConfig.addParam")}
                    onClick={addQueryParam}
                  />
                }
                description={t("httpConfig.querySchemaHint")}
                title={t("httpConfig.querySchema")}
              >
                {config.querySchema.length > 0 && (
                  <div className="space-y-3">
                    {config.querySchema.map((param, i) => (
                      <NestedSchemaParameterRow
                        key={param.id}
                        param={param}
                        onChange={(updated) => {
                          const newParams = [...config.querySchema];
                          newParams[i] = updated;
                          setConfig((prev) => ({
                            ...prev,
                            querySchema: newParams,
                          }));
                        }}
                        onRemove={() =>
                          setConfig((prev) => ({
                            ...prev,
                            querySchema: prev.querySchema.filter(
                              (_, idx) => idx !== i,
                            ),
                          }))
                        }
                        t={t}
                      />
                    ))}
                  </div>
                )}
                {config.querySchema.length === 0 ? (
                  <EmptyConfig>{t("httpConfig.querySchemaHint")}</EmptyConfig>
                ) : null}
              </ConfigSection>

              {/* Body Schema */}
              {supportsBody ? (
                <ConfigSection
                  action={
                    <AddConfigButton
                      label={t("httpConfig.addParam")}
                      onClick={addBodyParam}
                    />
                  }
                  description={t("httpConfig.bodySchemaHint")}
                  title={t("httpConfig.bodySchema")}
                >
                  {config.bodySchema.length > 0 && (
                    <div className="space-y-3">
                      {config.bodySchema.map((param, i) => (
                        <NestedSchemaParameterRow
                          key={param.id}
                          param={param}
                          onChange={(updated) => {
                            const newParams = [...config.bodySchema];
                            newParams[i] = updated;
                            setConfig((prev) => ({
                              ...prev,
                              bodySchema: newParams,
                            }));
                          }}
                          onRemove={() =>
                            setConfig((prev) => ({
                              ...prev,
                              bodySchema: prev.bodySchema.filter(
                                (_, idx) => idx !== i,
                              ),
                            }))
                          }
                          t={t}
                        />
                      ))}
                    </div>
                  )}
                  {config.bodySchema.length === 0 ? (
                    <EmptyConfig>{t("httpConfig.bodySchemaHint")}</EmptyConfig>
                  ) : null}
                </ConfigSection>
              ) : (
                <div className="flex items-start gap-3 rounded-[--radius] border border-border bg-card p-4 shadow-sm">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[--radius] bg-muted text-muted-foreground shadow-sm">
                    <Info weight="fill" className="h-4 w-4" />
                  </span>
                  <p className="text-sm text-muted-foreground">
                    {t("httpConfig.noBodyForMethod")}
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="gap-2 border-t border-border bg-card px-6 py-4">
          <Button
            type="button"
            variant="ghost"
            title={t("toolConfig.cancel")}
            onClick={() => onOpenChange(false)}
          />
          <Button
            type="button"
            variant="action"
            title={t("httpConfig.addTool")}
            onClick={handleSave}
            icon={<CheckCircle weight="fill" className="h-4 w-4" />}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
