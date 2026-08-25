"use client";

import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import {
  ElevatedSelect,
  ElevatedSelectItem,
} from "@/components/elevated-design/elevated-select";
import { Plus, Trash, X } from "@/components/icons";
import { useCallback, useState, useTransition } from "react";

import type { AgentListItem } from "@/lib/agents/types";
import Button from "@/components/elevated-design/button";
import { ElevatedCommandSelect } from "@/components/elevated-design/elevated-command-select";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { ElevatedSwitch } from "@/components/elevated-design/elevated-switch";
import { createSupportInboxAction } from "@/app/actions/support-inboxes";
import { listAgentsAction } from "@/app/actions/agents";
import { usePaginatedSelect } from "@/hooks/use-paginated-select";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { useTranslations } from "next-intl";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

const WIDGET_COLORS = [
  "#7c3aed",
  "#6366f1",
  "#3b82f6",
  "#0ea5e9",
  "#14b8a6",
  "#10b981",
  "#22c55e",
  "#eab308",
  "#f97316",
  "#ef4444",
  "#ec4899",
  "#8b5cf6",
  "#0d9488",
  "#059669",
  "#d97706",
  "#dc2626",
];

const PRE_CHAT_FIELD_TYPES = ["text", "email", "textarea", "select"] as const;

const createFormSchema = (t: (key: string) => string) => {
  return z.object({
    name: z.string().trim().min(1, t("validation.nameRequired")),
    greetingMessage: z.string().trim().optional().or(z.literal("")),
    widgetColor: z.string().optional().or(z.literal("")),
    enableAgentResponses: z.boolean(),
    agentId: z.string().nullable().optional(),
    allowedOrigins: z.array(
      z.object({
        value: z.string().trim().url(t("validation.originUrl")),
      }),
    ),
    preChatFields: z.array(
      z.object({
        name: z.string().trim().min(1, t("validation.fieldNameRequired")),
        label: z.string().trim().min(1, t("validation.fieldLabelRequired")),
        type: z.enum(PRE_CHAT_FIELD_TYPES),
        required: z.boolean(),
        options: z.string().trim().optional().or(z.literal("")),
      }),
    ),
  });
};

type FormValues = z.infer<ReturnType<typeof createFormSchema>>;

const FieldError = ({ message }: { message?: string }) => {
  if (!message) return null;
  return <p className="mt-1 text-xs font-semibold text-destructive-ink">{message}</p>;
};

