"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";

import { Checkbox } from "@/components/elevated-design/elevated-checkbox";
import { Notice } from "@/components/ui/notice";

const RISKS = ["policy", "quality", "lgpd"] as const;

export function ExitRiskList() {
  const t = useTranslations("templateExit.risk");
  return (
    <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
      {RISKS.map((risk) => (
        <li key={risk}>{t(risk)}</li>
      ))}
    </ul>
  );
}

export function ExitRiskAcknowledgement({
  checked,
  onCheckedChange,
  disabled,
  className,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}) {
  const t = useTranslations("templateExit.risk");
  const id = useId();
  return (
    <Notice tone="warning" title={t("title")} className={className}>
      <ExitRiskList />
      <div className="flex items-start gap-2 pt-2">
        <Checkbox
          id={id}
          checked={checked}
          disabled={disabled}
          onCheckedChange={(value) => onCheckedChange(value === true)}
          className="mt-0.5"
        />
        <label htmlFor={id} className="text-xs font-medium text-foreground">
          {t("confirm")}
        </label>
      </div>
      <p className="text-muted-foreground">{t("recorded")}</p>
    </Notice>
  );
}
