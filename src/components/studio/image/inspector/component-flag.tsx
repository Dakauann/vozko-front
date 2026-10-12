"use client";

import { useTranslations } from "next-intl";

import { instancesOf } from "@/lib/studio/components";

import { InspectorSection, SwitchRow } from "../controls";
import { useActiveArtboard, useImageDoc, useImageEditor } from "../editor-state";

export function ComponentFlag() {
  const t = useTranslations("studio.image.components");
  const { commands } = useImageEditor();
  const artboard = useActiveArtboard();
  const document = useImageDoc((s) => s.document);
  const hosts = artboard.layers.some((l) => l.type === "instance");
  const uses = artboard.component ? instancesOf(document, artboard.id).length : 0;
  return (
    <InspectorSection title={t("flag")}>
      <SwitchRow label={t("flagLabel")} checked={Boolean(artboard.component)} disabled={hosts && !artboard.component} onChange={(on) => void commands.setComponent(artboard.id, on)} />
      <p className="text-2xs text-muted-foreground">{hosts && !artboard.component ? t("flagBlocked") : artboard.component ? t("uses", { count: uses }) : t("flagHint")}</p>
    </InspectorSection>
  );
}
