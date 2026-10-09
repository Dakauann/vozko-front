"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CaretDown, Lock, Plus, PencilSimple, Sliders, Sparkle, Trash, X } from "@/components/icons";

import {
  ElevatedSheet,
  ElevatedSheetContent,
  ElevatedSheetHeader,
  ElevatedSheetTitle,
  ElevatedSheetDescription,
} from "@/components/elevated-design/elevated-sheet";
import ElevatedButton from "@/components/elevated-design/button";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import ElevatedTextarea from "@/components/elevated-design/elevated-textarea";
import { ElevatedSelect, ElevatedSelectItem } from "@/components/elevated-design/elevated-select";
import { ElevatedSwitch } from "@/components/elevated-design/elevated-switch";
import { ElevatedPillToggle } from "@/components/elevated-design/elevated-pill-toggle";
import { ToneSwatch } from "@/components/elevated-design/tone-swatch";
import { SectionError } from "@/components/dashboard/attendance/primitives";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

import {
  createCustomFieldAction,
  updateCustomFieldAction,
  deleteCustomFieldAction,
} from "@/app/actions/custom-fields";
import { useCustomFieldDefinitions } from "@/hooks/use-custom-field-definitions";
import {
  CUSTOM_FIELD_TONES,
  classificationField,
  classificationPreset,
  customFieldTypeHasOptions,
  type CustomFieldDefinition,
  type CustomFieldObjectType,
  type CustomFieldTone,
  type CustomFieldType,
} from "@/lib/crm/custom-fields";
import { codedErrorMessage } from "@/lib/api/coded-error";

import {
  asksSensitivity,
  draftFromDefinition,
  draftFromInput,
  draftIsComplete,
  draftPayload,
  emptyFieldDraft,
  optionKey,
  type FieldDraft,
} from "./custom-field-draft";

const FIELD_TYPES: CustomFieldType[] = ["text", "number", "date", "boolean", "select", "multiselect"];
const NO_TONE = "__no_tone__";
const SENSITIVITY_UNANSWERED = "";

type SensitivityAnswer = "yes" | "no" | typeof SENSITIVITY_UNANSWERED;

function sensitivityAnswer(sensitive: boolean | null): SensitivityAnswer {
  if (sensitive === null) return SENSITIVITY_UNANSWERED;
  return sensitive ? "yes" : "no";
}

interface CustomFieldManagerProps {
  objectType?: CustomFieldObjectType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
}

