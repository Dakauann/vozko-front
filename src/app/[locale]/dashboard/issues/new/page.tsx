"use client";

import {
  ArrowLeft,
  Image as ImageIcon,
  PaperPlaneTilt,
  SpinnerGap,
  Warning,
  X,
} from "@phosphor-icons/react";

import Button from "@/components/elevated-design/button";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { cn } from "@/lib/utils";
import { createIssueAction } from "@/app/actions/issues";
import { motion } from "framer-motion";
import { uploadMediaAction } from "@/app/actions/medias";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useWorkspace } from "@/contexts/workspace-context";

const TITLE_MAX = 255;
const DESCRIPTION_MAX = 1000;
const MAX_IMAGES = 5;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; 
const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

interface ImagePreview {
  id: string;
  preview: string;
  url?: string;
  uploading: boolean;
}

export default function NewIssuePage() {
  const t = useTranslations("issuesPage");
  const router = useRouter();
  const { currentWorkspace } = useWorkspace();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<ImagePreview[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      errors.title = t("form.error.titleRequired");
    } else if (trimmedTitle.length > TITLE_MAX) {
      errors.title = t("form.error.titleTooLong");
    }

    if (description.trim().length > DESCRIPTION_MAX) {
      errors.description = t("form.error.descriptionTooLong");
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const remaining = MAX_IMAGES - images.length;
    const toProcess = Array.from(files).slice(0, remaining);

    for (const file of toProcess) {
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        setError(t("form.error.invalidImageType"));
        continue;
      }
      if (file.size > MAX_IMAGE_SIZE) {
        setError(t("form.error.imageTooLarge"));
        continue;
      }

      const localId = crypto.randomUUID();
      const reader = new FileReader();
      reader.onload = (ev) => {
        const preview = ev.target?.result as string;
        setImages((prev) => [
          ...prev,
          { id: localId, preview, uploading: true },
        ]);
      };
      reader.readAsDataURL(file);

      const formData = new FormData();
      formData.append("media", file);
      formData.append("mediaType", "image");
      formData.append("description", "issue-attachment");

      const result = await uploadMediaAction(formData);
      if (result.error || !result.mediaUrl) {
        setImages((prev) => prev.filter((img) => img.id !== localId));
        setError(t("form.error.imageUploadFailed"));
      } else {
        setImages((prev) =>
          prev.map((img) =>
            img.id === localId
              ? { ...img, url: result.mediaUrl!, uploading: false }
              : img,
          ),
        );
      }
    }
    e.target.value = "";
  };

  const handleRemoveImage = (id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    const uploading = images.some((img) => img.uploading);
    if (uploading) return;

    setSubmitting(true);
    setError(null);

    try {
      const imageUrls = images
        .map((img) => img.url)
        .filter((u): u is string => !!u);

      const result = await createIssueAction({
        title: title.trim(),
        description: description.trim(),
        imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      if (result.issue) {
        router.push(`/dashboard/issues/${result.issue.id}`);
      }
    } catch {
      setError(t("form.error.submitFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.main
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="w-full max-w-2xl mx-auto space-y-6 py-2"
    >
      {/* Back button */}
      <button
        type="button"
        onClick={() => router.push("/dashboard/issues")}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("form.back")}
      </button>

      {/* Form card */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-6">
        <div>
          <h1 className="text-lg font-semibold text-foreground">
            {t("form.title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("form.subtitle")}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Title */}
          <div className="space-y-1.5">
            <label
              htmlFor="issue-title"
              className="text-sm font-medium text-foreground"
            >
              {t("form.titleLabel")} <span className="text-destructive">*</span>
            </label>
            <ElevatedInput
              id="issue-title"
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (fieldErrors.title) {
                  setFieldErrors((prev) => {
                    const next = { ...prev };
                    delete next.title;
                    return next;
                  });
                }
              }}
              label={t("form.titlePlaceholder")}
              maxLength={TITLE_MAX}
              disabled={submitting}
              className="w-full"
            />
            <div className="flex justify-between">
              {fieldErrors.title ? (
                <p className="text-xs text-destructive">{fieldErrors.title}</p>
              ) : (
                <span />
              )}
              <span className="text-[10px] text-muted-foreground/50">
                {title.length}/{TITLE_MAX}
              </span>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label
              htmlFor="issue-description"
              className="text-sm font-medium text-foreground"
            >
              {t("form.descriptionLabel")}
            </label>
            <textarea
              id="issue-description"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                if (fieldErrors.description) {
                  setFieldErrors((prev) => {
                    const next = { ...prev };
                    delete next.description;
                    return next;
                  });
                }
              }}
              placeholder={t("form.descriptionPlaceholder")}
              rows={5}
              maxLength={DESCRIPTION_MAX}
              disabled={submitting}
              className={cn(
                "w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm",
                "placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                fieldErrors.description &&
                  "border-destructive ring-destructive",
              )}
            />
            <div className="flex justify-between">
              {fieldErrors.description ? (
                <p className="text-xs text-destructive">
                  {fieldErrors.description}
                </p>
              ) : (
                <span />
              )}
              <span className="text-[10px] text-muted-foreground/50">
                {description.length}/{DESCRIPTION_MAX}
              </span>
            </div>
          </div>

          {/* Images */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              {t("form.imagesLabel")}
            </label>

            {images.length > 0 && (
              <div className="flex flex-wrap gap-3">
                {images.map((img) => (
                  <div key={img.id} className="relative group">
                    <img
                      src={img.preview}
                      alt=""
                      className={cn(
                        "h-24 w-24 rounded-lg border border-border object-cover",
                        img.uploading && "opacity-50",
                      )}
                    />
                    {img.uploading && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <SpinnerGap className="h-5 w-5 animate-spin text-primary" />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(img.id)}
                      className="absolute -top-2 -right-2 rounded-full bg-destructive text-destructive-foreground p-0.5 shadow-sm hover:bg-destructive/80 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {images.length < MAX_IMAGES && (
              <label
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg border border-dashed border-input px-3 py-2 text-sm text-muted-foreground",
                  "hover:bg-muted cursor-pointer transition-colors",
                  submitting && "opacity-50 pointer-events-none",
                )}
              >
                <ImageIcon className="h-4 w-4" />
                {t("form.addImage")}
                <input
                  type="file"
                  accept={ALLOWED_IMAGE_TYPES.join(",")}
                  onChange={handleImageSelect}
                  multiple
                  className="sr-only"
                  disabled={submitting}
                />
              </label>
            )}
            <p className="text-[10px] text-muted-foreground/60">
              {t("form.imageHint", { max: MAX_IMAGES, current: images.length })}
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30 px-3 py-2">
              <Warning className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Submit */}
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="secondary"
              title={t("form.cancel")}
              onClick={() => router.push("/dashboard/issues")}
              disabled={submitting}
            />
            <button
              type="submit"
              disabled={
                submitting ||
                !title.trim() ||
                images.some((img) => img.uploading)
              }
              className={cn(
                "inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium",
                "hover:bg-primary/90 transition-colors",
                "disabled:opacity-50 disabled:cursor-not-allowed",
              )}
            >
              {submitting ? (
                <SpinnerGap className="h-4 w-4 animate-spin" />
              ) : (
                <PaperPlaneTilt className="h-4 w-4" />
              )}
              {t("form.submit")}
            </button>
          </div>
        </form>
      </div>
    </motion.main>
  );
}
