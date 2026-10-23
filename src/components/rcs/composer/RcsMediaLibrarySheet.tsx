"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { resolveRcsMediaAction } from "@/app/actions/rcs";
import { MediaPicker } from "@/components/advertising/wizard/media-picker";
import { CampaignMediaPicker } from "@/components/campaigns/CampaignMediaPicker";
import ElevatedPillToggle from "@/components/elevated-design/elevated-pill-toggle";
import {
  ElevatedSheet,
  ElevatedSheetContent,
  ElevatedSheetDescription,
  ElevatedSheetHeader,
  ElevatedSheetTitle,
} from "@/components/elevated-design/elevated-sheet";
import { CircleNotch, FileText, Image as ImageGlyph, Waveform } from "@/components/icons";
import { Notice } from "@/components/ui/notice";
import type { CodedRefusal } from "@/lib/api/coded-error";
import { useCarrierErrorText } from "@/components/carrier-messaging/shared/use-carrier-error-text";
import { RCS_MEDIA_MIME_TYPES } from "@/lib/rcs/limits";
import type { RcsMedia, RcsMediaKind } from "@/lib/rcs/types";

type MediaGroup = "visual" | "audio" | "pdf";

const GROUP_KINDS: Record<MediaGroup, readonly RcsMediaKind[]> = {
  visual: ["image", "video"],
  audio: ["audio"],
  pdf: ["pdf"],
};

const GROUP_ICONS = { visual: ImageGlyph, audio: Waveform, pdf: FileText };

const UPLOAD_KIND: Record<Exclude<MediaGroup, "visual">, string> = { audio: "audio", pdf: "document" };

function groupsFor(kinds: readonly RcsMediaKind[]): MediaGroup[] {
  return (Object.keys(GROUP_KINDS) as MediaGroup[]).filter((group) => GROUP_KINDS[group].some((kind) => kinds.includes(kind)));
}

function SheetBody({ kinds, onPicked }: { kinds: readonly RcsMediaKind[]; onPicked: (media: RcsMedia) => void }) {
  const t = useTranslations("rcs");
  const errorText = useCarrierErrorText();
  const groups = groupsFor(kinds);
  const [group, setGroup] = useState<MediaGroup>(groups[0] ?? "visual");
  const [resolving, setResolving] = useState(false);
  const [refusal, setRefusal] = useState<CodedRefusal | null>(null);

  const resolve = async (mediaId: string | undefined) => {
    if (!mediaId) return;
    setResolving(true);
    setRefusal(null);
    const answer = await resolveRcsMediaAction({ media_id: mediaId });
    setResolving(false);
    if (answer.data) {
      onPicked(answer.data);
      return;
    }
    setRefusal(answer.error);
  };

  return (
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 pb-6 pt-2">
      {groups.length > 1 ? (
        <ElevatedPillToggle<MediaGroup>
          size="md"
          aria-label={t("media.groupLabel")}
          value={group}
          onChange={setGroup}
          options={groups.map((value) => {
            const Glyph = GROUP_ICONS[value];
            return { value, label: t(`media.groups.${value}`), icon: <Glyph aria-hidden className="h-3.5 w-3.5" /> };
          })}
        />
      ) : null}
      {group === "visual" ? (
        <MediaPicker value={null} accept="any" canGenerate={false} onChange={(choice) => void resolve(choice?.mediaId)} />
      ) : (
        <div className="space-y-2">
          <CampaignMediaPicker
            key={group}
            kind={UPLOAD_KIND[group]}
            accept={RCS_MEDIA_MIME_TYPES[group].join(",")}
            onChange={(next) => void resolve(next.mediaId)}
            disabled={resolving}
            labels={{
              upload: t(`media.upload.${group}`),
              uploading: t("media.uploading"),
              remove: t("media.remove"),
              failed: t("media.uploadFailed"),
            }}
          />
          <p className="text-xs text-muted-foreground">{t(`media.uploadHint.${group}`)}</p>
        </div>
      )}
      {resolving ? (
        <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground">
          <CircleNotch aria-hidden className="h-4 w-4 animate-spin" />
          {t("media.resolving")}
        </p>
      ) : null}
      {refusal ? (
        <Notice tone="fault" title={t("media.refusedTitle")}>
          <p>{errorText(refusal.code)}</p>
        </Notice>
      ) : null}
    </div>
  );
}

export function RcsMediaLibrarySheet({
  open,
  kinds,
  onOpenChange,
  onPicked,
}: {
  open: boolean;
  kinds: readonly RcsMediaKind[];
  onOpenChange: (open: boolean) => void;
  onPicked: (media: RcsMedia) => void;
}) {
  const t = useTranslations("rcs.media");
  return (
    <ElevatedSheet open={open} onOpenChange={onOpenChange}>
      <ElevatedSheetContent side="right" className="flex w-full flex-col gap-0 sm:max-w-lg">
        <ElevatedSheetHeader className="space-y-1 border-b border-border pr-16">
          <ElevatedSheetTitle className="text-xl">{t("sheetTitle")}</ElevatedSheetTitle>
          <ElevatedSheetDescription>{t("sheetDescription")}</ElevatedSheetDescription>
        </ElevatedSheetHeader>
        {open ? <SheetBody kinds={kinds} onPicked={onPicked} /> : null}
      </ElevatedSheetContent>
    </ElevatedSheet>
  );
}
