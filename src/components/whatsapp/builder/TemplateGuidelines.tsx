"use client";

import { useTranslations } from "next-intl";

import { PanelSection } from "@/components/dashboard/PanelSection";
import { Check } from "@/components/icons";
import type { DraggableComponent } from "@/components/whatsapp/DragDropBuilder";

const GUIDELINE_KEYS = ["variables", "position", "examples", "completeSentence", "footer"];

export function TemplateGuidelines({ components }: { components: DraggableComponent[] }) {
  const t = useTranslations("whatsappTemplates");
  const hasCallComponent = components.some((c) => c.type === "CALL_PERMISSION_REQUEST");
  const keys = hasCallComponent ? [...GUIDELINE_KEYS, "callPermission"] : GUIDELINE_KEYS;
  return (
    <PanelSection title={t("new.guidelines.title")} description={t("new.guidelines.subtitle")}>
      <ul className="grid gap-x-8 gap-y-2.5 md:grid-cols-2">
        {keys.map((key) => (
          <li key={key} className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
            <Check className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-foreground" weight="bold" aria-hidden />
            <span>{t(`new.guidelines.${key}`)}</span>
          </li>
        ))}
      </ul>
    </PanelSection>
  );
}
