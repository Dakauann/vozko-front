"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";

import { isActionError } from "@/app/actions/action-result";
import { createStudioProjectAction } from "@/app/actions/studio";
import Button from "@/components/elevated-design/button";
import {
  ElevatedDialog,
  ElevatedDialogBody,
  ElevatedDialogContent,
  ElevatedDialogDescription,
  ElevatedDialogFooter,
  ElevatedDialogHeader,
  ElevatedDialogTitle,
} from "@/components/elevated-design/elevated-dialog";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { ElevatedSegmentedControl } from "@/components/elevated-design/elevated-segmented-control";
import { FilmStrip, Image as ImageIcon, WarningCircle } from "@/components/icons";
import { useRouter } from "@/i18n/routing";
import {
  emptyImageDocument,
  emptyVideoDocument,
  IMAGE_PRESETS,
  STUDIO_LIMITS,
  VIDEO_ASPECT_SIZES,
  VIDEO_ASPECTS,
  type CanvasSize,
  type ImagePresetId,
  type StudioKind,
  type VideoAspect,
} from "@/lib/studio/document";
import { editorPathFor } from "@/lib/studio/project";
import { canvasSizeIssue, projectNameIssue } from "@/lib/studio/validate";
import { cn } from "@/lib/utils";

type ImageChoice = ImagePresetId | "custom";

interface CreateProjectDialogProps {
  open: boolean;
  kind: StudioKind;
  onKindChange: (kind: StudioKind) => void;
  onOpenChange: (open: boolean) => void;
}

function AspectCard({ size, label, detail, selected, onSelect }: { size: CanvasSize; label: string; detail: string; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex flex-col items-center gap-2 rounded-[--radius] border bg-card p-3 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected ? "border-primary ring-1 ring-primary" : "border-border hover:bg-muted",
      )}
    >
      <span className="flex h-16 w-full items-center justify-center" aria-hidden>
        <span className="block max-h-full max-w-[64px] rounded-sm border border-border-strong bg-muted" style={{ aspectRatio: `${size.width} / ${size.height}`, height: size.height >= size.width ? "100%" : "auto", width: size.width > size.height ? "100%" : "auto" }} />
      </span>
      <span className="text-xs font-medium text-foreground">{label}</span>
      <span className="text-[11px] tabular-nums text-muted-foreground">{detail}</span>
    </button>
  );
}

function parseSide(value: string): number {
  return value.trim() === "" ? Number.NaN : Number(value);
}

