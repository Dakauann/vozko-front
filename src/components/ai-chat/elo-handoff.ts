"use client";

import { useEffect, useRef } from "react";

import { openDock } from "@/lib/aichat/dock-state";
import { createHandoffChannel, type EloHandoff, type HandoffListener } from "@/lib/aichat/elo-handoff";

const channel = createHandoffChannel();

export function handOffToElo(handoff: EloHandoff): void {
  channel.send(handoff);
  openDock();
}

export function useEloHandoff(onHandoff: HandoffListener): void {
  const latest = useRef(onHandoff);

  useEffect(() => {
    latest.current = onHandoff;
  }, [onHandoff]);

  useEffect(() => channel.listen((handoff) => latest.current(handoff)), []);
}
