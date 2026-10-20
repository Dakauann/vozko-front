"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { sendTeamChatTyping, subscribeTeamChat } from "@/lib/team-chat/bus";
import type { TeamChatParticipant } from "@/lib/team-chat/types";
import { TYPING_SIGNAL_MS, typersAfterMessage, typersAfterSignal, typersAt, type Typers } from "@/lib/team-chat/typing";

const PRUNE_MS = 1_000;

export function useTeamChatTyping(threadId: string | null, me: string, members: readonly TeamChatParticipant[]) {
  const [typers, setTypers] = useState<Typers>({});
  const [now, setNow] = useState(() => Date.now());
  const lastSentRef = useRef(0);

  useEffect(
    () =>
      subscribeTeamChat((event) => {
        if (event.payload.thread_id !== threadId) return;
        if (event.type === "team_chat:typing" && event.payload.user_id !== me) {
          const at = Date.now();
          setNow(at);
          setTypers((current) => typersAfterSignal(current, event.payload.user_id, at));
        }
        if (event.type === "team_chat:message") {
          setTypers((current) => typersAfterMessage(current, event.payload.message.author_id));
        }
      }),
    [me, threadId],
  );

  const typing = typersAt(typers, now);
  const anyone = typing.length > 0;

  useEffect(() => {
    if (!anyone) return;
    const timer = setInterval(() => setNow(Date.now()), PRUNE_MS);
    return () => clearInterval(timer);
  }, [anyone]);

  const names = useMemo(
    () => typing.map((id) => members.find((m) => m.user_id === id)?.name).filter((name): name is string => Boolean(name)),
    [members, typing],
  );

  const notifyTyping = useCallback(() => {
    if (!threadId) return;
    const at = Date.now();
    if (at - lastSentRef.current < TYPING_SIGNAL_MS) return;
    lastSentRef.current = at;
    sendTeamChatTyping(threadId);
  }, [threadId]);

  return { names, notifyTyping };
}
