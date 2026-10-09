"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { isActionError } from "@/app/actions/action-result";
import { reportStudioCapabilitiesAction } from "@/app/actions/studio";
import type { StudioKind } from "@/lib/studio/document";

import { gpuRenderingWanted } from "../render/gpu-preference";
import { probeDevice } from "./probe";
import { TelemetrySession, type StudioTelemetry } from "./telemetry-session";

const TICK_MS = 15_000;

const StudioTelemetryContext = createContext<StudioTelemetry | null>(null);

export function useStudioTelemetry(): StudioTelemetry | null {
  return useContext(StudioTelemetryContext);
}

function newSession(kind: StudioKind): TelemetrySession | null {
  if (typeof crypto === "undefined" || typeof crypto.randomUUID !== "function") return null;
  return new TelemetrySession({
    kind,
    sessionId: crypto.randomUUID(),
    renderingWanted: gpuRenderingWanted(),
    probe: () => probeDevice(kind),
    send: async (sessionId, report, keepalive) => !isActionError(await reportStudioCapabilitiesAction(sessionId, report, { keepalive })),
    now: () => performance.now(),
  });
}

export function StudioTelemetryProvider({ kind, children }: { kind: StudioKind; children: ReactNode }) {
  const [session] = useState(() => newSession(kind));

  useEffect(() => {
    if (!session) return;
    void session.start();
    const timer = window.setInterval(() => session.tick(), TICK_MS);
    const leave = () => {
      if (window.document.visibilityState === "hidden") session.hide();
    };
    window.document.addEventListener("visibilitychange", leave);
    return () => {
      window.clearInterval(timer);
      window.document.removeEventListener("visibilitychange", leave);
      session.stop();
    };
  }, [session]);

  return <StudioTelemetryContext.Provider value={session}>{children}</StudioTelemetryContext.Provider>;
}
