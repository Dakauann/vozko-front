"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { createGroupAnalysisAction, getWorkspaceGroupAction, updateGroupAnalysisAction } from "@/app/actions/unofficial-whatsapp-groups";
import { Skeleton } from "@/components/audience/shared";
import { Brain, CircleNotch, NotePencil, Plus, Tag, Trash } from "@/components/icons";
import Button from "@/components/elevated-design/button";
import { ElevatedCommandSelect } from "@/components/elevated-design/elevated-command-select";
import { ElevatedPillToggle } from "@/components/elevated-design/elevated-pill-toggle";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import ElevatedSelect, { ElevatedSelectItem } from "@/components/elevated-design/elevated-select";
import {
  ElevatedSheet,
  ElevatedSheetContent,
  ElevatedSheetDescription,
  ElevatedSheetFooter,
  ElevatedSheetHeader,
  ElevatedSheetTitle,
} from "@/components/elevated-design/elevated-sheet";
import ElevatedTextarea from "@/components/elevated-design/elevated-textarea";
import { Notice } from "@/components/ui/notice";
import { GroupAvatar } from "@/components/unofficial-whatsapp-groups/marks";
import { useWorkspace } from "@/contexts/workspace-context";
import { Link } from "@/i18n/routing";
import {
  MAX_MESSAGES_PER_CYCLE,
  MAX_PROMPT_CHARS,
  MAX_TRACKED_FIELDS,
  type AnalysisTrigger,
  type GroupAnalysis,
  type TrackedFieldType,
  type WorkspaceGroup,
} from "@/lib/unofficial-whatsapp-groups/types";
import { cn } from "@/lib/utils";

import { groupsRoutes } from "../kit/routes";
import { useGroupName } from "../kit/use-groups-format";
import {
  analysisFormErrors,
  analysisFormFrom,
  analysisPatch,
  analysisPayload,
  formIsValid,
  promptLength,
  toFieldKey,
  TRACKED_FIELD_KEY_MAX,
  type AnalysisForm,
  type AnalysisFormErrors,
} from "./analysis-form";
import { useFollowedGroups } from "./use-followed-groups";

const FIELD_TYPES: TrackedFieldType[] = ["text", "number", "percentage", "boolean"];
const TRIGGERS: AnalysisTrigger[] = ["message_count", "scheduled"];

export type FormGroup = Pick<WorkspaceGroup, "id" | "subject" | "pictureUrl" | "memberCount">;

export interface AnalysisFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  analysis?: GroupAnalysis;
  presetGroupId?: string;
  lockGroup?: boolean;
  group?: FormGroup;
  groupId?: string;
  timezone?: string;
  onSaved: (analysis: GroupAnalysis) => void;
}

export function AnalysisFormSheet({ open, onOpenChange, analysis, presetGroupId, lockGroup, group, groupId, timezone, onSaved }: AnalysisFormSheetProps) {
  const { can } = useWorkspace();
  const canConfigure = can("unofficial_whatsapp_groups", "configure");
  const preset = analysis?.groupId ?? groupId ?? presetGroupId ?? group?.id;
  const locked = Boolean(analysis) || Boolean(groupId) || Boolean(lockGroup && preset);
  return (
    <ElevatedSheet open={open} onOpenChange={onOpenChange}>
      <ElevatedSheetContent side="right" className="w-full sm:max-w-[600px]">
        {open && canConfigure ? (
          <AnalysisFormBody
            key={analysis?.id ?? `new-${preset ?? "pick"}`}
            presetGroupId={preset}
            locked={locked}
            group={group}
            analysis={analysis}
            timezone={timezone}
            onClose={() => onOpenChange(false)}
            onSaved={onSaved}
          />
        ) : null}
      </ElevatedSheetContent>
    </ElevatedSheet>
  );
}

