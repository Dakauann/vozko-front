"use client";

import { useTranslations } from "next-intl";

import { ElevatedSelect, ElevatedSelectItem } from "@/components/elevated-design/elevated-select";
import ElevatedTextarea from "@/components/elevated-design/elevated-textarea";
import type { ButtonActionChoice, ButtonActionKind } from "@/lib/whatsapp-templates/exit";

import { ButtonActionParamsFields } from "./ButtonActionParamsFields";

const NO_ACTION = "none";

export function ButtonActionFields({
  value,
  onChange,
  kinds,
  allowNone = true,
  label,
}: {
  value: ButtonActionChoice | null;
  onChange: (next: ButtonActionChoice | null) => void;
  kinds: readonly ButtonActionKind[];
  allowNone?: boolean;
  label?: string;
}) {
  const t = useTranslations("templateExit");
  const listed = value && !kinds.includes(value.kind) ? [...kinds, value.kind] : kinds;
  const name = label ?? t("action.label");

  const choose = (next: string) => {
    if (next === NO_ACTION) {
      onChange(null);
      return;
    }
    onChange({ kind: next as ButtonActionKind, params: {}, confirmation: value?.confirmation ?? "" });
  };

  return (
    <div className="space-y-3">
      <ElevatedSelect label={name} aria-label={name} value={value?.kind ?? (allowNone ? NO_ACTION : "")} onValueChange={choose} contentClassName="z-[200]">
        {allowNone ? <ElevatedSelectItem value={NO_ACTION}>{t("kinds.none")}</ElevatedSelectItem> : null}
        {listed.map((kind) => (
          <ElevatedSelectItem key={kind} value={kind}>
            {t(`kinds.${kind}`)}
          </ElevatedSelectItem>
        ))}
      </ElevatedSelect>
      {value ? (
        <>
          <ButtonActionParamsFields kind={value.kind} params={value.params} onChange={(params) => onChange({ ...value, params })} />
          <div className="space-y-1">
            <ElevatedTextarea
              label={t("action.confirmation")}
              value={value.confirmation}
              rows={2}
              onChange={(event) => onChange({ ...value, confirmation: event.target.value })}
            />
            <p className="text-xs text-muted-foreground">{t("action.confirmationHint")}</p>
          </div>
        </>
      ) : null}
    </div>
  );
}
