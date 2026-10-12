"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";

import type { ScreenTarget } from "@/lib/aichat/screen";
import type { ToolSubject } from "@/lib/aichat/types";
import { lookClock } from "@/lib/studio/agent/look-target";

import { revealOnScreen, useCanReveal } from "./screen-bridge";

export const LOOK_SUBJECT = "studio_look";

const LOOK_KINDS: ReadonlySet<string> = new Set<ScreenTarget["kind"]>(["artboard", "artboards", "moments", "media"]);
const REVEALABLE: ReadonlySet<string> = new Set<ScreenTarget["kind"]>(["artboard", "moments"]);

export function useLookTargetText(): (target: ScreenTarget) => string {
  const t = useTranslations("aiChatPage.lookTargets");
  const boards = useTranslations("studio.image.artboards");
  return useCallback(
    (target: ScreenTarget) => {
      switch (target.kind) {
        case "artboard":
          return target.name || boards("untitled", { number: target.n });
        case "moments": {
          const [from, to] = lookClock(target);
          return to ? t("span", { from, to }) : from;
        }
        case "artboards":
          return t("artboards");
        case "media":
          return t("media");
      }
    },
    [t, boards],
  );
}

export interface LookStep {
  title: string;
  hint: string;
  reveal: (() => void) | null;
}

function lookTarget(subject: ToolSubject | undefined) {
  const target = subject?.kind === LOOK_SUBJECT ? subject.target : undefined;
  return target && LOOK_KINDS.has(target.kind) ? target : undefined;
}

export function useLookStep(subject: ToolSubject | undefined): LookStep | null {
  const t = useTranslations("aiChatPage.lookTargets");
  const text = useLookTargetText();
  const target = lookTarget(subject);
  const revealable = useCanReveal(target && REVEALABLE.has(target.kind) ? target.projectId : undefined);
  if (!target) return null;
  return { title: t("seeing", { target: text(target) }), hint: t("reveal"), reveal: revealable ? () => revealOnScreen(target) : null };
}
