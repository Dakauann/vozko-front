"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import { Headset } from "@/components/icons";
import Button from "@/components/elevated-design/button";
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
import { createCallQueueAction, updateCallQueueAction } from "@/app/actions/call-routing";
import { listMembersAction } from "@/app/actions/workspace";
import { useWorkspace } from "@/contexts/workspace-context";
import { useToast } from "@/hooks/use-toast";
import { fetchDepartments } from "@/lib/department/client";
import type { Department } from "@/lib/department/types";
import {
  QUEUE_LIMITS,
  queueFormErrors,
  queueFormFrom,
  queuePayload,
  type MembersFrom,
  type QueueForm,
  type QueueFormError,
} from "@/lib/call-routing/form";
import { QUEUE_STRATEGIES, type CallQueue, type QueueStrategy } from "@/lib/call-routing/types";
import type { WorkspaceMember } from "@/lib/workspace/types";
import { cn } from "@/lib/utils";

import { HoldMusicPicker } from "./hold-music-picker";
import type { HoldMusicLibrary } from "./use-hold-music-library";

interface CallQueueSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  queue: CallQueue | null;
  library: HoldMusicLibrary;
  onSaved: () => void;
}

export function CallQueueSheet({ open, onOpenChange, queue, library, onSaved }: CallQueueSheetProps) {
  return (
    <ElevatedSheet open={open} onOpenChange={onOpenChange}>
      <ElevatedSheetContent side="right" className="w-full sm:max-w-[560px]">
        {open ? (
          <CallQueueForm key={queue?.id ?? "new"} queue={queue} library={library} onClose={() => onOpenChange(false)} onSaved={onSaved} />
        ) : null}
      </ElevatedSheetContent>
    </ElevatedSheet>
  );
}

