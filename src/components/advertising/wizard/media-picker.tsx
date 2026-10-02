"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { generateAdImageAction, isAdsError } from "@/app/actions/advertising";
import { uploadMediaAction } from "@/app/actions/medias";
import Button from "@/components/elevated-design/button";
import ElevatedPillToggle from "@/components/elevated-design/elevated-pill-toggle";
import ElevatedTextarea from "@/components/elevated-design/elevated-textarea";
import { Play, Sparkle, Trash, UploadSimple } from "@/components/icons";
import type { MediaChoice } from "@/lib/advertising/draft";
import type { AdMediaKind } from "@/lib/advertising/draft-types";
import type { AdImageAspect } from "@/lib/advertising/types";

import { AdImage } from "../ad-image";

type Mode = "upload" | "generate";
export type MediaAccept = AdMediaKind | "any";

const ASPECTS: AdImageAspect[] = ["square", "portrait", "story"];
const MAX_PROMPT = 4000;
const ACCEPT: Record<MediaAccept, string> = {
  image: "image/jpeg,image/png",
  video: "video/mp4,video/quicktime",
  any: "image/jpeg,image/png,video/mp4,video/quicktime",
};

function kindOf(file: File): AdMediaKind | null {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  return null;
}

export function MediaThumb({ media, className }: { media: MediaChoice; className?: string }) {
  return (
    <span className={className ?? "relative block h-16 w-16 shrink-0 overflow-hidden rounded-[--radius] bg-muted"}>
      {media.kind === "video" ? (
        <>
          <video src={media.url} muted playsInline preload="metadata" className="h-full w-full object-cover" />
          <Play className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 text-card" weight="fill" aria-hidden />
        </>
      ) : (
        <AdImage src={media.url} />
      )}
    </span>
  );
}

export function MediaPicker({
  value,
  accept,
  canGenerate,
  onChange,
}: {
  value: MediaChoice | null;
  accept: MediaAccept;
  canGenerate: boolean;
  onChange: (media: MediaChoice | null) => void;
}) {
  const t = useTranslations("adsWizard.media");
  const inputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>("upload");
  const [prompt, setPrompt] = useState("");
  const [aspect, setAspect] = useState<AdImageAspect>("square");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generates = canGenerate && accept !== "video";

  const upload = async (file: File | undefined) => {
    if (!file) return;
    const kind = kindOf(file);
    if (!kind || (accept !== "any" && kind !== accept)) {
      setError(t(accept === "video" ? "notVideo" : accept === "image" ? "notImage" : "notMedia"));
      return;
    }
    setBusy(true);
    setError(null);
    const formData = new FormData();
    formData.append("media", file);
    formData.append("mediaType", kind);
    formData.append("description", file.name);
    const result = await uploadMediaAction(formData);
    setBusy(false);
    if (result.error || !result.mediaId || !result.mediaUrl) {
      setError(result.error ?? t("uploadFailed"));
      return;
    }
    onChange({ kind, mediaId: result.mediaId, url: result.mediaUrl });
  };

  const generate = async () => {
    const text = prompt.trim();
    if (!text) return;
    setBusy(true);
    setError(null);
    const result = await generateAdImageAction(text, aspect);
    setBusy(false);
    if (isAdsError(result)) {
      setError(result.error);
      return;
    }
    onChange({ kind: "image", mediaId: result.data.mediaId, url: result.data.url });
  };

  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-[--radius] border border-border bg-muted p-2">
        <MediaThumb media={value} />
        <span className="min-w-0 flex-1 text-sm text-foreground">{t(value.kind === "video" ? "chosenVideo" : "chosenImage")}</span>
        <Button
          variant="ghost"
          size="sm"
          title={t("remove")}
          icon={<Trash className="h-4 w-4" />}
          iconVisible
          iconSide="left"
          onClick={() => onChange(null)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {generates ? (
        <ElevatedPillToggle<Mode>
          size="sm"
          value={mode}
          onChange={setMode}
          options={[
            { value: "upload", label: t("modeUpload"), icon: <UploadSimple className="h-3.5 w-3.5" /> },
            { value: "generate", label: t("modeGenerate"), icon: <Sparkle className="h-3.5 w-3.5" /> },
          ]}
        />
      ) : null}

      {mode === "upload" || !generates ? (
        <div className="space-y-1.5">
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT[accept]}
            className="sr-only"
            onChange={(event) => {
              void upload(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          <Button
            variant="secondary"
            title={busy ? t("uploading") : t(`upload.${accept}`)}
            icon={<UploadSimple className="h-4 w-4" />}
            iconVisible
            iconSide="left"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          />
          <p className="text-xs text-muted-foreground">{t(`uploadHint.${accept}`)}</p>
        </div>
      ) : (
        <div className="space-y-2">
          <ElevatedTextarea
            label={t("prompt")}
            value={prompt}
            maxLength={MAX_PROMPT}
            onChange={(event) => setPrompt(event.target.value)}
            autoResize
            maxHeight={200}
          />
          <ElevatedPillToggle<AdImageAspect>
            size="sm"
            value={aspect}
            onChange={setAspect}
            options={ASPECTS.map((option) => ({ value: option, label: t(`aspect.${option}`) }))}
          />
          <p className="text-xs text-muted-foreground">{t("costNote")}</p>
          <Button
            variant="secondary"
            title={busy ? t("generating") : t("generate")}
            icon={<Sparkle className="h-4 w-4" />}
            iconVisible
            iconSide="left"
            disabled={busy || prompt.trim() === ""}
            onClick={() => void generate()}
          />
        </div>
      )}
      {error ? <p className="text-xs text-destructive-ink">{error}</p> : null}
    </div>
  );
}
