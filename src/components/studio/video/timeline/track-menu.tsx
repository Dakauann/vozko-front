"use client";

import { Fragment, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import { DotsThreeVertical } from "@/components/icons";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuSub, ContextMenuSubContent, ContextMenuSubTrigger, ContextMenuTrigger } from "@/components/ui/context-menu";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { Track, VideoDocument } from "@/lib/studio/document";
import { addTrackNextTo, removeTrack, shiftTarget, shiftTrack, updateTrack, type LaneDirection } from "@/lib/studio/timeline";
import { LABEL_COLORS, type LabelColor } from "@/lib/studio/labels";
import { cn } from "@/lib/utils";

import { useEditorState, useVideoEditor } from "../editor-context";
import { ToolButton } from "../tool-button";
import { LabelSwatch, useLabelName } from "../label-colors";

const ITEM = "gap-2 text-xs focus:bg-accent-hover focus:text-foreground";

interface TrackAction {
  id: "addAbove" | "addBelow" | "moveUp" | "moveDown" | "shy" | "remove";
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
    { id: "shy", label: track.shy ? t("unshy") : t("shy"), disabled: false, run: () => apply((doc) => updateTrack(doc, track.id, { shy: track.shy ? undefined : true })) },
    { id: "remove", label: t("remove", { name }), disabled: Boolean(track.locked), run: () => apply((doc) => removeTrack(doc, track.id)) },
  ];
}

interface TrackLabels {
  value: LabelColor | undefined;
  choose: (color: LabelColor | undefined) => void;
}

export function useTrackLabels(track: Track): TrackLabels {
  const { store } = useVideoEditor();
  return { value: track.labelColor, choose: (color) => store.getState().apply((doc) => updateTrack(doc, track.id, { labelColor: color })) };
}

const LABEL_CHOICES: (LabelColor | undefined)[] = [undefined, ...LABEL_COLORS];

function LabelChoices({ labels, Item }: { labels: TrackLabels; Item: typeof DropdownMenuItem | typeof ContextMenuItem }) {
  const name = useLabelName();
  return (
    <>
      {LABEL_CHOICES.map((color) => (
        <Item key={color ?? "none"} className={ITEM} onSelect={() => labels.choose(color)}>
          <LabelSwatch color={color} />
          <span className="flex-1">{name(color)}</span>
          {labels.value === color ? <span aria-hidden>•</span> : null}
        </Item>
      ))}
    </>
  );
}

export function TrackMenuButton({ label, actions, labels, className }: { label: string; actions: readonly TrackAction[]; labels: TrackLabels; className?: string }) {
  const t = useTranslations("studio.video.timeline.track");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <ToolButton size="sm" label={label} icon={<DotsThreeVertical className="h-3.5 w-3.5" />} className={cn("data-[state=open]:opacity-100", className)} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className={ITEM}>
            <LabelSwatch color={labels.value} />
            {t("labelColor")}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-40">
            <LabelChoices labels={labels} Item={DropdownMenuItem} />
          </DropdownMenuSubContent>
        </DropdownMenuSub>
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

export function TrackContextMenu({ actions, labels, children }: { actions: readonly TrackAction[]; labels: TrackLabels; children: ReactNode }) {
  const t = useTranslations("studio.video.timeline.track");
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-48 border-border-strong">
        <ContextMenuSub>
          <ContextMenuSubTrigger className={ITEM}>
            <LabelSwatch color={labels.value} />
            {t("labelColor")}
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-40">
            <LabelChoices labels={labels} Item={ContextMenuItem} />
          </ContextMenuSubContent>
        </ContextMenuSub>
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