function CallQueueForm({
  queue,
  library,
  onClose,
  onSaved,
}: {
  queue: CallQueue | null;
  library: HoldMusicLibrary;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("callQueues.form");
  const { toast } = useToast();
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id ?? "";
  const [form, setForm] = useState<QueueForm>(() => queueFormFrom(queue));
  const [invalid, setInvalid] = useState<QueueFormError[]>([]);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [search, setSearch] = useState("");
  const [saving, startSaving] = useTransition();

  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    void Promise.all([listMembersAction(workspaceId), fetchDepartments()]).then(([memberResult, departmentResult]) => {
      if (cancelled) return;
      setMembers(memberResult.members);
      setDepartments(departmentResult.departments);
    });
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  const visibleMembers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return members.filter((member) => !query || `${member.username} ${member.email}`.toLowerCase().includes(query));
  }, [members, search]);

  const update = <K extends keyof QueueForm>(field: K, value: QueueForm[K]) => setForm((current) => ({ ...current, [field]: value }));
  const errorFor = (field: QueueFormError) => (invalid.includes(field) ? t(`invalid.${field}`) : undefined);
  const toggleMember = (userId: string) =>
    update("memberUserIds", form.memberUserIds.includes(userId) ? form.memberUserIds.filter((id) => id !== userId) : [...form.memberUserIds, userId]);
  const numberField = (field: "ringSeconds" | "maxWaitSeconds" | "wrapUpSeconds", value: string) => update(field, value === "" ? Number.NaN : Number(value));

  const save = () => {
    const problems = queueFormErrors(form);
    setInvalid(problems);
    if (problems.length > 0) return;
    startSaving(async () => {
      const payload = queuePayload(form);
      const result = queue ? await updateCallQueueAction(queue.id, payload) : await createCallQueueAction(payload);
      if (result.error) {
        toast({ title: t("saveFailed"), description: result.error, variant: "destructive" });
        return;
      }
      toast({ title: queue ? t("updated") : t("created"), description: payload.name });
      onClose();
      onSaved();
    });
  };

  return (
    <>
      <ElevatedSheetHeader>
        <div className="flex items-start gap-3 pr-10">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[--radius] bg-muted text-primary-ink">
            <Headset className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <ElevatedSheetTitle>{queue ? t("editTitle") : t("createTitle")}</ElevatedSheetTitle>
            <ElevatedSheetDescription>{t("subtitle")}</ElevatedSheetDescription>
          </div>
        </div>
      </ElevatedSheetHeader>

      <div className="flex-1 space-y-5 overflow-y-auto px-6 pb-6">
        <ElevatedInput label={t("name")} maxLength={QUEUE_LIMITS.name} value={form.name} onChange={(e) => update("name", e.target.value)} error={errorFor("name")} />

        <div>
          <ElevatedSelect label={t("strategy")} value={form.strategy} onValueChange={(value) => update("strategy", value as QueueStrategy)}>
            {QUEUE_STRATEGIES.map((strategy) => (
              <ElevatedSelectItem key={strategy} value={strategy}>
                {t(`strategies.${strategy}.label`)}
              </ElevatedSelectItem>
            ))}
          </ElevatedSelect>
          <p className="mt-1.5 text-xs text-muted-foreground">{t(`strategies.${form.strategy}.hint`)}</p>
        </div>

        <fieldset className="space-y-2">
          <legend className="mb-1 text-xs font-semibold text-muted-foreground">{t("membersFrom")}</legend>
          <div role="tablist" aria-label={t("membersFrom")} className="grid grid-cols-2 rounded-[--radius] border border-border p-0.5">
            {(["people", "department"] as const satisfies readonly MembersFrom[]).map((option) => (
              <button
                key={option}
                type="button"
                role="tab"
                aria-selected={form.membersFrom === option}
                onClick={() => update("membersFrom", option)}
                className={cn(
                  "h-8 rounded-[calc(var(--radius)-2px)] text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  form.membersFrom === option ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t(`membersFromOptions.${option}`)}
              </button>
            ))}
          </div>

          {form.membersFrom === "department" ? (
            <div>
              <ElevatedSelect label={t("department")} value={form.departmentId} onValueChange={(value) => update("departmentId", value)}>
                {departments.map((department) => (
                  <ElevatedSelectItem key={department.id} value={department.id}>
                    {department.name}
                  </ElevatedSelectItem>
                ))}
              </ElevatedSelect>
              {invalid.includes("department") ? <p className="mt-1.5 text-xs text-destructive-ink">{t("invalid.department")}</p> : null}
            </div>
          ) : (
            <div className="space-y-2">
              <ElevatedInput label={t("searchMembers")} value={search} onChange={(e) => setSearch(e.target.value)} />
              <div role="group" aria-label={t("members")} className="max-h-56 space-y-1 overflow-y-auto">
                {visibleMembers.map((member) => {
                  const selected = form.memberUserIds.includes(member.userId);
                  return (
                    <button
                      key={member.userId}
                      type="button"
                      role="checkbox"
                      aria-checked={selected}
                      onClick={() => toggleMember(member.userId)}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 rounded-[--radius] border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        selected ? "border-primary bg-muted" : "border-border hover:bg-muted",
                      )}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-foreground">{member.username || member.email}</span>
                        {member.username && member.email ? <span className="block truncate text-2xs text-muted-foreground">{member.email}</span> : null}
                      </span>
                      <span aria-hidden className={cn("h-4 w-4 shrink-0 rounded-[3px] border", selected ? "border-primary bg-primary" : "border-control-edge")} />
                    </button>
                  );
                })}
              </div>
              <p className={cn("text-xs", invalid.includes("members") ? "text-destructive-ink" : "text-muted-foreground")}>
                {invalid.includes("members") ? t("invalid.members") : t("membersHint", { count: form.memberUserIds.length })}
              </p>
            </div>
          )}
          <p className="text-xs text-muted-foreground">{t("permissionHint")}</p>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-3">
          <ElevatedInput
            label={t("ringSeconds")}
            inputMode="numeric"
            value={Number.isNaN(form.ringSeconds) ? "" : String(form.ringSeconds)}
            onChange={(e) => numberField("ringSeconds", e.target.value)}
            error={errorFor("ringSeconds")}
          />
          <ElevatedInput
            label={t("maxWaitSeconds")}
            inputMode="numeric"
            value={Number.isNaN(form.maxWaitSeconds) ? "" : String(form.maxWaitSeconds)}
            onChange={(e) => numberField("maxWaitSeconds", e.target.value)}
            error={errorFor("maxWaitSeconds")}
          />
          <ElevatedInput
            label={t("wrapUpSeconds")}
            inputMode="numeric"
            value={Number.isNaN(form.wrapUpSeconds) ? "" : String(form.wrapUpSeconds)}
            onChange={(e) => numberField("wrapUpSeconds", e.target.value)}
            error={errorFor("wrapUpSeconds")}
          />
        </div>
        <p className="-mt-3 text-xs text-muted-foreground">{t("timingHint")}</p>

        <HoldMusicPicker value={form.holdMusic} onChange={(ref) => update("holdMusic", ref)} library={library} />
      </div>

      <ElevatedSheetFooter>
        <Button variant="ghost" title={t("cancel")} onClick={onClose} disabled={saving} />
        <Button variant="primary" title={saving ? t("saving") : t("save")} onClick={save} disabled={saving} />
      </ElevatedSheetFooter>
    </>
  );
}
