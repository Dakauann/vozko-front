"use client";

import { useRef, useState, type ClipboardEvent } from "react";
import { useTranslations } from "next-intl";

import { uploadMediaAction } from "@/app/actions/medias";
import Button from "@/components/elevated-design/button";
import ElevatedPillToggle from "@/components/elevated-design/elevated-pill-toggle";
import ElevatedTextarea from "@/components/elevated-design/elevated-textarea";
import { PencilSimple, Play, Plus, Sparkle, Trash, UploadSimple } from "@/components/icons";
import { GeneratingImage } from "@/components/image-generation/generating-image";
import { ImageModelSelect } from "@/components/image-generation/image-model-select";
import { ReferenceThumbnails, type ReferenceThumbnail } from "@/components/image-generation/reference-thumbnails";
import { MediaDownloadButton } from "@/components/media/media-download-button";
import { useImageGeneration, type ImageGenerationError } from "@/hooks/use-image-generation";
import type { MediaChoice } from "@/lib/advertising/draft";
import type { AdMediaKind } from "@/lib/advertising/draft-types";
import { withReference } from "@/lib/image-generation/references";
import { MAX_REFERENCE_IMAGES, type ImageAspect } from "@/lib/image-generation/types";

import { AdImage } from "../ad-image";

type Mode = "upload" | "generate";
export type MediaAccept = AdMediaKind | "any";

const ASPECTS: ImageAspect[] = ["square", "portrait", "story"];
const MAX_PROMPT = 4000;
const ACCEPT: Record<MediaAccept, string> = {
  image: "image/jpeg,image/png",
  video: "video/mp4,video/quicktime",
  any: "image/jpeg,image/png,video/mp4,video/quicktime",
};

const GENERATION_ERROR_CODES = new Set([
  "generation_failed",
  "storage_failed",
  "timed_out",
  "enqueue_failed",
  "poll_failed",
  "missing_media",
  "insufficient_balance",
  "insufficient_funds",
  "no_subscription",
  "already_generating",
  "reference_unavailable",
  "invalid_request",
]);

function generationErrorKey(error: ImageGenerationError): string {
  return `generationErrors.${GENERATION_ERROR_CODES.has(error.code) ? error.code : "unknown"}`;
}

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

const PREVIEW_WIDTH: Record<ImageAspect, string> = {
  square: "w-40",
  portrait: "w-36",
  story: "w-28",
};

function GeneratingPreview({ aspect }: { aspect: ImageAspect }) {
  const t = useTranslations("adsWizard.media");
  return (
    <div role="status" aria-live="polite" className="flex items-center gap-4 rounded-[--radius] border border-border bg-muted p-3">
      <GeneratingImage aspect={aspect} className={`${PREVIEW_WIDTH[aspect]} shrink-0 bg-background px-3`} />
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">{t("generatingTitle")}</p>
        <p className="text-xs text-muted-foreground">{t("generatingHint")}</p>
      </div>
    </div>
  );
}

type LibraryUpload = { mediaId: string; url: string } | { error: string | null };

