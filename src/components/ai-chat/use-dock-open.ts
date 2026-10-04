"use client";

import { useSyncExternalStore } from "react";

import { isDockOpen, setDockOpen, subscribeDock } from "@/lib/aichat/dock-state";

const closedOnServer = () => false;

export function useDockOpen(): [boolean, (open: boolean) => void] {
  return [useSyncExternalStore(subscribeDock, isDockOpen, closedOnServer), setDockOpen];
}
