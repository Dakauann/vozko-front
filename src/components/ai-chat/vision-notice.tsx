"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

import { Eye } from "@/components/icons";
import { Notice } from "@/components/ui/notice";
import type { ModelPricingInfo } from "@/lib/agents/types";
import { recommendModel } from "@/lib/ai-models/capabilities";
import { ELO_SURFACE } from "@/lib/ai-models/surfaces";
import { blindModelNeed, visionNeed } from "@/lib/ai-models/vision-need";
import type { ChatAttachment } from "@/lib/aichat/types";

import { useAssistantContext } from "./assistant-context";

const NOTICE_ACTION =
  "rounded-[--radius] px-2 py-1 text-xs font-medium transition-colors duration-DEFAULT focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function ChatVisionNotice({
  model,
  models,
  pricing,
  onModelChange,
  attachments,
}: {
  model: string;
  models: string[];
  pricing: ModelPricingInfo[];
  onModelChange: (model: string) => void;
  attachments: ChatAttachment[];
}) {
  const t = useTranslations("modelPicker.vision");
  const context = useAssistantContext();
  const pathname = usePathname();
  const [dismissed, setDismissed] = useState<string | null>(null);
  const need = blindModelNeed(model, pricing, visionNeed({ studio: context?.kind === "studio", pathname, attachments }));
  const key = need ? `${model}:${need}` : null;
  if (!need || dismissed === key) return null;

  const recommended = recommendModel(models, pricing, ["vision", ...ELO_SURFACE.requires]);
  const recommendedName = recommended ? pricing.find((info) => info.id === recommended)?.name || recommended : null;

  return (
    <Notice tone="warning" title={t("title")} icon={<Eye weight="fill" />} className="mb-2">
      <p>{t(need)}</p>
      <div className="flex flex-wrap items-center gap-1.5 pt-1">
        {recommended && recommendedName ? (
          <button type="button" onClick={() => onModelChange(recommended)} className={`${NOTICE_ACTION} bg-card text-foreground hover:bg-muted`}>
            {t("switch", { model: recommendedName })}
          </button>
        ) : (
          <span>{t("pick")}</span>
        )}
        <button type="button" onClick={() => setDismissed(key)} className={`${NOTICE_ACTION} text-muted-foreground hover:text-foreground`}>
          {t("dismiss")}
        </button>
      </div>
    </Notice>
  );
}