function AnalysisFormBody({
  presetGroupId,
  locked,
  group,
  analysis,
  timezone,
  onClose,
  onSaved,
}: {
  presetGroupId?: string;
  locked: boolean;
  group?: FormGroup;
  analysis?: GroupAnalysis;
  timezone?: string;
  onClose: () => void;
  onSaved: (analysis: GroupAnalysis) => void;
}) {
  const t = useTranslations("unofficialGroups.analyses.form");
  const tf = useTranslations("unofficialGroups.analyses.formV2");
  const [form, setForm] = useState<AnalysisForm>(() => analysisFormFrom(analysis, presetGroupId));
  const [errors, setErrors] = useState<AnalysisFormErrors | null>(null);
  const [saving, startSaving] = useTransition();

  const update = <K extends keyof AnalysisForm>(field: K, value: AnalysisForm[K]) => {
    const next = { ...form, [field]: value };
    setForm(next);
    if (errors) setErrors(analysisFormErrors(next));
  };
  const has = (issue: AnalysisFormErrors["issues"][number]) => errors?.issues.includes(issue) ?? false;
  const promptChars = promptLength(form.prompt);
  const batch = Number(form.messagesPerCycle) || 0;

  const save = () => {
    const found = analysisFormErrors(form);
    setErrors(found);
    if (!formIsValid(found)) return;
    startSaving(async () => {
      const result = analysis ? await updateGroupAnalysisAction(analysis.id, analysisPatch(form, analysis)) : await createGroupAnalysisAction(analysisPayload(form));
      if (result.error || !result.data) {
        toast.error(t("saveFailed"), { description: result.error });
        return;
      }
      toast(analysis ? t("updated") : t("created"), { description: result.data.name });
      onClose();
      onSaved(result.data);
    });
  };

  return (
    <>
      <ElevatedSheetHeader>
        <div className="flex items-start gap-3 pr-10">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[--radius] bg-muted text-primary-ink">
            <Brain className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <ElevatedSheetTitle>{analysis ? t("editTitle") : t("createTitle")}</ElevatedSheetTitle>
            <ElevatedSheetDescription>{t("subtitle")}</ElevatedSheetDescription>
          </div>
        </div>
      </ElevatedSheetHeader>

      <div className="flex-1 space-y-5 overflow-y-auto px-6 pb-6">
        <div className="space-y-1.5">
          <ElevatedInput
            label={tf("name")}
            icon={<Tag className="h-4 w-4" weight="bold" />}
            value={form.name}
            required
            onChange={(event) => update("name", event.target.value)}
            error={has("name") ? t("invalid.name") : undefined}
          />
          <p className="text-xs text-muted-foreground">{tf("nameExample")}</p>
        </div>

        {locked ? (
          group ? (
            <LockedGroup group={group} />
          ) : presetGroupId ? (
            <LockedGroupById groupId={presetGroupId} />
          ) : null
        ) : (
          <GroupPicker value={form.groupId} onChange={(id) => update("groupId", id)} invalid={has("group")} />
        )}

        <fieldset className="space-y-3">
          <legend className="mb-2 text-xs font-semibold text-muted-foreground">{tf("trigger")}</legend>
          <ElevatedPillToggle<AnalysisTrigger>
            aria-label={tf("trigger")}
            size="md"
            value={form.trigger}
            onChange={(value) => update("trigger", value)}
            options={TRIGGERS.map((trigger) => ({ value: trigger, label: tf(`triggers.${trigger}`) }))}
          />
          <p className="text-xs text-muted-foreground">{t(`triggers.${form.trigger}.hint`)}</p>
          <div className="space-y-1.5">
            <ElevatedInput
              label={t("messagesPerCycle")}
              inputMode="numeric"
              value={form.messagesPerCycle}
              onChange={(event) => update("messagesPerCycle", event.target.value.replace(/\D/g, ""))}
              error={has("messagesPerCycle") ? t("invalid.messagesPerCycle", { max: MAX_MESSAGES_PER_CYCLE }) : undefined}
              className="max-w-[220px]"
            />
            <p className="text-xs text-muted-foreground">{tf("perCycleHint")}</p>
          </div>
          {form.trigger === "scheduled" ? (
            <div className="space-y-1.5">
              <ElevatedInput
                label={tf("time")}
                type="time"
                value={form.scheduleTime}
                onChange={(event) => update("scheduleTime", event.target.value)}
                error={has("schedule") ? t("invalid.schedule") : undefined}
                className="max-w-[220px]"
              />
              {!has("schedule") && form.scheduleTime ? (
                <p className="text-xs text-foreground">
                  {timezone
                    ? tf("scheduleSentence", { time: form.scheduleTime, timezone, count: batch })
                    : tf("scheduleSentenceNoZone", { time: form.scheduleTime, count: batch })}
                </p>
              ) : null}
            </div>
          ) : null}
        </fieldset>

        <div className="space-y-1.5">
          <ElevatedTextarea
            label={tf("prompt")}
            icon={<NotePencil className="h-4 w-4" weight="bold" />}
            value={form.prompt}
            rows={8}
            required
            onChange={(event) => update("prompt", event.target.value)}
            error={has("prompt") ? t("invalid.prompt") : has("promptTooLong") ? t("invalid.promptTooLong", { max: MAX_PROMPT_CHARS }) : undefined}
          />
          <div className="flex items-start justify-between gap-3 text-xs">
            <div className="min-w-0 space-y-1">
              <p className="text-muted-foreground">{tf("promptHint")}</p>
              {form.prompt.trim() ? null : (
                <button
                  type="button"
                  onClick={() => update("prompt", tf("template"))}
                  className="rounded-sm text-xs font-semibold text-foreground underline underline-offset-2 hover:text-primary-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {tf("useTemplate")}
                </button>
              )}
            </div>
            <span className={cn("readout shrink-0 tabular-nums", promptChars > MAX_PROMPT_CHARS ? "text-destructive-ink" : "text-muted-foreground")}>
              {t("promptCount", { count: promptChars, max: MAX_PROMPT_CHARS })}
            </span>
          </div>
        </div>

        <TrackedFieldsEditor form={form} errors={errors} onChange={(fields) => update("trackedFields", fields)} />

        <Notice tone="info" title={t("noticeTitle")}>
          <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
            {analysis ? null : <li>{t("noticeOnlyNew")}</li>}
            <li>{t("noticeBalance")}</li>
          </ul>
        </Notice>
      </div>

      <ElevatedSheetFooter className="flex-row justify-end">
        <Button variant="ghost" title={t("cancel")} onClick={onClose} disabled={saving} />
        <Button
          variant="primary"
          title={saving ? t("saving") : analysis ? t("save") : t("create")}
          onClick={save}
          disabled={saving}
          icon={saving ? <CircleNotch className="h-4 w-4 animate-spin" weight="bold" /> : undefined}
          iconVisible={saving}
          iconSide="left"
        />
      </ElevatedSheetFooter>
    </>
  );
}

