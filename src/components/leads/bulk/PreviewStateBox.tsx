"use client";

import { useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { cn } from "@/lib/utils";

const BOX = "rounded-[--radius] border border-border bg-muted px-3 py-2.5 text-sm";

export type PreviewState = { refusal: string; onRetry: () => void } | { pending: string };

export function PreviewStateBox(props: PreviewState) {
  const t = useTranslations("leadsPage.bulk.dialog");
  if ("refusal" in props) {
    return (
      <div role="alert" className={cn("flex flex-wrap items-center justify-between gap-2", BOX)}>
        <span className="text-destructive-ink">{props.refusal}</span>
        <Button variant="secondary" size="sm" title={t("retry")} onClick={props.onRetry} />
      </div>
    );
  }
  return (
    <p role="status" className={cn(BOX, "text-muted-foreground")}>
      {props.pending}
    </p>
  );
}

export function TypedCountConfirm({ count, value, onChange }: { count: number; value: string; onChange: (value: string) => void }) {
  const t = useTranslations("leadsPage.bulk.dialog");
  return (
    <ElevatedInput
      label={t("typeCount", { count })}
      placeholder=" "
      inputMode="numeric"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
