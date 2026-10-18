"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import { createNotificationBroadcastAction } from "@/app/actions/admin-notifications";
import { isActionError } from "@/app/actions/action-result";
import { adminListAllWorkspacesAction, adminListWorkspaceMembersAction } from "@/app/actions/workspace";
import { SectionError } from "@/components/dashboard/attendance/primitives";
import Button from "@/components/elevated-design/button";
import {
  ElevatedDialog,
  ElevatedDialogContent,
  ElevatedDialogDescription,
  ElevatedDialogFooter,
  ElevatedDialogHeader,
  ElevatedDialogTitle,
} from "@/components/elevated-design/elevated-dialog";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { ElevatedPillToggle } from "@/components/elevated-design/elevated-pill-toggle";
import { ElevatedSelect, ElevatedSelectItem } from "@/components/elevated-design/elevated-select";
import ElevatedSwitch from "@/components/elevated-design/elevated-switch";
import ElevatedTextarea from "@/components/elevated-design/elevated-textarea";
import { ExplainerHint } from "@/components/explainers/ExplainerHint";
import { Buildings, User } from "@/components/icons";
import { NotificationItemView } from "@/components/notifications/notification-item";
import { Notice } from "@/components/ui/notice";
import { useBroadcastReach } from "@/hooks/use-notifications";
import { usePaginatedSelect } from "@/hooks/use-paginated-select";
import { isBusySectionError, sectionErrorCode } from "@/lib/analytics/section-query";
import { codedErrorMessage } from "@/lib/api/coded-error";
import {
  BROADCAST_AUDIENCES,
  BROADCAST_FORM_DEFAULTS,
  NOTIFICATION_LIMITS,
  broadcastPreviewItem,
  broadcastProblems,
  broadcastRequest,
  usersAudienceAvailable,
  type Broadcast,
  type BroadcastAudienceKind,
  type BroadcastForm,
  type BroadcastRequest,
  type NotificationProblemCode,
} from "@/lib/notifications/broadcast";
import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_SEVERITIES,
  type NotificationCategory,
  type NotificationSeverity,
} from "@/lib/notifications/types";
import type { Workspace, WorkspaceMember } from "@/lib/workspace/types";
import { cn } from "@/lib/utils";

import { MultiPickField, type PickedEntry } from "./multi-pick-field";
import { NotificationImageField } from "./notification-image-field";

const PICKER_PAGE_SIZE = 20;

type Fields = Omit<BroadcastForm, "workspaceIds" | "userIds">;

const FIELD_DEFAULTS: Fields = {
  allWorkspaces: BROADCAST_FORM_DEFAULTS.allWorkspaces,
  audience: BROADCAST_FORM_DEFAULTS.audience,
  category: BROADCAST_FORM_DEFAULTS.category,
  severity: BROADCAST_FORM_DEFAULTS.severity,
  title: BROADCAST_FORM_DEFAULTS.title,
  body: BROADCAST_FORM_DEFAULTS.body,
  imageUrl: BROADCAST_FORM_DEFAULTS.imageUrl,
  actionUrl: BROADCAST_FORM_DEFAULTS.actionUrl,
  actionLabel: BROADCAST_FORM_DEFAULTS.actionLabel,
  email: BROADCAST_FORM_DEFAULTS.email,
};

const PROBLEM_FIELD: Record<NotificationProblemCode, "target" | "audience" | "title" | "body" | "actionUrl" | "actionLabel" | "image"> = {
  notification_target_invalid: "target",
  notification_audience_invalid: "audience",
  notification_title_required: "title",
  notification_title_too_long: "title",
  notification_body_too_long: "body",
  notification_action_url_invalid: "actionUrl",
  notification_action_label_too_long: "actionLabel",
  notification_image_empty: "image",
  notification_image_too_large: "image",
  notification_image_type: "image",
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4 border-t border-border pt-5 first:border-t-0 first:pt-0">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {children}
    </section>
  );
}

function Counter({ value, max }: { value: string; max: number }) {
  const t = useTranslations("adminNotifications.compose");
  const count = [...value.trim()].length;
  return (
    <p className={cn("text-right text-2xs tabular-nums", count > max ? "text-destructive-ink" : "text-muted-foreground")}>
      {t("counter", { count, max })}
    </p>
  );
}

