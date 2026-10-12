"use client";

import { useTranslations } from "next-intl";

import { ArrowUpRight, PuzzlePiece } from "@/components/icons";
import { instancesOf } from "@/lib/studio/components";

import { useArtboardNames } from "../artboard-names";
import { IconButton } from "../controls";
import { useActiveArtboard, useImageDoc, useImageEditor } from "../editor-state";

export function ComponentsList() {
  const t = useTranslations("studio.image.components");
  const { commands } = useImageEditor();
  const document = useImageDoc((s) => s.document);
  const active = useActiveArtboard();
  const names = useArtboardNames();
  const components = document.artboards.filter((a) => a.component);
  return (
    <section className="space-y-2">
      <h3 className="legend text-muted-foreground">{t("title")}</h3>
      {components.length === 0 ? <p className="text-xs text-muted-foreground">{t("empty")}</p> : null}
      {components.length > 0 && active.component ? <p className="text-xs text-muted-foreground">{t("insideComponent")}</p> : null}
      <ul className="space-y-1">
        {components.map((component) => {
          const name = names.get(component.id) ?? component.id;
          return (
            <li key={component.id} className="flex items-center gap-1">
              <button
                type="button"
                disabled={Boolean(active.component)}
                onClick={() => void commands.addInstance(component.id)}
                aria-label={t("insert", { name })}
                className="flex min-w-0 flex-1 items-center gap-2 rounded-[--radius] border border-border bg-card px-2 py-1.5 text-left transition-colors hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
              >
                <PuzzlePiece className="h-4 w-4 shrink-0 text-primary" weight="fill" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">{name}</span>
                <span className="readout shrink-0 text-2xs text-muted-foreground">{t("uses", { count: instancesOf(document, component.id).length })}</span>
              </button>
              <IconButton label={t("goTo", { name })} onClick={() => commands.showComponent(component.id)} className="text-muted-foreground">
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
              </IconButton>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
