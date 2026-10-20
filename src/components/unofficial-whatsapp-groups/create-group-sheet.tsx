"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { createWorkspaceGroupAction } from "@/app/actions/unofficial-whatsapp-groups";
import Button from "@/components/elevated-design/button";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import {
  ElevatedSheet,
  ElevatedSheetContent,
  ElevatedSheetDescription,
  ElevatedSheetFooter,
  ElevatedSheetHeader,
  ElevatedSheetTitle,
} from "@/components/elevated-design/elevated-sheet";
import { ElevatedSwitch } from "@/components/elevated-design/elevated-switch";
import ElevatedTextarea from "@/components/elevated-design/elevated-textarea";
import { CircleNotch, Plus } from "@/components/icons";
import { Notice } from "@/components/ui/notice";
import { groupErrorKey } from "@/lib/unofficial-whatsapp-groups/group-errors";
import { type ManagedGroupResult, type WorkspaceGroup } from "@/lib/unofficial-whatsapp-groups/types";

import { CategoryField } from "./kit/category-field";
import { GroupIdentity } from "./kit/identity";
import { SetupWarningsNotice } from "./kit/notices";
import {
  GROUP_DESCRIPTION_MAX_CHARS,
  GROUP_NAME_MAX_CHARS,
  createGroupIssues,
  createGroupPayload,
  hasIssues,
  numberRole,
  type CreateGroupForm as CreateGroupFields,
} from "./list/create-group-form";
import { NumberPicker, NumberPickerSkeleton } from "./number-picker";
import { useWorkspaceNumbers } from "./use-workspace-numbers";

const NUMBERS_ERROR_ID = "create-group-numbers-error";

interface CreateGroupSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (group: WorkspaceGroup) => void;
  onAttempted?: () => void;
}

export function CreateGroupSheet({ open, onOpenChange, onCreated, onAttempted }: CreateGroupSheetProps) {
  return (
    <ElevatedSheet open={open} onOpenChange={onOpenChange}>
      <ElevatedSheetContent side="right" className="w-full sm:max-w-[560px]">
        {open ? <CreateGroupBody onClose={() => onOpenChange(false)} onCreated={onCreated} onAttempted={onAttempted} /> : null}
      </ElevatedSheetContent>
    </ElevatedSheet>
  );
}

function CreateGroupBody({
  onClose,
  onCreated,
  onAttempted,
}: {
  onClose: () => void;
  onCreated?: (group: WorkspaceGroup) => void;
  onAttempted?: () => void;
}) {
  const [result, setResult] = useState<ManagedGroupResult | null>(null);
  if (result) {
    return (
      <CreateGroupResult
        result={result}
        onClose={onClose}
        onOpen={() => {
          onClose();
          onCreated?.(result.group);
        }}
      />
    );
  }
  return (
    <CreateGroupForm
      onClose={onClose}
      onAttempted={onAttempted}
      onDone={(done) => {
        if (done.warnings.length > 0) {
          setResult(done);
          return;
        }
        onClose();
        onCreated?.(done.group);
      }}
    />
  );
}

function SheetHead({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <ElevatedSheetHeader>
      <div className="flex items-start gap-3 pr-10">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[--radius] bg-muted text-primary-ink">
          <Plus className="h-5 w-5" weight="bold" />
        </span>
        <div className="min-w-0">
          <ElevatedSheetTitle>{title}</ElevatedSheetTitle>
          <ElevatedSheetDescription>{subtitle}</ElevatedSheetDescription>
        </div>
      </div>
    </ElevatedSheetHeader>
  );
}

function CreateGroupResult({ result, onClose, onOpen }: { result: ManagedGroupResult; onClose: () => void; onOpen: () => void }) {
  const t = useTranslations("unofficialGroups.create");
  return (
    <>
      <SheetHead title={t("created")} subtitle={t("resultHint")} />
      <div className="flex-1 space-y-4 overflow-y-auto px-6 pb-6">
        <div className="rounded-[--radius] border border-border p-3">
          <GroupIdentity group={result.group} size="md" sub="full" />
        </div>
        <SetupWarningsNotice warnings={result.warnings} groupId={result.group.id} />
      </div>
      <ElevatedSheetFooter className="flex-row justify-end border-t border-border">
        <Button variant="secondary" title={t("close")} onClick={onClose} />
        <Button variant="primary" title={t("openGroup")} onClick={onOpen} />
      </ElevatedSheetFooter>
    </>
  );
}

