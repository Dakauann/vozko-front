"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

import type { DraggableComponent } from "@/components/whatsapp/DragDropBuilder";
import WhatsAppPreview from "@/components/whatsapp/WhatsAppPreview";

export function TemplateDraftPreview({
  components,
  templateName,
  language,
  children,
}: {
  components: DraggableComponent[];
  templateName: string;
  language: string;
  children?: ReactNode;
}) {
  const t = useTranslations("whatsappTemplates");
  return (
    <aside data-tour="wt-preview" className="min-w-0 space-y-3 xl:sticky xl:top-16">
      <div>
        <h2 className="font-display text-base font-semibold leading-tight tracking-[-0.01em] text-foreground">
          {t("new.preview")}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">{t("new.previewHint")}</p>
      </div>

      <div className="mx-auto w-full max-w-[22rem] rounded-[1.75rem] border border-border-strong bg-card p-2 shadow-lg">
        <div className="h-[min(34rem,calc(100vh-17rem))] min-h-[24rem] overflow-hidden rounded-[1.25rem]">
          <WhatsAppPreview components={components} templateName={templateName} language={language} />
        </div>
      </div>

      {children}
    </aside>
  );
}
