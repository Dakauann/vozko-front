"use client";

import { Fragment } from "react";
import { useStore } from "zustand";
import { useTranslations } from "next-intl";

import { ArrowLeft, CaretRight, Stack } from "@/components/icons";
import { groupChain } from "@/lib/studio/group-scope";

import { useVideoEditor, useViewState } from "../editor-context";
import { useClipLabeler } from "../use-clip-label";

export function GroupBreadcrumb() {
  const t = useTranslations("studio.video.groups");
  const { root, commands } = useVideoEditor();
  const path = useViewState((s) => s.groupPath);
  const document = useStore(root, (s) => s.document);
  const label = useClipLabeler();
  if (path.length === 0) return null;
  const chain = groupChain(document, path);
  return (
    <nav aria-label={t("breadcrumb")} data-group-breadcrumb className="flex h-8 shrink-0 items-center gap-1 border-b border-border-strong bg-muted/60 px-2 text-xs">
      <button
        type="button"
        onClick={() => commands.closeGroup()}
        title={t("backHint")}
        className="flex h-6 items-center gap-1 rounded-[4px] px-1.5 font-medium text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
        {t("back")}
      </button>
      <span aria-hidden className="mx-1 h-4 w-px bg-border-strong" />
      <button type="button" onClick={() => commands.closeGroup(path.length)} className="rounded-[4px] px-1.5 py-0.5 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {t("film")}
      </button>
      {chain.map((group, index) => {
        const current = index === chain.length - 1;
        return (
          <Fragment key={group.id}>
            <CaretRight className="h-3 w-3 text-muted-foreground" aria-hidden />
            {current ? (
              <span aria-current="location" className="flex items-center gap-1 px-1.5 font-semibold text-foreground">
                <Stack className="h-3.5 w-3.5" aria-hidden />
                {label(group)}
              </span>
            ) : (
              <button type="button" onClick={() => commands.closeGroup(chain.length - 1 - index)} className="rounded-[4px] px-1.5 py-0.5 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {label(group)}
              </button>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}
