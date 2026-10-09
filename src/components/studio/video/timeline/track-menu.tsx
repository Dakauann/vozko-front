"use client";

import { Fragment, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import { DotsThreeVertical } from "@/components/icons";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from "@/components/ui/context-menu";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { Track, VideoDocument } from "@/lib/studio/document";
import { addTrackNextTo, removeTrack, shiftTarget, shiftTrack, type LaneDirection } from "@/lib/studio/timeline";
import { cn } from "@/lib/utils";

import { useEditorState, useVideoEditor } from "../editor-context";
import { ToolButton } from "../tool-button";

const ITEM = "gap-2 text-xs focus:bg-accent-hover focus:text-foreground";

export interface TrackAction {
  id: "addAbove" | "addBelow" | "moveUp" | "moveDown" | "remove";
  label: string;
  disabled: boolean;
  run: () => void;
}

export function useTrackActions(track: Track, name: string): TrackAction[] {
  const t = useTranslations("studio.video.timeline.track");
  const { store } = useVideoEditor();
  const tracks = useEditorState((s) => s.document.tracks);
  const apply = (operation: (doc: VideoDocument) => VideoDocument) => store.getState().apply(operation);
  const add = (direction: LaneDirection) => apply((doc) => addTrackNextTo(doc, track.id, direction)?.document ?? doc);
  const shift = (direction: LaneDirection) => apply((doc) => shiftTrack(doc, track.id, direction));
  return [
    { id: "addAbove", label: t("addAbove"), disabled: false, run: () => add("up") },
    { id: "addBelow", label: t("addBelow"), disabled: false, run: () => add("down") },
    { id: "moveUp", label: t("moveUp"), disabled: shiftTarget(tracks, track.id, "up") === null, run: () => shift("up") },
    { id: "moveDown", label: t("moveDown"), disabled: shiftTarget(tracks, track.id, "down") === null, run: () => shift("down") },
    { id: "remove", label: t("remove", { name }), disabled: Boolean(track.locked), run: () => apply((doc) => removeTrack(doc, track.id)) },
  ];
}

export function TrackMenuButton({ label, actions, className }: { label: string; actions: readonly TrackAction[]; className?: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <ToolButton size="sm" label={label} icon={<DotsThreeVertical className="h-3.5 w-3.5" />} className={cn("data-[state=open]:opacity-100", className)} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        {actions.map((action) => (
          <Fragment key={action.id}>
            {action.id === "remove" ? <DropdownMenuSeparator /> : null}
            <DropdownMenuItem className={ITEM} disabled={action.disabled} onSelect={action.run}>
              {action.label}
            </DropdownMenuItem>
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function TrackContextMenu({ actions, children }: { actions: readonly TrackAction[]; children: ReactNode }) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-48 border-border-strong">
        {actions.map((action) => (
          <Fragment key={action.id}>
            {action.id === "remove" ? <ContextMenuSeparator /> : null}
            <ContextMenuItem className={ITEM} disabled={action.disabled} onSelect={action.run}>
              {action.label}
            </ContextMenuItem>
          </Fragment>
        ))}
      </ContextMenuContent>
    </ContextMenu>
  );
}
