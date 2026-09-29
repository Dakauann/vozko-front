"use client";

import { createContext, useContext, type ReactNode } from "react";

import { useAuth } from "@/contexts/auth-context";
import { useCallSessionWs, type CallSessionApi } from "@/hooks/use-call-session-ws";
import { useSettledPermission } from "@/hooks/use-settled-permission";

const CallSessionContext = createContext<CallSessionApi | null>(null);

export function CallSessionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const enabled = useSettledPermission("call_session", "use");
  const session = useCallSessionWs({ token: user?.id ?? "", enabled });
  return <CallSessionContext.Provider value={session}>{children}</CallSessionContext.Provider>;
}

export function useCallSession(): CallSessionApi {
  const session = useContext(CallSessionContext);
  if (!session) {
    throw new Error("useCallSession must be used inside CallSessionProvider");
  }
  return session;
}