function CreateGroupForm({
  onClose,
  onAttempted,
  onDone,
}: {
  onClose: () => void;
  onAttempted?: () => void;
  onDone: (result: ManagedGroupResult) => void;
}) {
  const t = useTranslations("unofficialGroups.create");
  const tErrors = useTranslations("unofficialGroups.list.errors");
  const { numbers, loading: numbersLoading, error: numbersError } = useWorkspaceNumbers();

  const [fields, setFields] = useState<CreateGroupFields>({
    name: "",
    description: "",
    category: "",
    instanceIds: [],
    adminsOnly: false,
    follow: true,
  });
  const [showInvalid, setShowInvalid] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, startSubmitting] = useTransition();

  const update = <K extends keyof CreateGroupFields>(key: K, value: CreateGroupFields[K]) => setFields((current) => ({ ...current, [key]: value }));

  const issues = useMemo(() => createGroupIssues(fields), [fields]);

  const options = useMemo(
    () =>
      numbers.map((number) => {
        const role = numberRole(fields.instanceIds, number.id);
        return {
          number,
          disabled: !number.sessionLive,
          note: !number.sessionLive ? t("offline") : role === "creator" ? t("creator") : role === "admin" ? t("joinsAsAdmin") : undefined,
        };
      }),
    [numbers, fields.instanceIds, t],
  );

  const toggle = (id: string) =>
    update("instanceIds", fields.instanceIds.includes(id) ? fields.instanceIds.filter((item) => item !== id) : [...fields.instanceIds, id]);

  const nameIssue = issues.name === "required" ? t("invalid.name") : undefined;
  const numbersIssue = showInvalid && issues.numbers ? t("invalid.numbers") : undefined;

  const submit = () => {
    if (hasIssues(issues)) {
      setShowInvalid(true);
      return;
    }
    setSubmitError(null);
    startSubmitting(async () => {
      const created = await createWorkspaceGroupAction(createGroupPayload(fields));
      onAttempted?.();
      if (created.error || !created.data) {
        const key = groupErrorKey(created.error);
        const message = key ? tErrors(key) : tErrors("createFailed");
        setSubmitError(message);
        toast.error(t("failed"), { description: message });
        return;
      }
      const { group, warnings } = created.data;
      if (warnings.length === 0) toast(t("created"), { description: group.subject });
      onDone(created.data);
    });
  };

  return (
    <>
      <SheetHead title={t("title")} subtitle={t("subtitle")} />

      <div className="flex-1 space-y-5 overflow-y-auto px-6 pb-6">
        <div className="space-y-1">
          <ElevatedInput
            label={t("name")}
            placeholder=" "
            value={fields.name}
            maxLength={GROUP_NAME_MAX_CHARS}
            onChange={(event) => update("name", event.target.value)}
            error={showInvalid ? nameIssue : undefined}
            autoFocus
          />
          <p className="readout text-right text-2xs text-muted-foreground">{t("chars", { used: fields.name.length, max: GROUP_NAME_MAX_CHARS })}</p>
        </div>

        <div className="space-y-1">
          <ElevatedTextarea
            label={t("description")}
            placeholder=" "
            value={fields.description}
            maxLength={GROUP_DESCRIPTION_MAX_CHARS}
            onChange={(event) => update("description", event.target.value)}
            autoResize
            maxHeight={200}
          />
          <p className="readout text-right text-2xs text-muted-foreground">{t("chars", { used: fields.description.length, max: GROUP_DESCRIPTION_MAX_CHARS })}</p>
        </div>

        <CategoryField
          label={t("category")}
          suggestionsLabel={t("categorySuggestions")}
          value={fields.category}
          onChange={(category) => update("category", category)}
        />

        <fieldset className="space-y-2">
          <legend className="mb-1 text-xs font-semibold text-muted-foreground">{t("numbers")}</legend>
          <p className="text-2xs text-muted-foreground">{t("numbersHint")}</p>
          {numbersError ? <Notice tone="fault">{numbersError}</Notice> : null}
          {!numbersLoading && numbers.length === 0 && !numbersError ? <Notice tone="warning">{t("noNumbers")}</Notice> : null}
          {numbersLoading ? (
            <NumberPickerSkeleton />
          ) : (
            <NumberPicker
              label={t("numbers")}
              options={options}
              selected={fields.instanceIds}
              onToggle={toggle}
              ordered
              describedBy={numbersIssue ? NUMBERS_ERROR_ID : undefined}
            />
          )}
          {numbersIssue ? (
            <p id={NUMBERS_ERROR_ID} className="text-2xs text-destructive-ink">
              {numbersIssue}
            </p>
          ) : null}
        </fieldset>

        <div className="space-y-3">
          <ElevatedSwitch checked={fields.adminsOnly} onCheckedChange={(value) => update("adminsOnly", value)} label={t("adminsOnly")} description={t("adminsOnlyHint")} />
          <ElevatedSwitch checked={fields.follow} onCheckedChange={(value) => update("follow", value)} label={t("follow")} description={t("followHint")} />
        </div>

        {submitError ? (
          <Notice tone="fault" title={t("failed")}>
            {submitError}
          </Notice>
        ) : null}
      </div>

      <ElevatedSheetFooter className="flex-row justify-end border-t border-border">
        <Button variant="secondary" title={t("cancel")} onClick={onClose} />
        <Button
          variant="primary"
          title={t("submit")}
          disabled={submitting}
          onClick={submit}
          icon={submitting ? <CircleNotch className="h-4 w-4 animate-spin" weight="bold" /> : undefined}
          iconVisible={submitting}
        />
      </ElevatedSheetFooter>
    </>
  );
}
