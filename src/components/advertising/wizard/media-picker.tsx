"use client";

import { useRef, useState, type ClipboardEvent } from "react";
import { useTranslations } from "next-intl";

import { uploadMediaAction } from "@/app/actions/medias";
import Button from "@/components/elevated-design/button";
import ElevatedPillToggle from "@/components/elevated-design/elevated-pill-toggle";
import ElevatedTextarea from "@/components/elevated-design/elevated-textarea";
import { PencilSimple, Play, Plus, Sparkle, Stack, Trash, UploadSimple } from "@/components/icons";
import { GeneratingMedia } from "@/components/media-generation/generating-media";
import { MediaModelSelect } from "@/components/media-generation/media-model-select";
import { ReferenceThumbnails, type ReferenceThumbnail } from "@/components/media-generation/reference-thumbnails";
import { MediaDownloadButton } from "@/components/media/media-download-button";
import { useMediaGeneration, type MediaGenerationError } from "@/hooks/use-media-generation";
import { useMediaLibrary } from "@/hooks/use-media-library";
import type { MediaChoice } from "@/lib/advertising/draft";
import type { AdMediaKind } from "@/lib/advertising/draft-types";
import { libraryChoices } from "@/lib/advertising/library-media";
import { firstFrameSrc } from "@/lib/media/first-frame";
import { withReference } from "@/lib/media-generation/references";
import { MAX_REFERENCE_IMAGES, type ImageAspect } from "@/lib/media-generation/types";

import { AdImage } from "../ad-image";

type Mode = "upload" | "library" | "generate";
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
  "cost_unreported",
]);

function generationErrorKey(error: MediaGenerationError): string {
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
          <video src={firstFrameSrc(media.url)} muted playsInline preload="metadata" className="h-full w-full object-cover" />
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
  landscape: "w-48",
};

function GeneratingPreview({ aspect, settling }: { aspect: ImageAspect; settling: boolean }) {
  const t = useTranslations("adsWizard.media");
  return (
    <div role="status" aria-live="polite" className="flex items-center gap-4 rounded-[--radius] border border-border bg-muted p-3">
      <GeneratingMedia kind="image" frame={aspect} settling={settling} className={`${PREVIEW_WIDTH[aspect]} shrink-0 bg-background px-3`} />
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">{t("generatingTitle")}</p>
        <p className="text-xs text-muted-foreground">{t("generatingHint")}</p>
      </div>
    </div>
  );
}

function LibraryPane({ accept, onPick }: { accept: MediaAccept; onPick: (media: MediaChoice) => void }) {
  const t = useTranslations("adsWizard.media.library");
  const library = useMediaLibrary();
  if (library.status === "loading") return <p className="text-xs text-muted-foreground">{t("loading")}</p>;
  if (library.status === "failed") {
    return (
      <div role="alert" className="flex flex-wrap items-center gap-2 text-xs text-destructive-ink">
        {t("failed")}
        <Button variant="ghost" size="sm" title={t("retry")} onClick={library.reload} />
      </div>
    );
  }
  const choices = libraryChoices(library.medias, accept);
  if (choices.length === 0) return <p className="text-xs text-muted-foreground">{t(`empty.${accept}`)}</p>;
  return (
    <ul className="grid max-h-64 grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-5" aria-label={t(`label.${accept}`)}>
      {choices.map((choice) => (
        <li key={choice.mediaId}>
          <button
            type="button"
            onClick={() => onPick(choice)}
            aria-label={t(choice.kind === "video" ? "pickVideo" : "pickImage")}
            className="block w-full rounded-[--radius] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <MediaThumb media={choice} className="relative block aspect-square w-full overflow-hidden rounded-[--radius] bg-muted" />
          </button>
        </li>
      ))}
    </ul>
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
  const generation = useMediaGeneration({
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
      kind: "image",
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
      <ElevatedPillToggle<Mode>
        size="sm"
        value={mode}
        onChange={setMode}
        options={[
          { value: "upload", label: t("modeUpload"), icon: <UploadSimple className="h-3.5 w-3.5" /> },
          { value: "library", label: t("modeLibrary"), icon: <Stack className="h-3.5 w-3.5" /> },
          ...(generates ? [{ value: "generate" as const, label: t("modeGenerate"), icon: <Sparkle className="h-3.5 w-3.5" /> }] : []),
        ]}
      />

      {mode === "library" ? (
        <LibraryPane accept={accept} onPick={onChange} />
      ) : mode === "upload" || !generates ? (
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
          <MediaModelSelect kind="image" value={model} onChange={setModel} disabled={generating} />
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
          {generating ? <GeneratingPreview aspect={aspect} settling={generation.settling} /> : null}
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
