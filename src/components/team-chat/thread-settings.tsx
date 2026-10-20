"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { isActionError, type ActionError } from "@/app/actions/action-result";
import { addGroupMembersAction, leaveGroupAction, muteThreadAction, removeGroupMemberAction, renameGroupAction } from "@/app/actions/team-chat";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import ElevatedSwitch from "@/components/elevated-design/elevated-switch";
import { StatusChip } from "@/components/elevated-design/status-chip";
import { ExplainerHint } from "@/components/explainers/ExplainerHint";
import { ArrowLeft, SignOut, UserPlus, X } from "@/components/icons";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { rememberThread, useTeamChatAccess, useTeamChatPeople, useTeamChatWorkspace } from "@/hooks/use-team-chat";
import { codedErrorMessage } from "@/lib/api/coded-error";
import { showTeamChatList } from "@/lib/team-chat/panel";
import type { TeamChatThread } from "@/lib/team-chat/types";

import { ICON_BUTTON, PersonAvatar } from "./team-chat-parts";

function useReport() {
  const t = useTranslations("teamChat");
  return (error: ActionError | null, fallback: string): boolean => {
    if (error) toast.error(codedErrorMessage(t, error, fallback));
    return error === null;
  };
}

export function ThreadSettings({ thread, me, onBack }: { thread: TeamChatThread; me: string; onBack: () => void }) {
  const t = useTranslations("teamChat");
  const access = useTeamChatAccess();
  const client = useQueryClient();
  const workspaceId = useTeamChatWorkspace();
  const report = useReport();
  const admin = thread.kind === "group" && thread.me.role === "admin" && access.send;
  const [title, setTitle] = useState(thread.title);
  const [adding, setAdding] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const people = useTeamChatPeople(adding);
  const outside = (people.data ?? []).filter((p) => !thread.members.some((m) => m.user_id === p.user_id));

  const settle = (result: Awaited<ReturnType<typeof renameGroupAction>>, fallback: string) => {
    if (isActionError(result)) return report(result, fallback);
    rememberThread(client, workspaceId, result.data);
    return true;
  };

  const mute = async (muted: boolean) => {
    const result = await muteThreadAction(thread.id, muted);
    if (isActionError(result)) report(result, t("settings.failed"));
    else rememberThread(client, workspaceId, { ...thread, me: { ...thread.me, muted } });
  };

  return (
    <>
      <header className="flex items-center gap-1 border-b border-border py-2.5 pl-2 pr-4">
        <button type="button" onClick={onBack} aria-label={t("back")} title={t("back")} className={ICON_BUTTON}>
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{t("settings.title")}</h2>
      </header>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-3">
        <ElevatedSwitch
          label={t("settings.mute")}
          description={t("settings.muteHint")}
          checked={thread.me.muted}
          onCheckedChange={(muted: boolean) => void mute(muted)}
          explainer={<ExplainerHint id="settings.teamChatMute" align="end" />}
        />

        {admin ? (
          <form
            className="flex items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void renameGroupAction(thread.id, title).then((result) => settle(result, t("settings.failed")));
            }}
          >
            <div className="min-w-0 flex-1">
              <ElevatedInput id="team-chat-rename" label={t("settings.name")} value={title} maxLength={80} onChange={(event) => setTitle(event.target.value)} />
            </div>
            <button
              type="submit"
              disabled={title.trim() === "" || title.trim() === thread.title}
              className="h-9 rounded-[--radius] bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-50"
            >
              {t("settings.save")}
            </button>
          </form>
        ) : null}

        {thread.kind === "group" ? (
          <section aria-label={t("settings.members", { count: thread.members.length })}>
            <div className="flex items-center justify-between">
              <p className="legend">{t("settings.members", { count: thread.members.length })}</p>
              {admin ? (
                <button type="button" onClick={() => setAdding((on) => !on)} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                  <UserPlus className="h-3.5 w-3.5" />
                  {t("settings.add")}
                </button>
              ) : null}
            </div>
            {adding ? (
              <ul className="mt-2 max-h-40 overflow-y-auto rounded-[--radius] border border-border">
                {outside.length === 0 ? <li className="px-3 py-2 text-2xs text-muted-foreground">{t("settings.everyoneIn")}</li> : null}
                {outside.map((person) => (
                  <li key={person.user_id}>
                    <button
                      type="button"
                      onClick={() => void addGroupMembersAction(thread.id, [person.user_id]).then((result) => settle(result, t("settings.failed")))}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent-hover"
                    >
                      <PersonAvatar name={person.name} picture={person.picture} className="h-6 w-6" />
                      <span className="truncate">{person.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <ul className="mt-2 space-y-1">
              {thread.members.map((member) => (
                <li key={member.user_id} className="flex items-center gap-2 py-1">
                  <PersonAvatar name={member.name} picture={member.picture} className="h-7 w-7" />
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground">{member.user_id === me ? t("settings.you", { name: member.name }) : member.name}</span>
                  {member.role === "admin" ? <StatusChip tone="outline" label={t("settings.admin")} /> : null}
                  {admin && member.user_id !== me ? (
                    <button
                      type="button"
                      aria-label={t("settings.remove", { name: member.name })}
                      title={t("settings.remove", { name: member.name })}
                      onClick={() =>
                        void removeGroupMemberAction(thread.id, member.user_id).then((result) =>
                          report(isActionError(result) ? result : null, t("settings.failed")),
                        )
                      }
                      className="rounded p-1 text-muted-foreground hover:bg-accent-hover hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {thread.kind === "group" ? (
          <ConfirmDialog
            open={leaving}
            onOpenChange={setLeaving}
            title={t("settings.leaveTitle")}
            description={t("settings.leaveDescription")}
            confirmLabel={t("settings.leave")}
            onConfirm={async () => {
              const result = await leaveGroupAction(thread.id);
              if (report(isActionError(result) ? result : null, t("settings.failed"))) showTeamChatList();
            }}
            trigger={
              <button type="button" className="inline-flex items-center gap-2 text-xs font-semibold text-destructive hover:underline">
                <SignOut className="h-3.5 w-3.5" />
                {t("settings.leave")}
              </button>
            }
          />
        ) : null}
      </div>
    </>
  );
}
