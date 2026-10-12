"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

import { clipCount, findClip, type ClipLocation } from "@/lib/studio/timeline";
import { findTransition } from "@/lib/studio/transitions";
import { formatTimecode } from "@/lib/studio/timeline-view";

import { InspectorProvider } from "../../inspector/inspector-context";
import { InspectorBody, InspectorNav } from "../../inspector/inspector-nav";
import { useEditorState, useVideoEditor, useViewState } from "../editor-context";
import { ClipInspector } from "./clip-inspector";
import { ColorField, FieldGrid, InspectorSection, NumberField } from "./fields";
import { SHUTTER_ANGLE_RANGE, SHUTTER_PHASE_RANGE, shutterOf } from "@/lib/studio/motion-blur";
import { perspectiveOf } from "@/lib/studio/clip-tilt";
import { PERSPECTIVE_RANGE } from "@/lib/studio/perspective";
import { SelectionNotice } from "./selection-notice";
import { TransitionInspector } from "./transition-inspector";

function ShutterSection() {
  const t = useTranslations("studio.video.inspector");
  const { store, commands } = useVideoEditor();
  const angle = useEditorState((s) => shutterOf(s.document.canvas).angle);
  const phase = useEditorState((s) => shutterOf(s.document.canvas).phase);
  const shutter = { angle, phase };
  const gesture = { onGestureStart: () => store.getState().beginTransaction(), onGestureEnd: () => store.getState().commitTransaction() };
  return (
    <InspectorSection id="shutter" title={t("shutter")} summary={t("shutterSummary", { angle: shutter.angle, phase: shutter.phase })}>
      <FieldGrid>
        <NumberField label={t("shutterAngle")} unit="°" step={15} min={SHUTTER_ANGLE_RANGE[0]} max={SHUTTER_ANGLE_RANGE[1]} value={shutter.angle} onCommit={(value) => commands.setShutter({ shutterAngle: value })} {...gesture} />
        <NumberField label={t("shutterPhase")} unit="°" step={15} min={SHUTTER_PHASE_RANGE[0]} max={SHUTTER_PHASE_RANGE[1]} value={shutter.phase} onCommit={(value) => commands.setShutter({ shutterPhase: value })} {...gesture} />
      </FieldGrid>
      <p className="text-2xs text-muted-foreground">{t("shutterHint")}</p>
    </InspectorSection>
  );
}

function PerspectiveSection() {
  const t = useTranslations("studio.video.inspector");
  const { store, commands } = useVideoEditor();
  const perspective = useEditorState((s) => perspectiveOf(s.document.canvas));
  const gesture = { onGestureStart: () => store.getState().beginTransaction(), onGestureEnd: () => store.getState().commitTransaction() };
  return (
    <InspectorSection id="perspective" title={t("perspective")} summary={perspective === 0 ? t("perspectiveFlat") : t("perspectiveSummary", { angle: perspective })}>
      <NumberField label={t("perspectiveAngle")} unit="°" step={5} min={PERSPECTIVE_RANGE[0]} max={PERSPECTIVE_RANGE[1]} value={perspective} onCommit={commands.setPerspective} {...gesture} />
      <p className="text-2xs text-muted-foreground">{t("perspectiveHint")}</p>
    </InspectorSection>
  );
}

function ProjectInspector() {
  const t = useTranslations("studio.video.inspector");
  const { commands } = useVideoEditor();
  const document = useEditorState((s) => s.document);
  return (
    <>
      <InspectorSection title={t("project")}>
        <ColorField label={t("background")} value={document.canvas.background} opaque onChange={commands.setBackground} />
        <dl className="grid grid-cols-2 gap-y-1 text-xs">
          <dt className="text-muted-foreground">{t("length")}</dt>
          <dd className="text-right tabular-nums text-foreground">{formatTimecode(document.durationMs)}</dd>
          <dt className="text-muted-foreground">{t("clips")}</dt>
          <dd className="text-right tabular-nums text-foreground">{clipCount(document)}</dd>
          <dt className="text-muted-foreground">{t("tracks")}</dt>
          <dd className="text-right tabular-nums text-foreground">{document.tracks.length}</dd>
        </dl>
      </InspectorSection>
      <ShutterSection />
      <PerspectiveSection />
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
  const selectedTransitionId = useViewState((s) => s.selectedTransitionId);
  const transition = locations.length === 0 && selectedTransitionId ? findTransition(document, selectedTransitionId) : null;

  return (
    <InspectorProvider scope="video">
      <aside aria-label={t("label")} data-tour="studio-video-inspector" className="flex h-full w-full flex-col bg-card">
        <h2 className="shrink-0 border-b border-border px-3 py-2.5 text-xs font-semibold text-foreground">
          {found ? t(`clipTitle.${found.clip.type}`) : locations.length > 1 ? t("selectionTitle") : transition ? t("transitionTitle") : t("projectTitle")}
        </h2>
        <InspectorNav />
        <InspectorBody className="min-h-0 flex-1 overflow-y-auto">
          <SelectionNotice />
          {locations.length > 0 ? (
            <ClipInspector key={selection.join(",")} locations={locations} />
          ) : transition ? (
            <TransitionInspector key={transition.transition.id} transition={transition.transition} trackKind={transition.track.kind} locked={Boolean(transition.track.locked)} />
          ) : (
            <ProjectInspector />
          )}
        </InspectorBody>
      </aside>
    </InspectorProvider>
  );
}