function FieldError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-xs text-destructive-ink">
      {message}
    </p>
  );
}

function ReachMessage({ request }: { request: BroadcastRequest | null }) {
  const t = useTranslations("adminNotifications.compose");
  const tNotifications = useTranslations("notifications");
  const { query, settling } = useBroadcastReach(request);

  if (request === null) return <p className="text-xs text-muted-foreground">{t("reachIncomplete")}</p>;

  if (!settling && query.isError && !query.data) {
    return (
      <SectionError
        busy={isBusySectionError(query.error)}
        retrying={query.isFetching}
        onRetry={() => void query.refetch()}
        message={codedErrorMessage(tNotifications, { code: sectionErrorCode(query.error) }, t("reachFailed"))}
      />
    );
  }

  if (settling || !query.data) return <p className="text-xs text-muted-foreground">{t("reachLoading")}</p>;

  const reach = query.data;
  if (reach.people === 0) return <p className="text-sm text-foreground">{t("reachNobody")}</p>;

  return (
    <p className="text-sm tabular-nums text-foreground">
      <span>{t("reachPeople", { people: reach.people, workspaces: reach.workspaces })}</span>
      {request.email ? (
        <>
          <span aria-hidden className="px-1.5 text-muted-foreground">
            ·
          </span>
          <span>{t("reachEmails", { emails: reach.emails })}</span>
        </>
      ) : null}
    </p>
  );
}

function useWorkspacePicker() {
  return usePaginatedSelect<Workspace>({
    fetchFn: useCallback(async (page: number, search: string) => {
      const result = await adminListAllWorkspacesAction({ page, pageSize: PICKER_PAGE_SIZE, search: search || undefined });
      return { items: result.workspaces, totalPages: result.meta.totalPages };
    }, []),
    mapOption: useCallback(
      (workspace: Workspace) => ({
        value: workspace.id,
        label: workspace.name,
        description: workspace.ownerEmail,
        icon: <Buildings className="h-4 w-4" />,
      }),
      [],
    ),
  });
}

function useMemberPicker(workspaceId: string | null) {
  return usePaginatedSelect<WorkspaceMember>({
    fetchFn: useCallback(
      async (page: number) => {
        if (!workspaceId) return { items: [], totalPages: 1 };
        const result = await adminListWorkspaceMembersAction({ workspaceId, page, pageSize: PICKER_PAGE_SIZE });
        return { items: result.members, totalPages: Math.max(1, Math.ceil(result.meta.total / PICKER_PAGE_SIZE)) };
      },
      [workspaceId],
    ),
    mapOption: useCallback(
      (member: WorkspaceMember) => ({
        value: member.userId,
        label: member.username || member.email,
        description: member.username ? member.email : undefined,
        keywords: [member.email],
        icon: <User className="h-4 w-4" />,
      }),
      [],
    ),
    enabled: workspaceId !== null,
  });
}

