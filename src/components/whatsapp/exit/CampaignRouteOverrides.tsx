"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { CaretDown, CaretRight } from "@/components/icons";
import { CircuitRoutes } from "@/components/elevated-design/circuit-routes";
import { isExitKind, type ButtonActionChoice, type ButtonActionKind, type ButtonChoices, type ButtonRoute } from "@/lib/whatsapp-templates/exit";

import { ButtonActionFields } from "./ButtonActionFields";
import { QuickReplyChip, RouteCard } from "./ButtonRoutePieces";
import { useButtonActionLabel } from "./use-button-action-label";

function RouteOverride({
  button,
  value,
  kinds,
  onChange,
}: {
  button: ButtonRoute;
  value: ButtonActionChoice | null;
  kinds: readonly ButtonActionKind[];
  onChange: (next: ButtonActionChoice | null) => void;
}) {
  const t = useTranslations("templateExit.campaign");
  const labelOf = useButtonActionLabel();
  const [open, setOpen] = useState(value !== null);
  const Caret = open ? CaretDown : CaretRight;
  const destination = value ?? (button.stale ? null : button.action);
  return (
    <RouteCard>
      {destination ? (
        <p className="text-sm font-medium text-foreground">{labelOf(destination)}</p>
      ) : (
        <p className="text-sm text-muted-foreground">{t("noActionOutcome")}</p>
      )}
      <button
        type="button"
        aria-expanded={open}
        aria-label={t("overrideToggle", { text: button.text })}
        onClick={() => setOpen((current) => !current)}
        className="inline-flex items-center gap-1.5 text-left text-xs font-medium text-foreground underline-offset-4 hover:underline"
      >
        <Caret className="h-3 w-3 shrink-0 text-muted-foreground" weight="bold" aria-hidden />
        {t("overrideShort")}
      </button>
      {open ? (
        <div className="space-y-2">
          <ButtonActionFields value={value} kinds={kinds} onChange={onChange} />
          <p className="text-xs text-muted-foreground">{t("overrideHint")}</p>
        </div>
      ) : null}
    </RouteCard>
  );
}

export function CampaignRouteOverrides({
  buttons,
  overrides,
  kinds,
  onChange,
}: {
  buttons: ButtonRoute[];
  overrides: ButtonChoices;
  kinds: readonly ButtonActionKind[];
  onChange: (index: number, choice: ButtonActionChoice | null) => void;
}) {
  const t = useTranslations("templateExit.campaign");
  const labelOf = useButtonActionLabel();
  const routable = buttons.filter((button) => !(button.action && isExitKind(button.action.kind)));
  if (routable.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-foreground">{t("destinations")}</p>
      <CircuitRoutes
        label={t("destinations")}
        headings={{ source: t("columnButton"), target: t("columnAction") }}
        routes={routable.map((button) => {
          const value = overrides[button.index] ?? null;
          const destination = value ?? (button.stale ? null : button.action);
          return {
            key: button.index,
            name: t("destination", { text: button.text, action: labelOf(destination) }),
            state: destination ? "linked" : button.stale ? "stale" : "open",
            source: <QuickReplyChip text={button.text} stale={button.stale && !value} />,
            target: <RouteOverride button={button} value={value} kinds={kinds} onChange={(next) => onChange(button.index, next)} />,
          };
        })}
      />
    </div>
  );
}
