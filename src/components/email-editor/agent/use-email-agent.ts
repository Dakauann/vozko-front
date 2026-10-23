"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";

import { usePublishAssistantContext } from "@/components/ai-chat/assistant-context";
import { useScreenHandler } from "@/components/ai-chat/screen-bridge";
import type { ReplayTarget } from "@/components/coworker/replay";
import { createAgentPresence, type AgentPresence } from "@/components/studio/agent/presence";
import type { ScreenHandler } from "@/lib/aichat/screen";
import type { Document } from "@/lib/email-design/types";

import { captureEmail } from "./capture";
import { createEmailAgent } from "./email-agent";

export const EMAIL_CANVAS_ANCHOR = "[data-email-canvas]";
const POINTER_INSET = 12;

export interface EmailAgentBinding {
  designId: string;
  name: string;
}

export interface EditorLive {
  value: Document;
  selectedId: string | null;
  readOnly: boolean;
  dragging: boolean;
}

function escaped(value: string): string {
  return typeof CSS !== "undefined" && CSS.escape ? CSS.escape(value) : value.replace(/["\\]/g, "\\$&");
}

export function locateBlock(focus: string | null, reduceMotion: boolean): ReplayTarget | null {
  if (typeof document === "undefined") return null;
  const canvas = document.querySelector<HTMLElement>(EMAIL_CANVAS_ANCHOR);
  const element = focus ? canvas?.querySelector<HTMLElement>(`[data-block-id="${escaped(focus)}"]`) : null;
  const target = element ?? canvas;
  if (!target) return null;
  if (element) element.scrollIntoView?.({ block: "nearest", behavior: reduceMotion ? "auto" : "smooth" });
  const rect = target.getBoundingClientRect();
  const outline = element ? { left: rect.left, top: rect.top, width: rect.width, height: rect.height } : null;
  return { point: { x: rect.left + POINTER_INSET, y: rect.top + POINTER_INSET }, outline };
}

export function useEmailEditorAgent(binding: EmailAgentBinding | undefined, live: RefObject<EditorLive>, join: (group: string, next: Document) => void): AgentPresence | null {
  const t = useTranslations("emailEditor.agent.actions");
  const reduced = Boolean(useReducedMotion());
  const [presence] = useState(() => createAgentPresence());
  const latest = useRef({ t, reduced, name: binding?.name ?? "", join });

  useEffect(() => {
    latest.current = { t, reduced, name: binding?.name ?? "", join };
  });

  useEffect(() => () => presence.dispose(), [presence]);

  usePublishAssistantContext(binding ? { kind: "email_design", view: { surface: "email_design", projectId: binding.designId }, designName: binding.name } : null);

  const handler = useCallback<ScreenHandler>(
    (command) =>
      createEmailAgent({
        live: () => ({ document: live.current.value, selected: live.current.selectedId, name: latest.current.name, readOnly: live.current.readOnly }),
        store: { getState: () => ({ document: live.current.value, inTransaction: live.current.dragging, applyAs: (group, operation) => latest.current.join(group, operation()) }) },
        presence,
        locate: (focus) => locateBlock(focus, latest.current.reduced),
        label: (op) => (latest.current.t.has(op) ? latest.current.t(op) : latest.current.t("working")),
        reduceMotion: () => latest.current.reduced,
        hidden: () => typeof document !== "undefined" && document.visibilityState === "hidden",
        capture: captureEmail,
      })(command),
    [live, presence],
  );

  useScreenHandler(binding?.designId ?? null, handler);
  return binding ? presence : null;
}
