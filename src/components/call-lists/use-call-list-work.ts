"use client";

import { useCallback, useEffect, useState } from "react";
import { useNow } from "next-intl";

import { closeCallListItemAction, listCallListItemsAction, nextCallListItemAction, releaseCallListItemAction } from "@/app/actions/call-lists";
import { useCallSession } from "@/contexts/call-session-context";
import { useCallListCache } from "@/hooks/use-call-lists";
import type { CodedError } from "@/lib/api/coded-error";
import type { CallListClosing, CallListItem, CallListNext } from "@/lib/call-lists/types";
import { dialItem, followItemCall, heldItem, ownsCall, restorePlan, workStage, type ItemDial } from "@/lib/call-lists/work";
import { isCallLive } from "@/lib/call-session/call-readiness";

const HELD_SCAN_LIMIT = 200;
const CLOCK_MS = 30_000;

export interface WorkCard {
  item: CallListItem;
  lead: CallListNext["lead"] | null;
  lastInteraction: CallListNext["lastInteraction"] | null;
  trunks: CallListNext["trunks"];
  trunkRefusal: CallListNext["trunkRefusal"];
}

export interface QueueNotice {
  refused: number;
  more: boolean;
  empty: boolean;
}

type Busy = "next" | "close" | "release" | "restore";

function cardOf(next: CallListNext): WorkCard | null {
  if (!next.item) return null;
  return {
    item: next.item,
    lead: next.lead ?? null,
    lastInteraction: next.lastInteraction ?? null,
    trunks: next.trunks,
    trunkRefusal: next.trunkRefusal,
  };
}

function restoredCard(item: CallListItem): WorkCard {
  return { item, lead: null, lastInteraction: null, trunks: [], trunkRefusal: undefined };
}

export function useCallListWork({ listId, userId, serving }: { listId: string; userId: string; serving: boolean }) {
  const { callState, lastErrorCode } = useCallSession();
  const now = useNow({ updateInterval: CLOCK_MS });
  const { store, refreshItems } = useCallListCache();
  const [card, setCard] = useState<WorkCard | null>(null);
  const [notice, setNotice] = useState<QueueNotice | null>(null);
  const [failure, setFailure] = useState<CodedError | null>(null);
  const [busy, setBusy] = useState<Busy | null>("restore");
  const [itemDial, setItemDial] = useState<ItemDial | null>(null);
  const [servingAtOpen] = useState(serving);

  const item = card?.item ?? null;
  const known = item && itemDial?.itemId === item.id ? itemDial : null;
  const followed = known ? followItemCall(known, callState, lastErrorCode) : null;
  if (followed !== itemDial) setItemDial(followed);

  const adopt = useCallback(
    (next: CallListNext) => {
      store(next.list);
      const nextCard = cardOf(next);
      setItemDial((current) => (nextCard && current?.itemId === nextCard.item.id ? current : null));
      setCard(nextCard);
      setNotice({ refused: next.refused, more: next.more, empty: nextCard === null });
    },
    [store],
  );

  const claim = useCallback(async () => {
    setBusy("next");
    setFailure(null);
    const answer = await nextCallListItemAction(listId);
    setBusy(null);
    if (answer.error) {
      setFailure(answer.error);
      return;
    }
    adopt(answer.data);
    refreshItems(listId);
  }, [listId, adopt, refreshItems]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void listCallListItemsAction(listId, { state: "reserved", limit: HELD_SCAN_LIMIT }).then(async (answer) => {
      if (cancelled) return;
      if (answer.error) {
        setBusy(null);
        setFailure(answer.error);
        return;
      }
      const held = heldItem(answer.data.items, userId);
      const plan = restorePlan({ held, userId, now: new Date(), serving: servingAtOpen });
      if (plan === "next") {
        const next = await nextCallListItemAction(listId);
        if (cancelled) return;
        setBusy(null);
        if (next.error) setFailure(next.error);
        else adopt(next.data);
        return;
      }
      setBusy(null);
      if (plan === "card" && held) {
        setItemDial(null);
        setCard(restoredCard(held));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [listId, userId, servingAtOpen, adopt]);

  const startDial = useCallback((target: CallListItem): string => {
    const requestId = crypto.randomUUID();
    setItemDial(dialItem(target, requestId));
    setFailure(null);
    return requestId;
  }, []);

  const close = useCallback(
    async (closing: CallListClosing): Promise<boolean> => {
      if (!item) return false;
      setBusy("close");
      setFailure(null);
      const answer = await closeCallListItemAction(item.id, closing);
      if (answer.error) {
        setBusy(null);
        setFailure(answer.error);
        return false;
      }
      setItemDial(null);
      setCard(null);
      if (serving) {
        await claim();
        return true;
      }
      setBusy(null);
      setNotice(null);
      refreshItems(listId);
      return true;
    },
    [item, serving, claim, listId, refreshItems],
  );

  const release = useCallback(async (): Promise<boolean> => {
    if (!item) return false;
    setBusy("release");
    setFailure(null);
    const answer = await releaseCallListItemAction(item.id);
    setBusy(null);
    if (answer.error) {
      setFailure(answer.error);
      return false;
    }
    setItemDial(null);
    setCard(null);
    setNotice(null);
    refreshItems(listId);
    return true;
  }, [item, listId, refreshItems]);

  const stage = workStage({ item, dial: followed });
  const itemId = item?.id ?? null;
  const endedCall = followed?.track.ended?.callId ? followed.requestId : null;

  useEffect(() => {
    if (!endedCall || !itemId) return;
    let cancelled = false;
    void listCallListItemsAction(listId, { state: "reserved", limit: HELD_SCAN_LIMIT }).then((answer) => {
      if (cancelled) return;
      if (answer.error) {
        setFailure(answer.error);
        return;
      }
      const fresh = answer.data.items.find((candidate) => candidate.id === itemId);
      if (!fresh) return;
      setCard((current) => (current && current.item.id === fresh.id ? { ...current, item: fresh } : current));
    });
    return () => {
      cancelled = true;
    };
  }, [endedCall, listId, itemId]);

  return {
    now,
    card,
    notice,
    failure,
    busy,
    dial: followed,
    stage,
    ended: followed?.track.ended ?? null,
    ours: ownsCall(followed, callState),
    anyLive: isCallLive(callState),
    serving,
    claim,
    startDial,
    close,
    release,
    clearFailure: () => setFailure(null),
  };
}

export type CallListWork = ReturnType<typeof useCallListWork>;
