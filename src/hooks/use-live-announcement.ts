"use client";

import { useEffect, useRef, useState } from "react";

import {
  idleAnnouncer,
  planAnnouncement,
  type Announcement,
  type AnnouncerState,
} from "@/lib/conversations/live-announcement";
import type { ConversationMessage } from "@/lib/conversations/types";

export function useLiveAnnouncement(
  threadKey: string | null,
  arrived: readonly ConversationMessage[],
  describe: (announcement: Announcement) => string,
): string {
  const [text, setText] = useState("");
  const announcerRef = useRef<AnnouncerState>(idleAnnouncer);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const describeRef = useRef(describe);

  useEffect(() => {
    describeRef.current = describe;
  }, [describe]);

  useEffect(() => {
    announcerRef.current = idleAnnouncer;
    return () => {
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    };
  }, [threadKey]);

  useEffect(() => {
    if (arrived.length === 0) return;

    const step = (incoming: readonly ConversationMessage[]) => {
      const plan = planAnnouncement(announcerRef.current, incoming, Date.now());
      announcerRef.current = plan.state;
      if (plan.announce) setText(describeRef.current(plan.announce));
      if (plan.flushAt !== null && flushTimerRef.current === null) {
        flushTimerRef.current = setTimeout(() => {
          flushTimerRef.current = null;
          step([]);
        }, Math.max(0, plan.flushAt - Date.now()));
      }
    };

    const timer = setTimeout(() => step(arrived), 0);
    return () => clearTimeout(timer);
  }, [arrived]);

  return text;
}