export default function CustomFieldManager({
  objectType = "opportunity",
  open,
  onOpenChange,
  onChanged,
}: CustomFieldManagerProps) {
  const t = useTranslations("customFields");
  const definitions = useCustomFieldDefinitions(objectType, open);
  const fields = definitions.definitions;
  const [draft, setDraft] = useState<FieldDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<CustomFieldDefinition | null>(null);

  const offersPreset = objectType === "lead" && definitions.loaded && !classificationField(fields);

  const startPreset = () =>
    setDraft({
      ...draftFromInput(
        classificationPreset({
          label: t("preset.label"),
          options: {
            positive: t("preset.options.positive"),
            negative: t("preset.options.negative"),
            toWin: t("preset.options.toWin"),
            notInformed: t("preset.options.notInformed"),
          },
        }),
      ),
      legalBasisExample: t("preset.legalBasisExample"),
    });

  const handleSave = async () => {
    if (!draft) return;
    const payload = draftPayload(objectType, draft);
    if (!payload) {
      toast.error(t("keyFailed"));
      return;
    }
    setSaving(true);
    const res = draft.id ? await updateCustomFieldAction(draft.id, payload) : await createCustomFieldAction(payload);
    setSaving(false);
    if (res.error || !res.field) {
      toast.error(codedErrorMessage(t, res.error ?? {}, t("saveFailed")));
      return;
    }
    toast.success(draft.id ? t("updated") : t("created"));
    setDraft(null);
    await definitions.reload();
    onChanged?.();
  };

  const handleDelete = async (field: CustomFieldDefinition): Promise<boolean> => {
    const { success, error: refusal } = await deleteCustomFieldAction(field.id);
    if (!success) {
      toast.error(codedErrorMessage(t, refusal ?? {}, t("deleteFailed")));
      return false;
    }
    toast.success(t("deleted"));
    await definitions.reload();
    onChanged?.();
    return true;
  };

  return (
    <ElevatedSheet open={open} onOpenChange={onOpenChange}>
      <ElevatedSheetContent side="right" className="flex w-full flex-col gap-0 p-0 max-sm:max-w-none max-sm:rounded-none sm:max-w-md">
        <ElevatedSheetHeader className="border-b border-border px-4 pb-4 pt-6 sm:px-6">
          <div className="flex items-center gap-3 pr-10">
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[--radius] bg-muted text-foreground">
              <Sliders weight="bold" className="h-4 w-4" />
            </span>
            <div>
              <ElevatedSheetTitle className="text-lg">{t("title")}</ElevatedSheetTitle>
              <ElevatedSheetDescription className="text-xs">
                {objectType === "lead" ? t("descriptionLead") : t("descriptionOpportunity")}
              </ElevatedSheetDescription>
            </div>
          </div>
        </ElevatedSheetHeader>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-5 sm:px-6">
          {draft ? (
            <DraftForm
              objectType={objectType}
              draft={draft}
              setDraft={setDraft}
              onSave={handleSave}
              onCancel={() => setDraft(null)}
              saving={saving}
            />
          ) : (
            <>
              {offersPreset ? (
                <div className="space-y-2 rounded-[--radius] border border-dashed border-border p-4">
                  <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Sparkle className="h-4 w-4 text-muted-foreground" aria-hidden />
                    {t("preset.title")}
                  </p>
                  <p className="text-xs text-muted-foreground">{t("preset.description")}</p>
                  <ElevatedButton variant="outline-subtle" size="sm" title={t("preset.action")} onClick={startPreset} />
                </div>
              ) : null}
              {definitions.failed ? (
                <SectionError
                  busy={false}
                  message={t("loadFailed")}
                  retrying={definitions.retrying}
                  onRetry={() => void definitions.reload()}
                />
              ) : definitions.loading ? (
                <p className="py-6 text-center text-xs text-muted-foreground">{t("loading")}</p>
              ) : fields.length === 0 ? (
                <div className="rounded-[--radius] border border-dashed border-border py-8 text-center">
                  <p className="text-sm text-muted-foreground">{t("empty")}</p>
                </div>
              ) : (
                fields.map((f) => (
                  <div key={f.id} className="group flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 truncate text-sm font-medium text-foreground">
                        {f.label}
                        {f.required ? <span className="text-destructive-ink">*</span> : null}
                        {f.sensitive ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-border px-1.5 text-2xs font-semibold text-muted-foreground">
                            <Lock className="h-3 w-3" aria-hidden />
                            {t("sensitive.badge")}
                          </span>
                        ) : null}
                        {f.role === "classification" ? (
                          <span className="rounded-full border border-border px-1.5 text-2xs font-semibold text-muted-foreground">
                            {t("role.badge")}
                          </span>
                        ) : null}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {t(`types.${f.type}`)}
                        <span className="ml-1 font-mono opacity-70">· {f.key}</span>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDraft(draftFromDefinition(f))}
                      className="flex h-[34px] w-[34px] items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:h-7 sm:w-7"
                      aria-label={t("editAction")}
                    >
                      <PencilSimple weight="bold" className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleting(f)}
                      className="flex h-[34px] w-[34px] items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive hover:text-destructive-foreground sm:h-7 sm:w-7"
                      aria-label={t("deleteAction")}
                    >
                      <Trash weight="bold" className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              )}
            </>
          )}
        </div>

        {deleting ? (
          <ConfirmDialog
            open
            onOpenChange={(next) => {
              if (!next) setDeleting(null);
            }}
            title={t("delete.title", { label: deleting.label })}
            description={deleting.sensitive ? t("delete.descriptionSensitive") : t("delete.description")}
            confirmLabel={t("delete.confirm")}
            cancelLabel={t("cancel")}
            tone="danger"
            onConfirm={() => handleDelete(deleting)}
          />
        ) : null}

        {!draft ? (
          <div className="border-t border-border px-4 py-4 sm:px-6">
            <ElevatedButton
              variant="primary"
              size="sm"
              title={t("newField")}
              icon={<Plus weight="bold" className="h-3.5 w-3.5" />}
              iconVisible
              onClick={() => setDraft(emptyFieldDraft())}
            />
          </div>
        ) : null}
      </ElevatedSheetContent>
    </ElevatedSheet>
  );
}

