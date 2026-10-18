"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { updateWorkspaceGroupAction } from "@/app/actions/unofficial-whatsapp-groups";
import type { SeriesSibling, UpdateGroupPayload } from "@/lib/unofficial-whatsapp-groups/types";

import { parseSeriesConflict, type ConflictGroup } from "../kit/notices";
import { isAdminRefusal } from "./detail-model";

const SERIES_CONFLICT_TEXT = "some groups of the series could not be updated";

export function useSaveGroup(groupId: string, series: SeriesSibling[], onChanged: () => void, onConflict: (groups: ConflictGroup[] | null) => void) {
  const t = useTranslations("unofficialGroups.detail.settings");
  const tNoAdmin = useTranslations("unofficialGroups.kit.notices.noAdmin");
  const tConflict = useTranslations("unofficialGroups.kit.notices.seriesConflict");
  const [saving, setSaving] = useState(false);

  const save = useCallback(
    async (payload: UpdateGroupPayload, success: string) => {
      setSaving(true);
      onConflict(null);
      const result = await updateWorkspaceGroupAction(groupId, payload);
      setSaving(false);
      if (!result.error) {
        toast(success);
        onChanged();
        return true;
      }
      const groups = parseSeriesConflict(result.error, series);
      if (groups || (payload.applyToSeries && result.error.toLowerCase().includes(SERIES_CONFLICT_TEXT))) {
        onConflict(groups ?? []);
        toast.warning(tConflict("title"));
        onChanged();
        return false;
      }
      toast.error(t("saveFailed"), { description: isAdminRefusal(result.error) ? tNoAdmin("edit") : result.error });
      return false;
    },
    [groupId, series, onChanged, onConflict, t, tNoAdmin, tConflict],
  );

  return { saving, save };
}
