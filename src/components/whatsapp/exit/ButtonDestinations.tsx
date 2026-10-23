"use client";

import { useTranslations } from "next-intl";

import { OptionCtr } from "@/components/choice-stats/OptionCtr";
import { CircuitRoutes } from "@/components/elevated-design/circuit-routes";
import { optionStatsOf, type PromptStats } from "@/lib/choice-stats/stats";
import { templateButtonOptionId } from "@/lib/choice-stats/template-options";
import type { ButtonChoices, ButtonRoute } from "@/lib/whatsapp-templates/exit";

import { QuickReplyChip, RouteTarget } from "./ButtonRoutePieces";
import { useButtonActionLabel } from "./use-button-action-label";

function destinationOf(button: ButtonRoute, overrides: ButtonChoices) {
  const override = button.index in overrides ? overrides[button.index] : null;
  return override ?? (button.stale ? null : button.action);
}

export function QuickReplyCtr({ clicks, index }: { clicks: PromptStats; index: number }) {
  return <OptionCtr option={optionStatsOf(clicks, templateButtonOptionId(index))} className="text-2xs font-medium" />;
}

export function ButtonDestinations({ buttons, overrides = {}, clicks }: { buttons: ButtonRoute[]; overrides?: ButtonChoices; clicks?: PromptStats | null }) {
  const t = useTranslations("templateExit.campaign");
  const labelOf = useButtonActionLabel();
  if (buttons.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-foreground">{t("destinations")}</p>
      <CircuitRoutes
        label={t("destinations")}
        headings={{ source: t("columnButton"), target: t("columnAction") }}
        routes={buttons.map((button) => {
          const destination = destinationOf(button, overrides);
          const action = labelOf(destination);
          return {
            key: button.index,
            name: t("destination", { text: button.text, action }),
            state: destination ? "linked" : button.stale ? "stale" : "open",
            source: <QuickReplyChip text={button.text} stale={button.stale && !destination} stat={clicks ? <QuickReplyCtr clicks={clicks} index={button.index} /> : undefined} />,
            target: <RouteTarget label={destination ? action : t("noActionOutcome")} open={!destination} />,
          };
        })}
      />
    </div>
  );
}
