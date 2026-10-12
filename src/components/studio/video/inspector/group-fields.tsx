"use client";

import { useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import type { Clip } from "@/lib/studio/document";
import { groupContentMs, isGroupClip } from "@/lib/studio/group-scope";
import { formatTimecode } from "@/lib/studio/timeline-view";

import { useVideoEditor } from "../editor-context";
import { InspectorSection } from "./fields";
import { VolumeField } from "./sound-fields";
import type { SelectionEditor } from "./use-selection-editor";

interface GroupFieldsProps {
  clip: Clip;
  disabled: boolean;
}

export function GroupFields({ clip, disabled }: GroupFieldsProps) {
  const t = useTranslations("studio.video.groups");
  const { commands } = useVideoEditor();
  if (!isGroupClip(clip)) return null;
  const clips = clip.tracks.reduce((sum, track) => sum + track.clips.length, 0);
  return (
    <InspectorSection id="group" title={t("title")} summary={t("summary", { clips, tracks: clip.tracks.length })}>
      <p className="text-2xs text-muted-foreground">{t("contentLength", { length: formatTimecode(groupContentMs(clip)) })}</p>
      <div className="flex flex-wrap gap-1">
        <Button variant="outline" size="sm" title={t("open")} onClick={() => commands.openGroup(clip.id)} />
        <Button variant="outline" size="sm" disabled={disabled} title={t("ungroup")} onClick={() => commands.ungroupSelection()} />
      </div>
      <p className="text-2xs text-muted-foreground">{t("hint")}</p>
    </InspectorSection>
  );
}

export function GroupSoundFields({ clips, disabled, editor }: { clips: readonly Clip[]; disabled: boolean; editor: SelectionEditor }) {
  const t = useTranslations("studio.video.groups");
  return (
    <InspectorSection id="groupSound" title={t("sound")}>
      <VolumeField clips={clips} disabled={disabled} editor={editor} />
      <p className="text-2xs text-muted-foreground">{t("soundHint")}</p>
    </InspectorSection>
  );
}
