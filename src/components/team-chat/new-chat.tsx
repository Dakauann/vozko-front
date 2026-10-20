"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { isActionError } from "@/app/actions/action-result";
import { createGroupAction, openDirectAction } from "@/app/actions/team-chat";
import { ScreenLoader } from "@/components/brand/screen-loader";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { ArrowLeft, Check, MagnifyingGlass, UsersThree } from "@/components/icons";
import { rememberThread, useTeamChatAccess, useTeamChatMe, useTeamChatPeople, useTeamChatWorkspace } from "@/hooks/use-team-chat";
import { codedErrorMessage } from "@/lib/api/coded-error";
import { matchingMembers } from "@/lib/conversations/notes";
import { openTeamChat, showTeamChatList } from "@/lib/team-chat/panel";
import type { TeamChatPerson } from "@/lib/team-chat/types";
import { cn } from "@/lib/utils";

import { ICON_BUTTON, PersonAvatar } from "./team-chat-parts";

const PEOPLE_SHOWN = 200;

export function NewChat() {
  const t = useTranslations("teamChat");
  const me = useTeamChatMe();
  const access = useTeamChatAccess();
  const workspaceId = useTeamChatWorkspace();
  const client = useQueryClient();
  const people = useTeamChatPeople(true);
  const [query, setQuery] = useState("");
  const [grouping, setGrouping] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  const candidates = useMemo(
    () => (people.data ?? []).filter((p) => p.user_id !== me).map((p) => ({ ...p, userId: p.user_id })),
    [me, people.data],
  );
  const shown = matchingMembers(candidates, query, PEOPLE_SHOWN);

  const open = async (person: TeamChatPerson) => {
    setBusy(true);
    const result = await openDirectAction(person.user_id);
    setBusy(false);
    if (isActionError(result)) {
      toast.error(codedErrorMessage(t, result, t("newChat.failed")));
      return;
    }
    rememberThread(client, workspaceId, result.data);
    openTeamChat(result.data.id);
  };

  const create = async () => {
    setBusy(true);
    const result = await createGroupAction(title, picked);
    setBusy(false);
    if (isActionError(result)) {
      toast.error(codedErrorMessage(t, result, t("newChat.failed")));
      return;
    }
    rememberThread(client, workspaceId, result.data);
    openTeamChat(result.data.id);
  };

  const toggle = (id: string) => setPicked((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));

  return (
    <>
      <header className="flex items-center gap-1 border-b border-border py-2.5 pl-2 pr-4">
        <button type="button" onClick={showTeamChatList} aria-label={t("back")} title={t("back")} className={ICON_BUTTON}>
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{grouping ? t("newChat.groupTitle") : t("newChat.title")}</h2>
      </header>
      <div className="space-y-3 border-b border-border px-4 py-3">
        {grouping ? (
          <ElevatedInput id="team-chat-group-title" label={t("newChat.groupName")} value={title} maxLength={80} controlSize="sm" onChange={(event) => setTitle(event.target.value)} />
        ) : null}
        <ElevatedInput
          id="team-chat-search"
          type="search"
          label={t("newChat.search")}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          controlSize="sm"
          icon={<MagnifyingGlass className="h-4 w-4" weight="bold" />}
        />
        {access.create && !grouping ? (
          <button
            type="button"
            onClick={() => setGrouping(true)}
            className="flex w-full items-center gap-3 rounded-[--radius] px-1 py-1.5 text-left text-sm font-medium text-foreground transition-colors hover:bg-accent-hover"
          >
            <span aria-hidden className="tile-neutral flex h-8 w-8 items-center justify-center">
              <UsersThree className="h-4 w-4" />
            </span>
            {t("newChat.startGroup")}
          </button>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {people.isPending ? (
          <ScreenLoader fit="fill" className="min-h-40" />
        ) : shown.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs text-muted-foreground">{t("newChat.nobody")}</p>
        ) : (
          <ul>
            {shown.map((person) => {
              const selected = picked.includes(person.user_id);
              return (
                <li key={person.user_id}>
                  <button
                    type="button"
                    disabled={busy}
                    aria-pressed={grouping ? selected : undefined}
                    onClick={() => (grouping ? toggle(person.user_id) : void open(person))}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-accent-hover disabled:opacity-60"
                  >
                    <PersonAvatar name={person.name} picture={person.picture} />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{person.name}</span>
                    {grouping ? (
                      <span
                        aria-hidden
                        className={cn(
                          "flex h-5 w-5 items-center justify-center rounded-full border",
                          selected ? "border-primary bg-primary text-primary-foreground" : "border-border-strong",
                        )}
                      >
                        {selected ? <Check className="h-3 w-3" weight="bold" /> : null}
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {grouping ? (
        <footer className="flex items-center gap-2 border-t border-border px-4 py-3">
          <button
            type="button"
            onClick={() => {
              setGrouping(false);
              setPicked([]);
            }}
            className="rounded-[--radius] px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-accent-hover hover:text-foreground"
          >
            {t("cancel")}
          </button>
          <button
            type="button"
            disabled={busy || picked.length === 0 || title.trim() === ""}
            onClick={() => void create()}
            className="ml-auto rounded-[--radius] bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-opacity disabled:opacity-50"
          >
            {t("newChat.createGroup", { count: picked.length })}
          </button>
        </footer>
      ) : null}
    </>
  );
}