export function CreateProjectDialog({ open, kind, onKindChange, onOpenChange }: CreateProjectDialogProps) {
  const t = useTranslations("studio");
  const router = useRouter();
  const [imageChoice, setImageChoice] = useState<ImageChoice>("instagram_post");
  const [aspect, setAspect] = useState<VideoAspect>("story");
  const [customWidth, setCustomWidth] = useState("1080");
  const [customHeight, setCustomHeight] = useState("1080");
  const [name, setName] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shownName = nameTouched ? name : t(`create.defaultName.${kind}`);
  const customSize: CanvasSize = { width: parseSide(customWidth), height: parseSide(customHeight) };
  const imageSize: CanvasSize = imageChoice === "custom" ? customSize : IMAGE_PRESETS.find((p) => p.id === imageChoice)!;
  const sizeIssue = kind === "image" ? canvasSizeIssue(imageSize) : null;
  const nameIssue = projectNameIssue(shownName);
  const limits = { min: STUDIO_LIMITS.minCanvasSide, max: STUDIO_LIMITS.maxCanvasSide };
  const nameError = nameIssue ? (nameIssue.code === "required" ? t("issues.nameRequired") : t("issues.nameTooLarge", { max: STUDIO_LIMITS.maxProjectNameRunes })) : undefined;

  const close = (next: boolean) => {
    if (submitting) return;
    if (!next) setError(null);
    onOpenChange(next);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting || nameIssue || sizeIssue) return;
    setSubmitting(true);
    setError(null);
    const document = kind === "image" ? emptyImageDocument(imageSize) : emptyVideoDocument(aspect);
    const result = await createStudioProjectAction({ kind, name: shownName, document });
    if (isActionError(result)) {
      setSubmitting(false);
      setError(result.error);
      return;
    }
    const path = editorPathFor(result.data);
    if (!path) {
      setSubmitting(false);
      setError(t("create.failed"));
      return;
    }
    setSubmitting(false);
    onOpenChange(false);
    router.push(path);
  };

  return (
    <ElevatedDialog open={open} onOpenChange={close}>
      <ElevatedDialogContent className="max-w-2xl">
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <ElevatedDialogHeader>
            <ElevatedDialogTitle>{t("create.title")}</ElevatedDialogTitle>
            <ElevatedDialogDescription>{t("create.description")}</ElevatedDialogDescription>
          </ElevatedDialogHeader>
          <ElevatedDialogBody className="space-y-5">
            <fieldset className="space-y-2">
              <legend className="legend">{t("create.kind")}</legend>
              <ElevatedSegmentedControl
                options={[
                  { value: "image", label: t("kinds.image"), icon: <ImageIcon className="h-4 w-4" /> },
                  { value: "video", label: t("kinds.video"), icon: <FilmStrip className="h-4 w-4" /> },
                ]}
                value={kind}
                onChange={(value) => onKindChange(value as StudioKind)}
                size="sm"
                columns={2}
              />
            </fieldset>

            {kind === "image" ? (
              <fieldset className="space-y-2">
                <legend className="legend">{t("create.size")}</legend>
                <div className="grid max-h-[22rem] grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-4">
                  {IMAGE_PRESETS.map((preset) => (
                    <AspectCard
                      key={preset.id}
                      size={preset}
                      label={t(`presets.${preset.id}`)}
                      detail={t("create.dimensions", { width: preset.width, height: preset.height })}
                      selected={imageChoice === preset.id}
                      onSelect={() => setImageChoice(preset.id)}
                    />
                  ))}
                  <AspectCard
                    size={canvasSizeIssue(customSize) ? { width: 1, height: 1 } : customSize}
                    label={t("create.custom")}
                    detail={canvasSizeIssue(customSize) ? t("create.sizeHint", limits) : t("create.dimensions", { ...customSize })}
                    selected={imageChoice === "custom"}
                    onSelect={() => setImageChoice("custom")}
                  />
                </div>
                {imageChoice === "custom" ? (
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <ElevatedInput
                      type="number"
                      inputMode="numeric"
                      min={STUDIO_LIMITS.minCanvasSide}
                      max={STUDIO_LIMITS.maxCanvasSide}
                      step={1}
                      label={t("create.width")}
                      value={customWidth}
                      onChange={(e) => setCustomWidth(e.target.value)}
                      controlSize="sm"
                    />
                    <ElevatedInput
                      type="number"
                      inputMode="numeric"
                      min={STUDIO_LIMITS.minCanvasSide}
                      max={STUDIO_LIMITS.maxCanvasSide}
                      step={1}
                      label={t("create.height")}
                      value={customHeight}
                      onChange={(e) => setCustomHeight(e.target.value)}
                      controlSize="sm"
                    />
                    {sizeIssue ? <p className="col-span-2 text-xs text-destructive-ink">{t("issues.canvasOutOfRange", limits)}</p> : null}
                  </div>
                ) : null}
              </fieldset>
            ) : (
              <fieldset className="space-y-2">
                <legend className="legend">{t("create.aspect")}</legend>
                <div className="grid grid-cols-3 gap-2">
                  {VIDEO_ASPECTS.map((value) => (
                    <AspectCard
                      key={value}
                      size={VIDEO_ASPECT_SIZES[value]}
                      label={t(`aspects.${value}`)}
                      detail={t("create.dimensions", { ...VIDEO_ASPECT_SIZES[value] })}
                      selected={aspect === value}
                      onSelect={() => setAspect(value)}
                    />
                  ))}
                </div>
              </fieldset>
            )}

            <ElevatedInput
              label={t("create.name")}
              value={shownName}
              maxLength={STUDIO_LIMITS.maxProjectNameRunes + 20}
              onChange={(e) => {
                setNameTouched(true);
                setName(e.target.value);
              }}
              error={nameError}
              controlSize="sm"
            />

            {error ? (
              <p role="alert" className="flex items-center gap-2 text-sm text-destructive-ink">
                <WarningCircle className="h-4 w-4 shrink-0" aria-hidden />
                {t("create.failed")} {error}
              </p>
            ) : null}
          </ElevatedDialogBody>
          <ElevatedDialogFooter>
            <Button type="button" variant="ghost" title={t("create.cancel")} onClick={() => close(false)} disabled={submitting} />
            <Button type="submit" variant="primary" title={submitting ? t("create.creating") : t("create.submit")} disabled={submitting || Boolean(nameIssue) || Boolean(sizeIssue)} />
          </ElevatedDialogFooter>
        </form>
      </ElevatedDialogContent>
    </ElevatedDialog>
  );
}
