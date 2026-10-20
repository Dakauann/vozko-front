"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  markOf,
  markRefusalKey,
  pinnedMark,
  unreadMark,
  withoutUnreadMark,
  type MarkedEntry,
  type PersonalMarks,
} from "@/lib/conversations/personal-marks";
import {
  EMPTY_PERSONAL_MARKS_STATE,
  beginMarkChange,
  receiveMark,
  receivePage,
  refuseMarkChange,
  type PersonalMarksState,
} from "@/lib/conversations/personal-marks-state";
import type { PersonalMark, WsServerEvent } from "@/lib/conversations/types";

type Send = (type: string, payload: Record<string, unknown>) => boolean;

export interface PersonalMarkCommands {
  marks: PersonalMarks;
  pin: (entry: MarkedEntry, pinned: boolean) => boolean;
  markUnread: (entry: MarkedEntry) => boolean;
  clearUnreadMark: (entry: MarkedEntry) => boolean;
}

export interface PersonalInboxControls extends PersonalMarkCommands {
  clearUnread: (entries: readonly MarkedEntry[]) => void;
}

interface PersonalMarksDeps {
  send: Send;
}

export function usePersonalMarks(deps: PersonalMarksDeps): {
  commands: PersonalMarkCommands;
  observe: (event: WsServerEvent) => boolean;
} {
  const t = useTranslations("crmInbox.personal");
  const [state, setState] = useState<PersonalMarksState>(EMPTY_PERSONAL_MARKS_STATE);
  const stateRef = useRef(state);
  const depsRef = useRef(deps);
  useEffect(() => {
    depsRef.current = deps;
  });

  const commit = useCallback((next: PersonalMarksState) => {
    if (next === stateRef.current) return;
    stateRef.current = next;
    setState(next);
  }, []);

  const command = useCallback(
    (type: string, entry: MarkedEntry, next: PersonalMark | null, extra: Record<string, unknown> = {}): boolean => {
      const requestId = crypto.randomUUID();
      if (!depsRef.current.send(type, { entry_id: entry.entry_id, entry_type: entry.entry_type, request_id: requestId, ...extra })) {
        toast.error(t("errors.connection"));
        return false;
      }
      commit(beginMarkChange(stateRef.current, requestId, entry, next));
      return true;
    },
    [commit, t],
  );

  const pin = useCallback(
    (entry: MarkedEntry, pinned: boolean) =>
      command("pin_conversation", entry, pinnedMark(markOf(stateRef.current.marks, entry), pinned, new Date().toISOString()), { pinned }),
    [command],
  );

  const markUnread = useCallback(
    (entry: MarkedEntry) =>
      command("mark_unread", entry, unreadMark(markOf(stateRef.current.marks, entry), new Date().toISOString())),
    [command],
  );

  const clearUnreadMark = useCallback(
    (entry: MarkedEntry) => command("clear_unread_mark", entry, withoutUnreadMark(markOf(stateRef.current.marks, entry))),
    [command],
  );

  const observe = useCallback(
    (event: WsServerEvent): boolean => {
      switch (event.type) {
        case "conversation:inbox":
        case "conversation:search_results":
          commit(receivePage(stateRef.current, event.payload.entries ?? [], event.payload.personal_marks));
          return false;
        case "conversation:personal_mark":
          commit(receiveMark(stateRef.current, event.payload));
          return true;
        case "conversation:error": {
          const { state: next, owned } = refuseMarkChange(stateRef.current, event.payload.request_id);
          if (!owned) return false;
          commit(next);
          toast.error(t(`errors.${markRefusalKey(event.payload.code)}`));
          return true;
        }
        default:
          return false;
      }
    },
    [commit, t],
  );

  const commands = useMemo<PersonalMarkCommands>(
    () => ({ marks: state.marks, pin, markUnread, clearUnreadMark }),
    [state.marks, pin, markUnread, clearUnreadMark],
  );

  return { commands, observe };
}
