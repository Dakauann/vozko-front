"use client";

import { createContext, useCallback, useContext, useMemo, useState, type FocusEvent, type PointerEvent, type ReactNode } from "react";

import { cn } from "@/lib/utils";

interface SlotFocus {
  active: string | null;
  setActive: (key: string | null) => void;
}

const SlotFocusContext = createContext<SlotFocus>({ active: null, setActive: () => undefined });

export function AudienceSlotFocusProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<string | null>(null);
  const value = useMemo(() => ({ active, setActive }), [active]);
  return <SlotFocusContext.Provider value={value}>{children}</SlotFocusContext.Provider>;
}

export function useSlotFocusHandlers(key: string) {
  const { setActive } = useContext(SlotFocusContext);
  const release = useCallback(
    (element: HTMLElement) => {
      if (!element.contains(document.activeElement)) setActive(null);
    },
    [setActive],
  );
  return useMemo(
    () => ({
      onFocus: () => setActive(key),
      onPointerEnter: () => setActive(key),
      onBlur: (event: FocusEvent<HTMLElement>) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setActive(null);
      },
      onPointerLeave: (event: PointerEvent<HTMLElement>) => release(event.currentTarget),
    }),
    [key, setActive, release],
  );
}

export function SlotMark({ slotKey, tag, children }: { slotKey: string | null; tag: string; children: ReactNode }) {
  const { active } = useContext(SlotFocusContext);
  const lit = slotKey !== null && active === slotKey;
  return (
    <mark
      data-slot-key={slotKey ?? undefined}
      data-active={lit ? "true" : undefined}
      className={cn(
        "inline rounded-[4px] bg-muted px-1 py-px text-foreground outline outline-1 outline-transparent transition-[outline-color,background-color] duration-150 [box-decoration-break:clone]",
        lit && "bg-card outline-2 outline-ring",
      )}
    >
      <span className="mr-1 font-mono text-2xs font-semibold text-muted-foreground">{tag}</span>
      {children}
    </mark>
  );
}
