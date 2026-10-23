"use client";

import { useTranslations } from "next-intl";

import { ScreenLoader } from "@/components/brand/screen-loader";
import { EmailThumbnail, StarterGallery } from "@/components/email-editor";
import { Files } from "@/components/icons";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/elevated-design/elevated-tabs";
import { Notice } from "@/components/ui/notice";
import { useEmailDesigns, useEmailStarters } from "@/hooks/use-email-campaigns";
import type { Document } from "@/lib/email-design/types";

import { useEmailFormat } from "../shared";

const SAVED_DESIGNS_SHOWN = 60;

export function DocumentPicker({ onPick, showSaved = true }: { onPick: (document: Document) => void; showSaved?: boolean }) {
  const t = useTranslations("emailCampaigns.picker");
  const starters = useEmailStarters();
  const designs = useEmailDesigns({ kind: "template", pageSize: SAVED_DESIGNS_SHOWN }, showSaved);
  const { date } = useEmailFormat();

  const starterPane = starters.isPending ? (
    <ScreenLoader fit="fill" className="min-h-[320px]" />
  ) : starters.isError ? (
    <Notice tone="fault" title={t("startersFailed")} />
  ) : (
    <StarterGallery starters={starters.data?.items ?? []} onPick={onPick} />
  );

  if (!showSaved) return starterPane;

  const saved = designs.data?.items ?? [];

  return (
    <Tabs defaultValue="starters" className="w-full">
      <TabsList>
        <TabsTrigger value="starters">{t("starters")}</TabsTrigger>
        <TabsTrigger value="saved">{t("saved", { count: designs.data?.total ?? 0 })}</TabsTrigger>
      </TabsList>
      <TabsContent value="starters" className="mt-4">
        {starterPane}
      </TabsContent>
      <TabsContent value="saved" className="mt-4">
        {designs.isPending ? (
          <ScreenLoader fit="fill" className="min-h-[320px]" />
        ) : saved.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-control-edge px-6 py-10 text-center">
            <Files className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm font-semibold text-foreground">{t("noSaved")}</p>
            <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">{t("noSavedHint")}</p>
          </div>
        ) : (
          <ul aria-label={t("saved", { count: saved.length })} className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-px overflow-hidden rounded-lg border border-border bg-border">
            {saved.map((design) => (
              <li key={design.id} className="bg-card">
                <button
                  type="button"
                  onClick={() => onPick(structuredClone(design.document))}
                  className="group flex h-full w-full flex-col items-center gap-3 p-3 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <span className="block overflow-hidden rounded-[--radius] border border-border shadow-sm transition-shadow duration-150 group-hover:shadow-md">
                    <EmailThumbnail document={design.document} />
                  </span>
                  <span className="block w-full">
                    <span className="block truncate text-sm font-semibold text-foreground">{design.name}</span>
                    <span className="mt-0.5 block text-2xs text-muted-foreground">{t("updated", { date: date(design.updated_at) })}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </TabsContent>
    </Tabs>
  );
}
