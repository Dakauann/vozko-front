"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { MediaPicker } from "@/components/advertising/wizard/media-picker";
import Button from "@/components/elevated-design/button";
import { ImageSquare, X } from "@/components/icons";
import { useWorkspace } from "@/contexts/workspace-context";
import type { ImageAspect } from "@/lib/media-generation/types";

const EMAIL_ASPECTS: readonly ImageAspect[] = ["landscape", "square", "portrait"];

export function ImageSource({ disabled, onPick }: { disabled: boolean; onPick: (url: string) => void }) {
  const t = useTranslations("emailEditor.inspector.imageSource");
  const { can } = useWorkspace();
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-2" data-email-field="image_source">
      <Button
        variant="secondary"
        size="sm"
        title={open ? t("close") : t("choose")}
        icon={open ? <X className="h-4 w-4" /> : <ImageSquare className="h-4 w-4" />}
        iconVisible
        iconSide="left"
        disabled={disabled}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      />
      {open ? (
        <div className="rounded-lg border border-border bg-card p-3">
          <MediaPicker
            value={null}
            accept="image"
            aspects={EMAIL_ASPECTS}
            canGenerate={can("media", "create")}
            onChange={(media) => {
              if (!media) return;
              onPick(media.url);
              setOpen(false);
            }}
          />
          <p className="mt-2 text-2xs leading-relaxed text-muted-foreground">{t("hint")}</p>
        </div>
      ) : null}
    </div>
  );
}
