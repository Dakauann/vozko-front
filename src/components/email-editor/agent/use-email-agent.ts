"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";

import { usePublishAssistantContext } from "@/components/ai-chat/assistant-context";
import { useScreenHandler } from "@/components/ai-chat/screen-bridge";
import type { ReplayTarget } from "@/components/coworker/replay";
import { createAgentPresence, type AgentPresence } from "@/components/studio/agent/presence";
import type { AssistantContext } from "@/lib/aichat/assistant-context";
import type { ScreenHandler } from "@/lib/aichat/screen";
import type { Document } from "@/lib/email-design/types";

import { captureEmail } from "./capture";
import { createEmailAgent, type EnvelopePort } from "./email-agent";

export const EMAIL_CANVAS_ANCHOR = "[data-email-canvas]";
const POINTER_INSET = 12;

export type EmailAgentBinding =
  | { surface: "email_design"; projectId: string; name: string }
  | { surface: "email_campaign"; projectId: string; name: string; envelope: EnvelopePort };

function contextOf(binding: EmailAgentBinding): AssistantContext {
  if (binding.surface === "email_campaign") return { kind: "email_campaign", view: { surface: "email_campaign", projectId: binding.projectId }, campaignName: binding.name };
  return { kind: "email_design", view: { surface: "email_design", projectId: binding.projectId }, designName: binding.name };
}

function envelopeOf(binding: EmailAgentBinding | undefined): EnvelopePort | null {
  return binding?.surface === "email_campaign" ? binding.envelope : null;
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
  const latest = useRef({ t, reduced, name: binding?.name ?? "", join, envelope: envelopeOf(binding) });

  useEffect(() => {
    latest.current = { t, reduced, name: binding?.name ?? "", join, envelope: envelopeOf(binding) };
  });

  useEffect(() => () => presence.dispose(), [presence]);

  usePublishAssistantContext(binding ? contextOf(binding) : null);

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
        ...(latest.current.envelope ? { envelope: latest.current.envelope } : {}),
      })(command),
    [live, presence],
  );

  useScreenHandler(binding?.projectId ?? null, handler);
  return binding ? presence : null;
}
