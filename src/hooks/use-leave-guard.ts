"use client";

import { useEffect } from "react";

export function useLeaveGuard(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const hold = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", hold);
    return () => window.removeEventListener("beforeunload", hold);
  }, [active]);
}