async function sendToLibrary(file: File, kind: AdMediaKind): Promise<LibraryUpload> {
  const formData = new FormData();
  formData.append("media", file);
  formData.append("mediaType", kind);
  formData.append("description", file.name);
  const result = await uploadMediaAction(formData);
  if (result.error || !result.mediaId || !result.mediaUrl) return { error: result.error ?? null };
  return { mediaId: result.mediaId, url: result.mediaUrl };
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
  const referenceRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>("upload");
  const [references, setReferences] = useState<ReferenceThumbnail[]>([]);
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState<string | null>(null);
  const [aspect, setAspect] = useState<ImageAspect>("square");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generation = useImageGeneration({
    onDone: ({ mediaId, mediaUrl }) => onChange({ kind: "image", mediaId, url: mediaUrl }),
  });
  const generating = generation.status === "generating";
  const busy = uploading || generating;
  const canAddReference = !busy && references.length < MAX_REFERENCE_IMAGES;
  const generates = canGenerate && accept !== "video";

  const upload = async (file: File | undefined) => {
    if (!file) return;
    const kind = kindOf(file);
    if (!kind || (accept !== "any" && kind !== accept)) {
      setError(t(accept === "video" ? "notVideo" : accept === "image" ? "notImage" : "notMedia"));
      return;
    }
    setUploading(true);
    setError(null);
    const result = await sendToLibrary(file, kind);
    setUploading(false);
    if ("error" in result) {
      setError(result.error ?? t("uploadFailed"));
      return;
    }
    onChange({ kind, mediaId: result.mediaId, url: result.url });
  };

  const addReference = async (file: File | undefined) => {
    if (!file) return;
    if (kindOf(file) !== "image") {
      setError(t("notImage"));
      return;
    }
    setUploading(true);
    setError(null);
    const result = await sendToLibrary(file, "image");
    setUploading(false);
    if ("error" in result) {
      setError(result.error ?? t("uploadFailed"));
      return;
    }
    setReferences((current) => withReference(current, { mediaId: result.mediaId, url: result.url }));
  };

  const pasteReferences = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const images = Array.from(event.clipboardData.files).filter((file) => kindOf(file) === "image");
    if (images.length === 0 || !canAddReference) return;
    event.preventDefault();
    void images.reduce((chain, file) => chain.then(() => addReference(file)), Promise.resolve());
  };

  const editWithAi = (image: MediaChoice) => {
    setReferences((current) => withReference(current, { mediaId: image.mediaId, url: image.url }));
    setPrompt("");
    setError(null);
    setMode("generate");
    onChange(null);
  };

  const removeReference = (mediaId: string) =>
    setReferences((current) => current.filter((item) => item.mediaId !== mediaId));

  const generate = () => {
    const text = prompt.trim();
    if (!text || !model) return;
    setError(null);
    void generation.start({
      model,
      prompt: text,
      aspect,
      referenceMediaIds: references.map((item) => item.mediaId),
    });
  };

  const shownError = error ?? (generation.error ? t(generationErrorKey(generation.error)) : null);

  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-[--radius] border border-border bg-muted p-2">
        <MediaThumb media={value} />
        <span className="flex min-w-0 flex-1 flex-col items-start gap-1 text-sm text-foreground">
          {t(value.kind === "video" ? "chosenVideo" : "chosenImage")}
          {value.kind === "image" ? (
            <MediaDownloadButton mediaId={value.mediaId} description={prompt.trim() || t("chosenImage")} className="text-xs" />
          ) : null}
        </span>
        {generates && value.kind === "image" ? (
          <Button
            variant="ghost"
            size="sm"
            title={t("editWithAi")}
            icon={<PencilSimple className="h-4 w-4" />}
            iconVisible
            iconSide="left"
            onClick={() => editWithAi(value)}
          />
        ) : null}
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
            title={uploading ? t("uploading") : t(`upload.${accept}`)}
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
            onPaste={pasteReferences}
            disabled={generating}
            autoResize
            maxHeight={200}
          />
          <ElevatedPillToggle<ImageAspect>
            size="sm"
            value={aspect}
            onChange={setAspect}
            options={ASPECTS.map((option) => ({ value: option, label: t(`aspect.${option}`), disabled: generating }))}
          />
          <ImageModelSelect value={model} onChange={setModel} disabled={generating} />
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-foreground">{t("references")}</p>
            {references.length > 0 ? (
              <ReferenceThumbnails
                items={references}
                removeLabel={t("removeReference")}
                onRemove={generating ? undefined : removeReference}
              />
            ) : null}
            <input
              ref={referenceRef}
              type="file"
              accept={ACCEPT.image}
              aria-label={t("addReference")}
              className="sr-only"
              onChange={(event) => {
                void addReference(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
            <Button
              variant="ghost"
              size="sm"
              title={t("addReference")}
              icon={<Plus className="h-3.5 w-3.5" />}
              iconVisible
              iconSide="left"
              disabled={!canAddReference}
              onClick={() => referenceRef.current?.click()}
            />
            <p className="text-xs text-muted-foreground">{t("referencesHint", { max: MAX_REFERENCE_IMAGES })}</p>
          </div>
          {generating ? <GeneratingPreview aspect={aspect} /> : null}
          <p className="text-xs text-muted-foreground">{t("costNote")}</p>
          <Button
            variant="secondary"
            title={generating ? t("generating") : t("generate")}
            icon={<Sparkle className="h-4 w-4" />}
            iconVisible
            iconSide="left"
            disabled={busy || prompt.trim() === "" || !model}
            onClick={generate}
          />
        </div>
      )}
      {shownError ? <p className="text-xs text-destructive-ink">{shownError}</p> : null}
    </div>
  );
}
