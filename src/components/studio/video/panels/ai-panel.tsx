"use client";

import { useId, useMemo } from "react";
import { useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import { ElevatedPillToggle } from "@/components/elevated-design/elevated-pill-toggle";
import { Sparkle } from "@/components/icons";
import { MediaModelSelect } from "@/components/media-generation/media-model-select";
import { canStart } from "@/lib/media-generation/limits";
import { VOICES, type MediaGenerationInput, type ModelKind, type Voice } from "@/lib/media-generation/types";
import { STUDIO_LIMITS } from "@/lib/studio/document";
import { placementTracks } from "@/lib/studio/job-sources";
import { laneOrder } from "@/lib/studio/timeline-view";

import { useEditorState, useVideoEditor, useViewState } from "../editor-context";
import { useAiDraft } from "../drafts";
import { NumberField } from "../inspector/fields";
import { useJobs, useRunningKinds } from "../jobs";
import { useTrackNames } from "../use-track-names";
import { JobList } from "./job-status";

const KINDS: ModelKind[] = ["music", "voice", "image"];
const PROMPT_LIMIT = 2000;
const MS = 1000;
const SELECT_CLASS = "h-7 w-full rounded-md border border-border bg-background px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function voiceLabel(voice: Voice): string {
  return voice.charAt(0).toUpperCase() + voice.slice(1);
}

function GenerateForm({ kind }: { kind: ModelKind }) {
  const t = useTranslations("studio.video.ai");
  const { commands, view, store } = useVideoEditor();
  const promptId = useId();
  const voiceId = useId();
  const trackFieldId = useId();
  const [{ prompt, model, voice, trackId, durationMs }, updateDraft] = useAiDraft(kind);
  const tracks = useEditorState((s) => s.document.tracks);
  const names = useTrackNames(tracks);
  const targets = useMemo(() => laneOrder(placementTracks(tracks, kind)), [tracks, kind]);
  const chosenTrack = targets.some((track) => track.id === trackId) ? trackId : null;
  const jobs = useJobs(kind);
  const blocked = !canStart(kind, useRunningKinds());
  const text = prompt.trim();

  const submit = () => {
    if (!model || text === "" || blocked) return;
    let input: MediaGenerationInput;
    if (kind === "music") input = { kind, model, prompt: text };
    else if (kind === "voice") input = { kind, model, prompt: text, voice };
    else input = { kind, model, prompt: text, aspect: store.getState().document.canvas.aspect };
    void commands.startJob(kind, input, { atMs: view.getState().playheadMs, trackId: chosenTrack ?? undefined, durationMs: durationMs ?? undefined });
  };

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className="space-y-1">
        <label htmlFor={promptId} className="block text-2xs text-muted-foreground">
          {t(`${kind}.prompt`)}
        </label>
        <textarea
          id={promptId}
          rows={kind === "voice" ? 6 : 4}
          maxLength={PROMPT_LIMIT}
          value={prompt}
          placeholder={t(`${kind}.placeholder`)}
          onChange={(event) => updateDraft({ prompt: event.target.value })}
          className="w-full resize-y rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        {kind === "voice" ? <p className="text-2xs text-muted-foreground">{t("voice.exact")}</p> : null}
      </div>
      {kind === "voice" ? (
        <div className="space-y-1">
          <label htmlFor={voiceId} className="block text-2xs text-muted-foreground">
            {t("voice.voice")}
          </label>
          <select id={voiceId} value={voice} onChange={(event) => updateDraft({ voice: event.target.value as Voice })} className={SELECT_CLASS}>
            {VOICES.map((option) => (
              <option key={option} value={option}>
                {voiceLabel(option)}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <MediaModelSelect kind={kind} value={model} onChange={(next) => updateDraft({ model: next })} />
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label htmlFor={trackFieldId} className="block text-2xs text-muted-foreground">
            {t("track")}
          </label>
          <select id={trackFieldId} value={chosenTrack ?? ""} onChange={(event) => updateDraft({ trackId: event.target.value || null })} className={SELECT_CLASS}>
            <option value="">{t("auto")}</option>
            {targets.map((track) => (
              <option key={track.id} value={track.id}>
                {names.get(track.id)}
              </option>
            ))}
          </select>
        </div>
        <NumberField
          label={t("duration")}
          unit="s"
          step={0.5}
          decimals={2}
          min={STUDIO_LIMITS.minClipMs / MS}
          max={STUDIO_LIMITS.maxVideoMs / MS}
          value={durationMs === null ? null : durationMs / MS}
          placeholder={t("auto")}
          onCommit={(seconds) => updateDraft({ durationMs: Math.round(seconds * MS) })}
          onClear={() => updateDraft({ durationMs: null })}
        />
      </div>
      <p className="text-2xs text-muted-foreground">{t("placement")}</p>
      <Button
        type="submit"
        variant="primary"
        size="sm"
        className="w-full"
        title={t(`${kind}.generate`)}
        icon={<Sparkle className="h-3.5 w-3.5" />}
        iconVisible
        disabled={blocked || !model || text === ""}
      />
      <JobList kind={kind} jobs={jobs} blocked={blocked} />
    </form>
  );
}

export function AiPanel() {
  const t = useTranslations("studio.video.ai");
  const { view } = useVideoEditor();
  const kind = useViewState((s) => s.aiKind);
  const setKind = (next: ModelKind) => view.setState({ aiKind: next });
  return (
    <div className="space-y-3 p-3">
      <ElevatedPillToggle<ModelKind>
        aria-label={t("kinds")}
        value={kind}
        onChange={setKind}
        size="md"
        className="flex w-full [&>button]:flex-1"
        options={KINDS.map((option) => ({ value: option, label: t(`${option}.tab`) }))}
      />
      {KINDS.map((option) => (
        <div key={option} hidden={kind !== option}>
          <GenerateForm kind={option} />
        </div>
      ))}
    </div>
  );
}
