"use client";

import { useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { useEntryConversation } from "@/hooks/use-entry-conversation";
import {
  acceptsAttachments,
  acceptsVoiceNotes,
  attachmentAccept,
  attachmentMegabytes,
  attachmentRefusal,
  attachmentTypeNames,
  composerMediaLimits,
  type AttachmentRefusal,
} from "@/lib/conversations/attachment-rules";
import type { EntryType } from "@/lib/conversations/types";

export interface AttachmentAdmission {
  accept: string;
  takesAttachments: boolean;
  voiceNotes: boolean;
  admit: (file: File) => boolean;
}

export function useAttachmentAdmission(entryId: string, entryType: EntryType): AttachmentAdmission {
  const t = useTranslations("crmComposer.attachments");
  const serverLimits = useEntryConversation(entryId, entryType)?.media_limits;
  const limits = useMemo(() => composerMediaLimits(entryType, serverLimits), [entryType, serverLimits]);

  const refusalCopy = useCallback(
    (name: string, refusal: AttachmentRefusal): string => {
      switch (refusal.reason) {
        case "unknown":
          return t("channelLimitsUnknown", { name });
        case "none":
          return t("channelTakesNone", { name });
        case "size":
          return t("channelRefusedSize", { name, limit: attachmentMegabytes(refusal.maxBytes) });
        case "type": {
          const types = attachmentTypeNames(limits).map((entry) => ("kind" in entry ? t(`anyOfKind.${entry.kind}`) : entry.format));
          return t("channelRefusedType", { name, types: types.join(", ") });
        }
      }
    },
    [limits, t],
  );

  const admit = useCallback(
    (file: File) => {
      const refusal = attachmentRefusal(file, limits);
      if (refusal === null) return true;
      toast.error(refusalCopy(file.name, refusal));
      return false;
    },
    [limits, refusalCopy],
  );

  return useMemo(
    () => ({
      accept: attachmentAccept(limits),
      takesAttachments: acceptsAttachments(limits),
      voiceNotes: acceptsVoiceNotes(limits),
      admit,
    }),
    [admit, limits],
  );
}
