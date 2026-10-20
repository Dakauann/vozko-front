"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { AudioPlayer } from "@/components/media/audio-player";
import { VoiceRecordingBar } from "@/components/media/voice-recording-bar";
import { ArrowCounterClockwise, Check, Microphone, Trash } from "@/components/icons";
import Button from "@/components/elevated-design/button";
import { useVoiceRecorder } from "@/hooks/use-voice-recorder";
import { cn } from "@/lib/utils";

interface Take {
  file: File;
  url: string;
}

export function VoiceNoteRecorder({
  onUse,
  disabled,
  className,
}: {
  onUse: (file: File) => void;
  disabled?: boolean;
  className?: string;
}) {
  const t = useTranslations("voiceRecorder");
  const [take, setTake] = useState<Take | null>(null);
  const keepTake = useCallback((file: File) => setTake({ file, url: URL.createObjectURL(file) }), []);
  const recorder = useVoiceRecorder(keepTake);

  useEffect(() => {
    if (!take) return;
    return () => URL.revokeObjectURL(take.url);
  }, [take]);

  const recordAgain = useCallback(() => {
    setTake(null);
    void recorder.start();
  }, [recorder]);

  const attachTake = useCallback(() => {
    if (take) onUse(take.file);
  }, [onUse, take]);

  const failure = recorder.error ? (
    <p role="alert" className="text-xs font-semibold text-destructive-ink">
      {t(`errors.${recorder.error}`)}
    </p>
  ) : null;

  if (recorder.isRecording) {
    return (
      <VoiceRecordingBar
        duration={recorder.duration}
        levels={recorder.levels}
        onCancel={recorder.cancel}
        onStop={recorder.stop}
        labels={{ cancel: t("cancel"), stop: t("stop") }}
        className={cn("rounded-[--radius] border border-border sm:px-3", className)}
      />
    );
  }

  if (take) {
    return (
      <div className={cn("space-y-2 rounded-[--radius] border border-border p-2", className)}>
        <AudioPlayer url={take.url} label={t("preview")} downloadable={false} className="mb-0 w-full" />
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            title={t("discard")}
            icon={<Trash className="h-3.5 w-3.5" weight="bold" />}
            iconVisible
            disabled={disabled}
            onClick={() => setTake(null)}
          />
          <Button
            variant="secondary"
            size="sm"
            title={t("rerecord")}
            icon={<ArrowCounterClockwise className="h-3.5 w-3.5" weight="bold" />}
            iconVisible
            disabled={disabled}
            onClick={recordAgain}
          />
          <Button
            variant="primary"
            size="sm"
            title={t("use")}
            icon={<Check className="h-3.5 w-3.5" weight="bold" />}
            iconVisible
            disabled={disabled}
            onClick={attachTake}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-1", className)}>
      <button
        type="button"
        onClick={() => void recorder.start()}
        disabled={disabled}
        className="inline-flex w-full items-center justify-center gap-2 rounded-[--radius] border border-dashed border-border px-3 py-3 text-sm text-muted-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
      >
        <Microphone className="h-4 w-4" weight="bold" />
        {t("record")}
      </button>
      {failure}
    </div>
  );
}
