"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";

import { getGroupMessagesAction } from "@/app/actions/unofficial-whatsapp-groups";
import { feedReducer, initialFeed } from "@/lib/unofficial-whatsapp-groups/group-feed";

export function useGroupFeed(groupId: string) {
  const [state, dispatch] = useReducer(feedReducer, initialFeed);
  const [generation, setGeneration] = useState(0);
  const generationRef = useRef(generation);
  const pagingRef = useRef(false);

  useEffect(() => {
    generationRef.current = generation;
    pagingRef.current = false;
    let active = true;
    getGroupMessagesAction(groupId).then((result) => {
      if (!active) return;
      if (result.error || !result.data) dispatch({ type: "latest-failed" });
      else dispatch({ type: "latest", page: result.data });
    });
    return () => {
      active = false;
    };
  }, [groupId, generation]);

  const refresh = useCallback(() => {
    dispatch({ type: "refresh" });
    setGeneration((current) => current + 1);
  }, []);

  const { phase, nextBefore, loadingOlder } = state;
  const loadOlder = useCallback(() => {
    if (phase !== "ready" || !nextBefore || loadingOlder || pagingRef.current) return;
    pagingRef.current = true;
    const startedIn = generationRef.current;
    dispatch({ type: "older-start" });
    getGroupMessagesAction(groupId, nextBefore).then((result) => {
      if (startedIn !== generationRef.current) return;
      pagingRef.current = false;
      if (result.error || !result.data) dispatch({ type: "older-failed" });
      else dispatch({ type: "older", page: result.data });
    });
  }, [groupId, phase, nextBefore, loadingOlder]);

  return { state, generation, refresh, loadOlder };
}

export type GroupFeed = ReturnType<typeof useGroupFeed>;