export default function CreateSupportInboxForm() {
  const t = useTranslations("supportInboxesPage.form");
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [selectedColor, setSelectedColor] = useState(WIDGET_COLORS[0]);

  const agentSelect = usePaginatedSelect<AgentListItem>({
    fetchFn: useCallback(async (page: number, search: string) => {
      const result = await listAgentsAction({
        page,
        pageSize: 20,
        search: search || undefined,
      });
      return { items: result.agents ?? [], totalPages: result.meta.totalPages };
    }, []),
    mapOption: useCallback(
      (agent: AgentListItem) => ({
        label: agent.name,
        value: agent.id,
      }),
      [],
    ),
  });

  const schema = createFormSchema(t);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      greetingMessage: "",
      widgetColor: WIDGET_COLORS[0],
      enableAgentResponses: false,
      agentId: null,
      allowedOrigins: [],
      preChatFields: [],
    },
  });

  const enableAgent = useWatch({ control, name: "enableAgentResponses" });
  const preChatFieldValues = useWatch({ control, name: "preChatFields" });

  const {
    fields: originFields,
    append: appendOrigin,
    remove: removeOrigin,
  } = useFieldArray({ control, name: "allowedOrigins" });

  const {
    fields: preChatFieldEntries,
    append: appendField,
    remove: removeField,
  } = useFieldArray({ control, name: "preChatFields" });

  const onSubmit = useCallback(
    (data: FormValues) => {
      startTransition(async () => {
        const result = await createSupportInboxAction({
          name: data.name,
          greetingMessage: data.greetingMessage || undefined,
          widgetColor: data.widgetColor || selectedColor,
          enableAgentResponses: data.enableAgentResponses,
          agentId: data.enableAgentResponses
            ? data.agentId || undefined
            : undefined,
          allowedOrigins: data.allowedOrigins.map((o) => o.value),
          preChatFields: data.preChatFields.map((f) => ({
            name: f.name,
            label: f.label,
            type: f.type as "text" | "email" | "textarea" | "select",
            required: f.required,
            options:
              f.type === "select" && f.options
                ? f.options
                    .split(",")
                    .map((o) => o.trim())
                    .filter(Boolean)
                : undefined,
          })),
        });

        if (result.error) {
          toast({
            title: t("errorTitle"),
            description: result.error,
            variant: "destructive",
          });
        } else {
          toast({ title: t("successTitle"), description: t("successMessage") });
          router.push("/dashboard/support-inboxes");
        }
      });
    },
    [selectedColor, router, t, toast],
  );

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Basic Info */}
      <ElevatedContainer className="space-y-6">
        <h3 className="font-display text-lg font-semibold tracking-[0.01em] text-foreground">
          {t("basicInfoTitle")}
        </h3>

        <Controller
          name="name"
          control={control}
          render={({ field }) => <ElevatedInput label={t("name")} {...field} />}
        />
        <FieldError message={errors.name?.message} />

        <Controller
          name="greetingMessage"
          control={control}
          render={({ field }) => (
            <ElevatedInput
              label={t("greetingMessage")}
              {...field}
              value={field.value ?? ""}
            />
          )}
        />
      </ElevatedContainer>

      {/* Widget Color */}
      <ElevatedContainer className="space-y-4">
        <h3 className="font-display text-lg font-semibold tracking-[0.01em] text-foreground">
          {t("widgetColorTitle")}
        </h3>
        <p className="text-sm text-muted-foreground">
          {t("widgetColorDescription")}
        </p>

        <Controller
          name="widgetColor"
          control={control}
          render={({ field }) => (
            <div className="flex flex-wrap gap-2">
              {WIDGET_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`h-8 w-8 rounded-full ring-2 transition-transform hover:scale-110 ${
                    (field.value || selectedColor) === color
                      ? "ring-foreground ring-offset-2 ring-offset-background"
                      : "ring-transparent"
                  }`}
                  style={{ backgroundColor: color }}
                  onClick={() => {
                    field.onChange(color);
                    setSelectedColor(color);
                  }}
                />
              ))}
            </div>
          )}
        />
      </ElevatedContainer>

      {/* AI Agent */}
      <ElevatedContainer className="space-y-4">
        <h3 className="font-display text-lg font-semibold tracking-[0.01em] text-foreground">
          {t("aiAgentTitle")}
        </h3>

        <Controller
          name="enableAgentResponses"
          control={control}
          render={({ field }) => (
            <ElevatedSwitch
              label={t("enableAgent")}
              description={t("enableAgentDescription")}
              checked={field.value}
              onCheckedChange={field.onChange}
            />
          )}
        />

        {enableAgent && (
          <>
            <Controller
              name="agentId"
              control={control}
              render={({ field }) => (
                <ElevatedCommandSelect
                  label={t("selectAgent")}
                  value={field.value || ""}
                  onValueChange={field.onChange}
                  options={agentSelect.options}
                  onSearch={agentSelect.onSearch}
                  onScrollEnd={agentSelect.onScrollEnd}
                  onOpenChange={agentSelect.onOpenChange}
                  isLoading={agentSelect.isLoading}
                  searchPlaceholder={t("searchAgent")}
                  emptyMessage={t("noAgents")}
                />
              )}
            />
            <FieldError message={errors.agentId?.message} />
          </>
        )}
      </ElevatedContainer>

      {/* Allowed Origins */}
      <ElevatedContainer className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-lg font-semibold tracking-[0.01em] text-foreground">
              {t("originsTitle")}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t("originsDescription")}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            title={t("addOrigin")}
            icon={<Plus className="h-4 w-4" weight="bold" />}
            iconVisible
            iconSide="left"
            onClick={() => appendOrigin({ value: "" })}
          />
        </div>

        {originFields.length === 0 && (
          <p className="text-sm text-muted-foreground italic">
            {t("noOriginsNote")}
          </p>
        )}

        <div className="space-y-3">
          {originFields.map((field, index) => (
            <div key={field.id} className="flex items-start gap-2">
              <div className="flex-1">
                <Controller
                  name={`allowedOrigins.${index}.value`}
                  control={control}
                  render={({ field: inputField }) => (
                    <ElevatedInput
                      label={`${t("origin")} ${index + 1}`}
                      placeholder="https://example.com"
                      {...inputField}
                    />
                  )}
                />
                <FieldError
                  message={errors.allowedOrigins?.[index]?.value?.message}
                />
              </div>
              <button
                type="button"
                onClick={() => removeOrigin(index)}
                className="mt-3 rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-destructive-ink transition-colors"
              >
                <X className="h-4 w-4" weight="bold" />
              </button>
            </div>
          ))}
        </div>
      </ElevatedContainer>

      {/* Pre-Chat Fields */}
      <ElevatedContainer className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-lg font-semibold tracking-[0.01em] text-foreground">
              {t("preChatTitle")}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t("preChatDescription")}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            title={t("addField")}
            icon={<Plus className="h-4 w-4" weight="bold" />}
            iconVisible
            iconSide="left"
            onClick={() =>
              appendField({
                name: "",
                label: "",
                type: "text",
                required: false,
                options: "",
              })
            }
          />
        </div>

        {preChatFieldEntries.length === 0 && (
          <p className="text-sm text-muted-foreground italic">
            {t("noFieldsNote")}
          </p>
        )}

        <div className="space-y-4">
          {preChatFieldEntries.map((entry, index) => (
            <div
              key={entry.id}
              className="space-y-3 rounded-[--radius] border border-border bg-card p-4"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  {t("field")} {index + 1}
                </span>
                <button
                  type="button"
                  onClick={() => removeField(index)}
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive-ink transition-colors"
                >
                  <Trash className="h-4 w-4" weight="bold" />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <Controller
                    name={`preChatFields.${index}.name`}
                    control={control}
                    render={({ field }) => (
                      <ElevatedInput label={t("fieldName")} {...field} />
                    )}
                  />
                  <FieldError
                    message={errors.preChatFields?.[index]?.name?.message}
                  />
                </div>
                <div>
                  <Controller
                    name={`preChatFields.${index}.label`}
                    control={control}
                    render={({ field }) => (
                      <ElevatedInput label={t("fieldLabel")} {...field} />
                    )}
                  />
                  <FieldError
                    message={errors.preChatFields?.[index]?.label?.message}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Controller
                  name={`preChatFields.${index}.type`}
                  control={control}
                  render={({ field }) => (
                    <ElevatedSelect
                      label={t("fieldType")}
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      {PRE_CHAT_FIELD_TYPES.map((type) => (
                        <ElevatedSelectItem key={type} value={type}>
                          {t(`fieldTypes.${type}`)}
                        </ElevatedSelectItem>
                      ))}
                    </ElevatedSelect>
                  )}
                />

                <Controller
                  name={`preChatFields.${index}.required`}
                  control={control}
                  render={({ field }) => (
                    <div className="flex items-end pb-1">
                      <ElevatedSwitch
                        label={t("fieldRequired")}
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </div>
                  )}
                />
              </div>

              {preChatFieldValues?.[index]?.type === "select" && (
                <div>
                  <Controller
                    name={`preChatFields.${index}.options`}
                    control={control}
                    render={({ field }) => (
                      <ElevatedInput
                        label={t("fieldOptions")}
                        placeholder={t("fieldOptionsPlaceholder")}
                        {...field}
                        value={field.value ?? ""}
                      />
                    )}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("fieldOptionsHint")}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </ElevatedContainer>

      {/* Submit */}
      <div className="flex items-center justify-end gap-3 pt-4">
        <Button
          type="button"
          variant="ghost"
          title={t("cancel")}
          onClick={() => router.push("/dashboard/support-inboxes")}
        />
        <Button
          type="submit"
          variant="primary"
          title={isPending ? t("creating") : t("create")}
          disabled={isPending}
        />
      </div>
    </form>
  );
}
