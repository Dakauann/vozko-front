"use client";

import { useCallback, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import { ElevatedPillToggle } from "@/components/elevated-design/elevated-pill-toggle";
import { Sparkle } from "@/components/icons";
import { MediaModelSelect } from "@/components/media-generation/media-model-select";
import { useMediaGeneration, type MediaGenerationResult } from "@/hooks/use-media-generation";
import { VOICES, type MediaGenerationInput, type ModelKind, type Voice } from "@/lib/media-generation/types";
import type { MediaClipType } from "@/lib/studio/media-clips";

import { useVideoEditor } from "../editor-context";
import { JobStatus } from "./job-status";

const RESULT_TYPE: Record<ModelKind, MediaClipType> = { music: "audio", voice: "audio", image: "image" };
const KINDS: ModelKind[] = ["music", "voice", "image"];
const PROMPT_LIMIT = 2000;

function voiceLabel(voice: Voice): string {
  return voice.charAt(0).toUpperCase() + voice.slice(1);
}

function GenerateForm({ kind }: { kind: ModelKind }) {
  const t = useTranslations("studio.video.ai");
  const { assets, commands, view, store } = useVideoEditor();
  const promptId = useId();
  const voiceId = useId();
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState<string | null>(null);
  const [voice, setVoice] = useState<Voice>("nova");
  const insertAt = useRef(0);

  const onDone = useCallback(
    async (result: MediaGenerationResult) => {
      await assets.loadLibrary();
      await commands.insertMedia({ id: result.mediaId, type: RESULT_TYPE[kind] }, insertAt.current);
    },
    [assets, commands, kind],
  );

  const generation = useMediaGeneration({ onDone: (result) => void onDone(result) });
  const busy = generation.status === "generating";
  const text = prompt.trim();

  const submit = () => {
    if (!model || text === "" || busy) return;
    insertAt.current = view.getState().playheadMs;
    let input: MediaGenerationInput;
    if (kind === "music") input = { kind, model, prompt: text };
    else if (kind === "voice") input = { kind, model, prompt: text, voice };
    else input = { kind, model, prompt: text, aspect: store.getState().document.canvas.aspect };
    void generation.start(input);
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
          disabled={busy}
          placeholder={t(`${kind}.placeholder`)}
          onChange={(event) => setPrompt(event.target.value)}
          className="w-full resize-y rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        {kind === "voice" ? <p className="text-2xs text-muted-foreground">{t("voice.exact")}</p> : null}
      </div>
      {kind === "voice" ? (
        <div className="space-y-1">
          <label htmlFor={voiceId} className="block text-2xs text-muted-foreground">
            {t("voice.voice")}
          </label>
          <select
            id={voiceId}
            value={voice}
            disabled={busy}
            onChange={(event) => setVoice(event.target.value as Voice)}
            className="h-7 w-full rounded-md border border-border bg-background px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {VOICES.map((option) => (
              <option key={option} value={option}>
                {voiceLabel(option)}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <MediaModelSelect kind={kind} value={model} onChange={setModel} disabled={busy} />
      <p className="text-2xs text-muted-foreground">{t("placement")}</p>
      <Button
        type="submit"
        variant="primary"
        size="sm"
        className="w-full"
        title={t(`${kind}.generate`)}
        icon={<Sparkle className="h-3.5 w-3.5" />}
        iconVisible
        disabled={busy || !model || text === ""}
      />
      <JobStatus kind={kind} status={generation.status} settling={generation.settling} error={generation.error} />
    </form>
  );
}

export function AiPanel() {
  const t = useTranslations("studio.video.ai");
  const [kind, setKind] = useState<ModelKind>("music");
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
