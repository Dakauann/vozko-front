"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

import { STUDIO_LIMITS } from "@/lib/studio/document";
import { clipCount, findClip, type ClipLocation } from "@/lib/studio/timeline";
import { formatTimecode } from "@/lib/studio/timeline-view";

import { useEditorState, useVideoEditor } from "../editor-context";
import { ClipInspector } from "./clip-inspector";
import { ColorField, InspectorSection } from "./fields";
import { SelectionNotice } from "./selection-notice";

function ProjectInspector() {
  const t = useTranslations("studio.video.inspector");
  const { commands } = useVideoEditor();
  const document = useEditorState((s) => s.document);
  return (
    <>
      <InspectorSection title={t("project")}>
        <ColorField label={t("background")} value={document.canvas.background} onChange={commands.setBackground} />
        <dl className="grid grid-cols-2 gap-y-1 text-xs">
          <dt className="text-muted-foreground">{t("length")}</dt>
          <dd className="text-right tabular-nums text-foreground">{formatTimecode(document.durationMs)}</dd>
          <dt className="text-muted-foreground">{t("clips")}</dt>
          <dd className="text-right tabular-nums text-foreground">{`${clipCount(document)} / ${STUDIO_LIMITS.maxClips}`}</dd>
          <dt className="text-muted-foreground">{t("tracks")}</dt>
          <dd className="text-right tabular-nums text-foreground">{`${document.tracks.length} / ${STUDIO_LIMITS.maxTracks}`}</dd>
        </dl>
      </InspectorSection>
      <p className="px-3 py-3 text-xs text-muted-foreground">{t("empty")}</p>
    </>
  );
}

export function Inspector() {
  const t = useTranslations("studio.video.inspector");
  const document = useEditorState((s) => s.document);
  const selection = useEditorState((s) => s.selection);
  const locations = useMemo(() => selection.map((id) => findClip(document, id)).filter((found): found is ClipLocation => found !== null), [document, selection]);
  const found = locations.length === 1 ? locations[0] : null;

  return (
    <aside aria-label={t("label")} data-tour="studio-video-inspector" className="h-full w-full overflow-y-auto bg-card">
      <h2 className="border-b border-border px-3 py-2.5 text-xs font-semibold text-foreground">
        {found ? t(`clipTitle.${found.clip.type}`) : locations.length > 1 ? t("selectionTitle") : t("projectTitle")}
      </h2>
      <SelectionNotice />
      {locations.length > 0 ? <ClipInspector key={selection.join(",")} locations={locations} /> : <ProjectInspector />}
    </aside>
  );
}
