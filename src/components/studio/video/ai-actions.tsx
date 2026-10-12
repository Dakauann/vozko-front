"use client";

import { useTranslations } from "next-intl";

import { handOffToElo } from "@/components/ai-chat/elo-handoff";
import { ContextMenuSeparator } from "@/components/ui/context-menu";
import { useSettledPermission } from "@/hooks/use-settled-permission";
import { handoffPrompt } from "@/lib/aichat/elo-handoff";
import type { ModelKind } from "@/lib/media-generation/types";
import { aiActionsFor, clipSubjectKind, laneSubjectKind, runningActions, subjectList, type AiActionId, type AiActionSubject } from "@/lib/studio/ai-actions";
import type { Clip, Track } from "@/lib/studio/document";
import { clipImageSource } from "@/lib/studio/image-sources";
import type { ClipJobKind } from "@/lib/studio/job-sources";
import { findClip } from "@/lib/studio/timeline";
import { formatTimecode } from "@/lib/studio/timeline-view";

import { AiActionsSubmenu, type AiActionEntry } from "../ai/ai-actions-menu";
import { startClipJob } from "./clip-jobs";
import { openAiForm, pickClip } from "./drafts";
import { useEditorState, useVideoEditor, useViewState } from "./editor-context";
import type { MenuTarget } from "./timeline/timeline-context-menu";
import { useClipLabeler } from "./use-clip-label";
import type { VideoJob } from "./view-store";

function activeJobs(jobs: readonly VideoJob[]): VideoJob[] {
  return jobs.filter((job) => job.state === "running");
}

export function clipAiSubject(clip: Clip, track: Track, selected: number, jobs: readonly VideoJob[], canAskElo: boolean): AiActionSubject {
  const active = activeJobs(jobs);
  return {
    editor: "video",
    kind: clipSubjectKind(clip, track, selected),
    locked: Boolean(track.locked),
    hasSource: Boolean(clipImageSource(clip)?.assetId ?? clip.assetId),
    running: runningActions(active.filter((job) => job.target.clipId === clip.id).map((job) => job.purpose)),
    activeKinds: active.map((job) => job.purpose),
    canAskElo,
  };
}

export function laneAiSubject(track: Track, jobs: readonly VideoJob[], canAskElo: boolean): AiActionSubject {
  return { editor: "video", kind: laneSubjectKind(track), locked: Boolean(track.locked), hasSource: false, running: [], activeKinds: activeJobs(jobs).map((job) => job.purpose), canAskElo };
}

const GENERATORS: Partial<Record<AiActionId, ModelKind>> = { generateMusic: "music", generateVoice: "voice", generateSfx: "sfx", generateImage: "image" };
const PROCESSES: Partial<Record<AiActionId, ClipJobKind>> = { removeBackground: "cutout", denoise: "denoise", captions: "captions" };

export function useTimelineAiActions(target: MenuTarget | null): AiActionEntry[] {
  const t = useTranslations("studio.aiActions");
  const tc = useTranslations("studio.video.timeline.clipTypes");
  const label = useClipLabeler();
  const editor = useVideoEditor();
  const { view, playback, projectId } = editor;
  const document = useEditorState((s) => s.document);
  const selection = useEditorState((s) => s.selection);
  const jobs = useViewState((s) => s.jobs);
  const canAskElo = useSettledPermission("ai_chat", "create");

  const entries = (subject: AiActionSubject, runOf: (id: AiActionId) => (() => void) | null): AiActionEntry[] =>
    aiActionsFor(subject).flatMap((state) => {
      const run = runOf(state.definition.id);
      return run ? [{ state, run }] : [];
    });

  if (target?.kind === "lane") {
    const track = document.tracks.find((candidate) => candidate.id === target.trackId);
    if (!track) return [];
    return entries(laneAiSubject(track, jobs, canAskElo), (id) => {
      const kind = GENERATORS[id];
      if (!kind) return null;
      return () => {
        playback.seek(target.atMs);
        openAiForm(view, kind, { trackId: track.id });
      };
    });
  }

  const found = target?.kind === "clip" ? findClip(document, target.clipId) : null;
  if (!found) return [];
  const { clip, track } = found;
  const together = selection.includes(clip.id) ? selection : [clip.id];
  const kindOf = (item: Clip) => tc(item.type === "overlay" && item.layer ? (item.layer.type === "shape" ? `shapes.${item.layer.shape ?? "rect"}` : item.layer.type) : item.type);

  const askElo = (instruction?: string) => {
    const items = together.flatMap((id) => {
      const item = findClip(document, id)?.clip;
      if (!item) return [];
      const kind = t("context.span", { kind: kindOf(item), start: formatTimecode(item.startMs), end: formatTimecode(item.startMs + item.durationMs) });
      return [{ id: item.id, label: label(item), kind }];
    });
    const context = t("context.timeline", { playhead: formatTimecode(view.getState().playheadMs), items: subjectList(items) });
    handOffToElo({ projectId, prompt: handoffPrompt(context, instruction), attachments: [] });
  };

  const elo: Partial<Record<AiActionId, () => void>> = {
    eloRewrite: () => askElo(t("prompts.eloRewrite")),
    eloTranslate: () => askElo(t("prompts.eloTranslate")),
    eloShorten: () => askElo(t("prompts.eloShorten")),
    eloAsk: () => askElo(),
  };

  return entries(clipAiSubject(clip, track, together.length, jobs, canAskElo), (id) => {
    const kind = PROCESSES[id];
    if (kind) {
      return () => {
        view.setState({ panel: kind === "captions" ? "captions" : "process" });
        pickClip(view, kind, clip.id);
        startClipJob(editor, kind, clip.id);
      };
    }
    return elo[id] ?? null;
  });
}

export function TimelineAiSubmenu({ target, className }: { target: MenuTarget | null; className?: string }) {
  const entries = useTimelineAiActions(target);
  if (entries.length === 0) return null;
  return (
    <>
      <AiActionsSubmenu entries={entries} className={className} />
      <ContextMenuSeparator />
    </>
  );
}
