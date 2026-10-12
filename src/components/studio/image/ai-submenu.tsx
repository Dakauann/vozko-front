"use client";

import { ContextMenuSeparator } from "@/components/ui/context-menu";

import { AiActionsSubmenu } from "../ai/ai-actions-menu";
import { useImageAiActions } from "./ai-actions";

export function ImageAiSubmenu() {
  const entries = useImageAiActions();
  if (entries.length === 0) return null;
  return (
    <>
      <AiActionsSubmenu entries={entries} />
      <ContextMenuSeparator />
    </>
  );
}