function TrackedFieldsEditor({
  form,
  errors,
  onChange,
}: {
  form: AnalysisForm;
  errors: AnalysisFormErrors | null;
  onChange: (fields: AnalysisForm["trackedFields"]) => void;
}) {
  const t = useTranslations("unofficialGroups.analyses.form");
  const tf = useTranslations("unofficialGroups.analyses.formV2");
  const fields = form.trackedFields;
  const full = fields.length >= MAX_TRACKED_FIELDS;

  const replace = (index: number, patch: Partial<AnalysisForm["trackedFields"][number]>) =>
    onChange(fields.map((field, position) => (position === index ? { ...field, ...patch } : field)));

  return (
    <fieldset className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <legend className="text-xs font-semibold text-muted-foreground">{tf("trackedFields")}</legend>
          <p className="mt-0.5 text-xs text-muted-foreground">{t("trackedFieldsHint", { max: MAX_TRACKED_FIELDS })}</p>
        </div>
        <span className="readout shrink-0 text-xs tabular-nums text-muted-foreground">{t("trackedFieldsCount", { count: fields.length, max: MAX_TRACKED_FIELDS })}</span>
      </div>

      {fields.length > 0 ? (
        <ul className="space-y-2">
          {fields.map((field, index) => {
            const issue = errors?.fields[index] ?? null;
            return (
              <li key={index} className="grid grid-cols-[minmax(0,1fr)_10rem_auto] items-start gap-2">
                <ElevatedInput
                  label={t("fieldKey")}
                  controlSize="sm"
                  value={field.key}
                  maxLength={TRACKED_FIELD_KEY_MAX + 10}
                  onChange={(event) => replace(index, { key: toFieldKey(event.target.value) })}
                  error={issue ? t(`invalid.field.${issue}`, { max: TRACKED_FIELD_KEY_MAX }) : undefined}
                />
                <ElevatedSelect label={t("fieldType")} value={field.type} onValueChange={(value) => replace(index, { type: value as TrackedFieldType })}>
                  {FIELD_TYPES.map((type) => (
                    <ElevatedSelectItem key={type} value={type}>
                      {t(`fieldTypes.${type}`)}
                    </ElevatedSelectItem>
                  ))}
                </ElevatedSelect>
                <button
                  type="button"
                  onClick={() => onChange(fields.filter((_, position) => position !== index))}
                  aria-label={t("removeField", { key: field.key || String(index + 1) })}
                  title={t("removeField", { key: field.key || String(index + 1) })}
                  className="mt-1 inline-flex h-8 w-8 items-center justify-center rounded-[--radius] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Trash className="h-4 w-4" weight="bold" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {errors?.issues.includes("tooManyFields") ? <p className="text-xs text-destructive-ink">{t("invalid.tooManyFields", { max: MAX_TRACKED_FIELDS })}</p> : null}

      <Button
        variant="outline"
        size="sm"
        title={t("addField")}
        icon={<Plus className="h-4 w-4" weight="bold" />}
        iconVisible
        iconSide="left"
        disabled={full}
        onClick={() => onChange([...fields, { key: "", type: "text" }])}
      />
      {full ? <p className="text-xs text-muted-foreground">{t("trackedFieldsFull", { max: MAX_TRACKED_FIELDS })}</p> : null}
    </fieldset>
  );
}

function LockedGroupFrame({ children }: { children: ReactNode }) {
  const tf = useTranslations("unofficialGroups.analyses.formV2");
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold text-muted-foreground">{tf("group")}</p>
      {children}
    </div>
  );
}

function LockedGroup({ group }: { group: FormGroup }) {
  const t = useTranslations("unofficialGroups.analyses.form");
  const groupName = useGroupName();
  const name = groupName(group.subject);
  return (
    <LockedGroupFrame>
      <div className="flex items-center gap-3 rounded-[--radius] border border-border bg-card px-3 py-2">
        <GroupAvatar group={{ subject: name, pictureUrl: group.pictureUrl }} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-foreground">{name}</span>
          <span className="block text-2xs text-muted-foreground">{t("groupMembers", { count: group.memberCount })}</span>
        </span>
      </div>
    </LockedGroupFrame>
  );
}

function LockedGroupById({ groupId }: { groupId: string }) {
  const tf = useTranslations("unofficialGroups.analyses.formV2");
  const [loaded, setLoaded] = useState<{ groupId: string; group: FormGroup | null; error: string | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getWorkspaceGroupAction(groupId).then((result) => {
      if (cancelled) return;
      setLoaded({ groupId, group: result.data?.group ?? null, error: result.data ? null : (result.error ?? null) });
    });
    return () => {
      cancelled = true;
    };
  }, [groupId]);

  if (loaded?.groupId === groupId && loaded.group) return <LockedGroup group={loaded.group} />;
  return (
    <LockedGroupFrame>
      {loaded?.groupId === groupId ? (
        <Notice tone="fault" title={tf("groupLoadFailed")}>
          {loaded.error ? <p className="text-muted-foreground">{loaded.error}</p> : null}
        </Notice>
      ) : (
        <Skeleton className="h-[50px]" />
      )}
    </LockedGroupFrame>
  );
}

function GroupPicker({ value, onChange, invalid }: { value: string; onChange: (groupId: string) => void; invalid: boolean }) {
  const t = useTranslations("unofficialGroups.analyses.form");
  const tf = useTranslations("unofficialGroups.analyses.formV2");
  const groupName = useGroupName();
  const [search, setSearch] = useState("");
  const followed = useFollowedGroups(search);
  const [picked, setPicked] = useState<WorkspaceGroup | null>(null);

  const optionOf = (group: WorkspaceGroup) => ({
    value: group.id,
    label: groupName(group.subject),
    icon: <GroupAvatar group={{ subject: groupName(group.subject), pictureUrl: group.pictureUrl }} size="sm" />,
    meta: t("groupMembers", { count: group.memberCount }),
  });
  const options = followed.groups.map(optionOf);
  if (picked && !options.some((option) => option.value === picked.id)) options.unshift(optionOf(picked));
  const noneAtAll = !followed.loading && !followed.error && !search.trim() && followed.totalItems === 0;

  return (
    <div className="space-y-1.5">
      <ElevatedCommandSelect
        label={tf("group")}
        options={options}
        value={value || null}
        fullWidth
        onValueChange={(id) => {
          setPicked(followed.groups.find((group) => group.id === id) ?? picked);
          onChange(id);
        }}
        onSearch={setSearch}
        onOpenChange={(isOpen) => {
          if (!isOpen) setSearch("");
        }}
        isLoading={followed.loading}
        searchPlaceholder={t("groupSearch")}
        emptyMessage={tf("groupEmpty")}
      />
      {followed.error ? <Notice tone="fault">{followed.error}</Notice> : null}
      {noneAtAll ? (
        <p className="text-xs text-muted-foreground">
          {tf("groupEmpty")}{" "}
          <Link
            href={groupsRoutes.all({ action: "create" })}
            className="rounded-sm font-semibold text-foreground underline underline-offset-2 hover:text-primary-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {tf("createGroup")}
          </Link>
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">{t("groupHint")}</p>
      )}
      {invalid ? <p className="text-xs text-destructive-ink">{t("invalid.group")}</p> : null}
    </div>
  );
}
