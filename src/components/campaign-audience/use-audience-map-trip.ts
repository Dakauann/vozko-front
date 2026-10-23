"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import type { LeadsPickDraft } from "@/lib/campaign-audience/draft";
import { mapTripHref, returnedAreasOf, type MapTrip } from "@/lib/campaign-audience/map-trip";
import type { AreaSelection } from "@/lib/leads/map-view";

export function useReturnedAreas(cleanHref: string | null): AreaSelection | null {
  const params = useSearchParams();
  const router = useRouter();
  const [returned] = useState(() => returnedAreasOf(params));
  const cleared = useRef(false);

  useEffect(() => {
    if (!returned || !cleanHref || cleared.current) return;
    cleared.current = true;
    router.replace(cleanHref, { scroll: false });
  }, [returned, cleanHref, router]);

  return returned;
}

export function useMapTrip(trip: MapTrip | null, save: () => Promise<boolean>): ((pick: LeadsPickDraft) => void) | undefined {
  const t = useTranslations("campaignAudience.step.map");
  const router = useRouter();
  const channel = trip?.channel;
  const draftId = trip?.draftId;
  const leave = useCallback(
    async (pick: LeadsPickDraft) => {
      if (!channel || !draftId) return;
      if (!(await save())) {
        toast.error(t("saveFirst"));
        return;
      }
      router.push(mapTripHref({ channel, draftId }, pick));
    },
    [channel, draftId, save, router, t],
  );
  const go = useCallback((pick: LeadsPickDraft) => void leave(pick), [leave]);
  return channel && draftId ? go : undefined;
}