function DraftForm({
  objectType,
  draft,
  setDraft,
  onSave,
  onCancel,
  saving,
}: {
  objectType: CustomFieldObjectType;
  draft: FieldDraft;
  setDraft: (d: FieldDraft) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const t = useTranslations("customFields");
  const hasOptions = customFieldTypeHasOptions(draft.type);
  const lead = asksSensitivity(objectType);
  const complete = draftIsComplete(objectType, draft);

  const setOption = (key: string, patch: { value?: string; tone?: CustomFieldTone | undefined }) =>
    setDraft({ ...draft, options: draft.options.map((option) => (option.key === key ? { ...option, ...patch } : option)) });

  return (
    <div className="space-y-4 rounded-[--radius] border border-border bg-card p-4">
      <p className="text-2xs font-semibold text-muted-foreground">{draft.id ? t("editField") : t("newField")}</p>
      <ElevatedInput
        id="cf-label"
        label={t("label")}
        variant="outline"
        controlSize="sm"
        value={draft.label}
        onChange={(e) => setDraft({ ...draft, label: e.target.value })}
        placeholder={t("labelPlaceholder")}
      />
      <ElevatedSelect
        label={t("type")}
        value={draft.type}
        onValueChange={(v) => setDraft({ ...draft, type: v as CustomFieldType })}
        className="w-full"
        disabled={!!draft.id}
      >
        {FIELD_TYPES.map((type) => (
          <ElevatedSelectItem key={type} value={type}>
            {t(`types.${type}`)}
          </ElevatedSelectItem>
        ))}
      </ElevatedSelect>

      {hasOptions ? (
        <div className="space-y-2">
          <p className="pl-1 text-sm font-medium text-foreground">{t("options")}</p>
          {draft.options.map((option, index) => (
            <div key={option.key} className="grid grid-cols-[minmax(0,1fr)_7.5rem_auto] items-center gap-2">
              <ElevatedInput
                id={`cf-option-${option.key}`}
                aria-label={t("optionLabel", { index: index + 1 })}
                variant="outline"
                controlSize="sm"
                value={option.value}
                placeholder={t("optionPlaceholder", { index: index + 1 })}
                onChange={(e) => setOption(option.key, { value: e.target.value })}
              />
              <ElevatedSelect
                value={option.tone ?? NO_TONE}
                onValueChange={(tone) => setOption(option.key, { tone: tone === NO_TONE ? undefined : (tone as CustomFieldTone) })}
                trigger={
                  <button
                    type="button"
                    aria-label={t("optionTone", { option: option.value || t("optionPlaceholder", { index: index + 1 }) })}
                    className="flex h-[34px] w-full items-center gap-2 rounded-[--radius] border border-control-edge bg-card px-2.5 text-xs font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-muted sm:h-8"
                  >
                    {option.tone ? <ToneSwatch tone={option.tone} className="size-2.5" /> : null}
                    <span className="truncate">{option.tone ? t(`tones.${option.tone}`) : t("tones.none")}</span>
                    <CaretDown className="ml-auto h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                  </button>
                }
              >
                <ElevatedSelectItem value={NO_TONE}>{t("tones.none")}</ElevatedSelectItem>
                {CUSTOM_FIELD_TONES.map((tone) => (
                  <ElevatedSelectItem key={tone} value={tone}>
                    <span className="inline-flex items-center gap-2">
                      <ToneSwatch tone={tone} className="size-2.5" />
                      {t(`tones.${tone}`)}
                    </span>
                  </ElevatedSelectItem>
                ))}
              </ElevatedSelect>
              <button
                type="button"
                aria-label={t("removeOption")}
                onClick={() => setDraft({ ...draft, options: draft.options.filter((item) => item.key !== option.key) })}
                className="flex h-[34px] w-[34px] items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:h-8 sm:w-8"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setDraft({ ...draft, options: [...draft.options, { key: optionKey(), value: "" }] })}
            className="inline-flex min-h-[34px] items-center gap-1.5 px-1 text-sm font-medium text-primary-ink hover:underline sm:min-h-[28px]"
          >
            <Plus className="h-3.5 w-3.5" />
            {t("addOption")}
          </button>
        </div>
      ) : null}

      <ElevatedSwitch
        id="cf-required"
        label={t("required")}
        checked={draft.required}
        onCheckedChange={(checked) => setDraft({ ...draft, required: checked })}
      />

      {lead ? (
        <fieldset className="space-y-2">
          <legend className="pl-1 text-sm font-medium text-foreground">{t("sensitive.question")}</legend>
          <p className="pl-1 text-xs text-muted-foreground">{t("sensitive.hint")}</p>
          <ElevatedPillToggle<SensitivityAnswer>
            aria-label={t("sensitive.question")}
            size="md"
            value={sensitivityAnswer(draft.sensitive)}
            onChange={(answer) => setDraft({ ...draft, sensitive: answer === "yes" })}
            options={[
              { value: "no", label: t("sensitive.no") },
              { value: "yes", label: t("sensitive.yes") },
            ]}
          />
          {draft.sensitive === null ? <p className="pl-1 text-xs text-muted-foreground">{t("sensitive.choiceMissing")}</p> : null}
          {draft.sensitive ? (
            <ElevatedTextarea
              id="cf-legal-basis"
              label={t("sensitive.legalBasis")}
              variant="outline"
              controlSize="sm"
              rows={3}
              maxLength={500}
              value={draft.legalBasis}
              placeholder={draft.legalBasisExample ?? t("sensitive.legalBasisHint")}
              onChange={(e) => setDraft({ ...draft, legalBasis: e.target.value })}
            />
          ) : null}
        </fieldset>
      ) : null}

      {lead && draft.type === "select" ? (
        <ElevatedSwitch
          id="cf-classification"
          label={t("role.classification")}
          description={t("role.classificationHint")}
          checked={draft.classification}
          onCheckedChange={(checked) => setDraft({ ...draft, classification: checked })}
        />
      ) : null}

      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex min-h-[34px] items-center gap-1 rounded-lg px-2.5 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <X weight="bold" className="h-3.5 w-3.5" />
          {t("cancel")}
        </button>
        <ElevatedButton
          variant="primary"
          size="sm"
          title={saving ? t("saving") : t("save")}
          onClick={onSave}
          disabled={saving || !complete}
        />
      </div>
    </div>
  );
}
