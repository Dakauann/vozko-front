"use client";

import { useCallback, useState } from "react";

import { useBulkSelection } from "@/components/selection/use-bulk-selection";
import { keepListed, pickRange } from "@/lib/conversations/inbox-selection";
import { pageHeaderState, togglePage, togglePicked, type PageHeaderState } from "@/lib/selection/bulk-state";

export type SelectionAnnouncement = "entered" | "left" | null;

export interface InboxSelection {
  active: boolean;
  picked: ReadonlySet<string>;
  headerState: PageHeaderState;
  announcement: SelectionAnnouncement;
  start: (key?: string) => void;
  pick: (key: string, extend: boolean) => void;
  pickOrStart: (key: string) => void;
  toggleAll: () => void;
  leave: () => void;
}

export function useInboxSelection(scope: string, listedKeys: readonly string[]): InboxSelection {
  const { picked: stored, setPicked, clear } = useBulkSelection(scope);
  const [active, setActive] = useState(false);
  const [anchor, setAnchor] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState<SelectionAnnouncement>(null);
  const picked = keepListed(stored, listedKeys);

  const start = useCallback(
    (key?: string) => {
      if (!active) setAnnouncement("entered");
      setActive(true);
      if (!key) return;
      setPicked(new Set(picked).add(key));
      setAnchor(key);
    },
    [active, picked, setPicked],
  );

  const pick = useCallback(
    (key: string, extend: boolean) => {
      setPicked(extend ? pickRange(listedKeys, picked, anchor, key) : togglePicked(picked, key));
      setAnchor(key);
    },
    [listedKeys, picked, anchor, setPicked],
  );

  const pickOrStart = useCallback((key: string) => (active ? pick(key, false) : start(key)), [active, pick, start]);

  const toggleAll = useCallback(() => setPicked(togglePage(picked, listedKeys)), [picked, listedKeys, setPicked]);

  const leave = useCallback(() => {
    setActive(false);
    setAnchor(null);
    setAnnouncement("left");
    clear();
  }, [clear]);

  return {
    active,
    picked,
    headerState: pageHeaderState(listedKeys, picked),
    announcement,
    start,
    pick,
    pickOrStart,
    toggleAll,
    leave,
  };
}