export function BroadcastComposeDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (broadcast: Broadcast) => void }) {
  const t = useTranslations("adminNotifications.compose");
  const tNotifications = useTranslations("notifications");
  const [fields, setFields] = useState<Fields>(FIELD_DEFAULTS);
  const [workspaces, setWorkspaces] = useState<PickedEntry[]>([]);
  const [members, setMembers] = useState<PickedEntry[]>([]);
  const [attempted, setAttempted] = useState(false);
  const [sending, setSending] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [previewAt] = useState(() => new Date());

  const form: BroadcastForm = useMemo(
    () => ({ ...fields, workspaceIds: workspaces.map((entry) => entry.id), userIds: members.map((entry) => entry.id) }),
    [fields, workspaces, members],
  );
  const problems = broadcastProblems(form);
  const request = broadcastRequest(form);
  const singleWorkspace = usersAudienceAvailable(form) ? form.workspaceIds[0] : null;
  const workspacePicker = useWorkspacePicker();
  const memberPicker = useMemberPicker(singleWorkspace);

  const set = <K extends keyof Fields>(key: K, value: Fields[K]) => setFields((current) => ({ ...current, [key]: value }));

  const problemFor = (field: (typeof PROBLEM_FIELD)[NotificationProblemCode]): string | null => {
    if (!attempted) return null;
    const problem = problems.find((code) => PROBLEM_FIELD[code] === field);
    return problem ? tNotifications(`errors.${problem}`) : null;
  };

  const changeWorkspaces = (next: PickedEntry[]) => {
    setWorkspaces(next);
    setMembers([]);
    if (next.length !== 1 && fields.audience === "users") set("audience", "everyone");
  };

  const changeTarget = (allWorkspaces: boolean) => {
    set("allWorkspaces", allWorkspaces);
    setMembers([]);
    if (allWorkspaces && fields.audience === "users") set("audience", "everyone");
  };

  const send = async () => {
    setAttempted(true);
    setRefusal(null);
    if (problems.length > 0) return;
    setSending(true);
    const result = await createNotificationBroadcastAction(request);
    setSending(false);
    if (isActionError(result)) {
      setRefusal(codedErrorMessage(tNotifications, result, t("failed")));
      return;
    }
    onCreated(result.data);
  };

  const audienceHint: Record<BroadcastAudienceKind, string> = {
    everyone: t("audienceEveryoneHint"),
    managers: t("audienceManagersHint"),
    users: t("audienceUsersHint"),
  };
  const audienceLabels: Record<BroadcastAudienceKind, string> = {
    everyone: t("audienceEveryone"),
    managers: t("audienceManagers"),
    users: t("audienceUsers"),
  };
  const usersLocked = !usersAudienceAvailable(form);

  return (
    <ElevatedDialog open onOpenChange={(open) => !open && !sending && onClose()}>
      <ElevatedDialogContent className="flex w-[calc(100vw-1rem)] max-w-5xl flex-col gap-0 overflow-hidden !p-0">
        <ElevatedDialogHeader className="border-b border-border py-4 pl-5 pr-16">
          <ElevatedDialogTitle>{t("title")}</ElevatedDialogTitle>
          <ElevatedDialogDescription className="sr-only">{t("title")}</ElevatedDialogDescription>
        </ElevatedDialogHeader>

        <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_24rem] lg:overflow-hidden">
          <div className="space-y-5 p-5 lg:overflow-y-auto">
            <Section title={t("destination")}>
              <ElevatedPillToggle
                size="md"
                aria-label={t("destination")}
                value={fields.allWorkspaces ? "all" : "pick"}
                onChange={(value) => changeTarget(value === "all")}
                options={[
                  { value: "pick", label: t("targetPick") },
                  { value: "all", label: t("targetAll") },
                ]}
              />
              {!fields.allWorkspaces ? (
                <MultiPickField
                  label={t("workspaceAdd")}
                  searchPlaceholder={t("workspaceSearch")}
                  emptyMessage={t("workspaceEmpty")}
                  options={workspacePicker.options}
                  isLoading={workspacePicker.isLoading}
                  onSearch={workspacePicker.onSearch}
                  onScrollEnd={workspacePicker.onScrollEnd}
                  onOpenChange={workspacePicker.onOpenChange}
                  picked={workspaces}
                  onPick={(entry) => changeWorkspaces([...workspaces, entry])}
                  onRemove={(id) => changeWorkspaces(workspaces.filter((entry) => entry.id !== id))}
                  removeLabel={(name) => t("workspaceRemove", { name })}
                />
              ) : null}
              <FieldError message={problemFor("target")} />

              <div className="space-y-2">
                <p className="legend">{t("audience")}</p>
                <ElevatedPillToggle
                  size="md"
                  aria-label={t("audience")}
                  value={fields.audience}
                  onChange={(audience) => set("audience", audience)}
                  options={BROADCAST_AUDIENCES.map((audience) => ({
                    value: audience,
                    label: audienceLabels[audience],
                    disabled: audience === "users" && usersLocked,
                  }))}
                />
                <p className="text-xs text-muted-foreground">{fields.audience === "users" || !usersLocked ? audienceHint[fields.audience] : t("audienceUsersLocked")}</p>
              </div>
              {fields.audience === "users" && singleWorkspace ? (
                <MultiPickField
                  key={singleWorkspace}
                  label={t("memberAdd")}
                  searchPlaceholder={t("memberSearch")}
                  emptyMessage={t("memberEmpty")}
                  options={memberPicker.options}
                  isLoading={memberPicker.isLoading}
                  onScrollEnd={memberPicker.onScrollEnd}
                  onOpenChange={memberPicker.onOpenChange}
                  picked={members}
                  onPick={(entry) => setMembers([...members, entry])}
                  onRemove={(id) => setMembers(members.filter((entry) => entry.id !== id))}
                  removeLabel={(name) => t("memberRemove", { name })}
                />
              ) : null}
              <FieldError message={problemFor("audience")} />
            </Section>

            <Section title={t("content")}>
              <div className="grid gap-3 sm:grid-cols-2">
                <ElevatedSelect label={t("category")} value={fields.category} onValueChange={(value) => set("category", value as NotificationCategory)}>
                  {NOTIFICATION_CATEGORIES.map((category) => (
                    <ElevatedSelectItem key={category} value={category}>
                      {tNotifications(`categories.${category}`)}
                    </ElevatedSelectItem>
                  ))}
                </ElevatedSelect>
                <ElevatedSelect label={t("severity")} value={fields.severity} onValueChange={(value) => set("severity", value as NotificationSeverity)}>
                  {NOTIFICATION_SEVERITIES.map((severity) => (
                    <ElevatedSelectItem key={severity} value={severity}>
                      {tNotifications(`severity.${severity}`)}
                    </ElevatedSelectItem>
                  ))}
                </ElevatedSelect>
              </div>

              <div className="space-y-1">
                <ElevatedInput label={t("titleField")} value={fields.title} onChange={(event) => set("title", event.target.value)} error={problemFor("title") ?? undefined} />
                <Counter value={fields.title} max={NOTIFICATION_LIMITS.title} />
              </div>

              <div className="space-y-1">
                <ElevatedTextarea
                  label={t("bodyField")}
                  value={fields.body}
                  rows={4}
                  onChange={(event) => set("body", event.target.value)}
                  error={problemFor("body") ?? undefined}
                />
                <Counter value={fields.body} max={NOTIFICATION_LIMITS.body} />
              </div>

              <div className="space-y-1.5">
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_14rem]">
                  <ElevatedInput
                    label={t("actionUrl")}
                    value={fields.actionUrl}
                    inputMode="url"
                    onChange={(event) => set("actionUrl", event.target.value)}
                    error={problemFor("actionUrl") ?? undefined}
                  />
                  <ElevatedInput
                    label={t("actionLabel")}
                    value={fields.actionLabel}
                    onChange={(event) => set("actionLabel", event.target.value)}
                    error={problemFor("actionLabel") ?? undefined}
                  />
                </div>
                <p className="text-xs text-muted-foreground">{t("actionUrlHint")}</p>
              </div>

              <NotificationImageField url={fields.imageUrl} onChange={(url) => set("imageUrl", url)} />
            </Section>

            <Section title={t("delivery")}>
              <ElevatedSwitch
                label={t("email")}
                description={t("emailHint")}
                checked={fields.email}
                onCheckedChange={(email) => set("email", email)}
                explainer={<ExplainerHint id="settings.notificationEmail" />}
              />
            </Section>
          </div>

          <section aria-label={t("preview")} className="border-t border-border bg-background p-5 lg:overflow-y-auto lg:border-l lg:border-t-0">
            <p className="legend mb-3">{t("preview")}</p>
            <div className="overflow-hidden rounded-lg border border-border-strong bg-popover shadow-sm">
              <NotificationItemView
                item={broadcastPreviewItem({ ...form, title: form.title.trim() ? form.title : t("previewTitle") }, previewAt.toISOString())}
                now={previewAt}
                preview
              />
            </div>
            <section aria-label={t("reach")} className="mt-5 space-y-2">
              <p className="legend">{t("reach")}</p>
              <div aria-live="polite">
                <ReachMessage request={problems.length === 0 ? request : null} />
              </div>
            </section>
          </section>
        </div>

        <ElevatedDialogFooter className="flex-col items-stretch gap-3 border-t border-border px-5 py-3 sm:flex-row sm:items-center sm:justify-end">
          {refusal ? (
            <Notice tone="fault" className="sm:mr-auto sm:max-w-md">
              <p>{refusal}</p>
            </Notice>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button title={t("cancel")} variant="ghost" disabled={sending} onClick={onClose} />
            <Button title={sending ? t("sending") : t("send")} variant="primary" disabled={sending} onClick={() => void send()} />
          </div>
        </ElevatedDialogFooter>
      </ElevatedDialogContent>
    </ElevatedDialog>
  );
}
