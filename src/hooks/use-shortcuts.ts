"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

import { useHostWindow } from "@/contexts/host-document-context";
import { platformOf, type Platform } from "@/lib/keyboard/chord";
import { resolveShortcut, type ShortcutId, type ShortcutScope } from "@/lib/keyboard/crm-bindings";

export type ShortcutHandler = (event: KeyboardEvent) => boolean | void;

export type ShortcutHandlers = Partial<Record<ShortcutId, ShortcutHandler>>;

interface ShortcutOptions {
  element?: HTMLElement | null;
  enabled?: boolean;
}

function subscribeToNothing(): () => void {
  return () => {};
}

export function usePlatform(): Platform {
  return useSyncExternalStore(
    subscribeToNothing,
    () => platformOf(typeof navigator === "undefined" ? undefined : navigator),
    () => "other",
  );
}

export function useShortcuts(scope: ShortcutScope, handlers: ShortcutHandlers, { element, enabled = true }: ShortcutOptions = {}) {
  const hostWindow = useHostWindow();
  const platform = usePlatform();
  const handlersRef = useRef(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    if (!enabled || element === null) return;
    const attachedToWindow = element === undefined;
    const target: Pick<Window, "addEventListener" | "removeEventListener"> | undefined =
      element ?? hostWindow ?? (typeof window === "undefined" ? undefined : window);
    if (!target) return;
    const listener = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing) return;
      const id = resolveShortcut(event, scope, { platform, attachedToWindow, root: element });
      const handler = id ? handlersRef.current[id] : undefined;
      if (!handler || handler(event) === false) return;
      event.preventDefault();
    };
    target.addEventListener("keydown", listener as EventListener);
    return () => target.removeEventListener("keydown", listener as EventListener);
  }, [enabled, element, hostWindow, platform, scope]);
}
