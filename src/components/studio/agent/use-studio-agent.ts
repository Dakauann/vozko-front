"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";

import { usePublishAssistantContext } from "@/components/ai-chat/assistant-context";
import { useScreenHandler } from "@/components/ai-chat/screen-bridge";
import type { ScreenHandler } from "@/lib/aichat/screen";
import type { StudioProjectKind } from "@/lib/aichat/types";

import { createAgentPresence, type AgentPresence } from "./presence";

export interface StudioAgentKit {
  presence: AgentPresence;
  label: (action: string) => string;
  reduceMotion: () => boolean;
}

export function useStudioAgentKit(): StudioAgentKit {
  const t = useTranslations("studio.agent.actions");
  const [presence] = useState(() => createAgentPresence());
  const reduced = useReducedMotion();
  const reducedRef = useRef(Boolean(reduced));
  const translate = useRef(t);

  useEffect(() => {
    reducedRef.current = Boolean(reduced);
    translate.current = t;
  }, [reduced, t]);

  useEffect(() => () => presence.dispose(), [presence]);

  return useMemo(
    () => ({
      presence,
      label: (action: string) => (translate.current.has(action) ? translate.current(action) : translate.current("working")),
      reduceMotion: () => reducedRef.current,
    }),
    [presence],
  );
}

export function useStudioAgent(projectId: string, kind: StudioProjectKind, projectName: string, handler: ScreenHandler) {
  usePublishAssistantContext({ kind: "studio", view: { surface: "studio", projectId, projectKind: kind }, projectName });
  useScreenHandler(projectId, handler);
}
