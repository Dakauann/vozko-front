"use client";

import { useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import { CaretLeft, CaretRight } from "@/components/icons";

import { useGroupsFormat } from "./use-groups-format";

export function PagedFooter({
  page,
  totalPages,
  totalItems,
  itemsLabel,
  onPage,
  busy,
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  itemsLabel: (n: number) => string;
  onPage: (p: number) => void;
  busy?: boolean;
}) {
  const t = useTranslations("unofficialGroups.kit.paged");
  const fmt = useGroupsFormat();
  if (totalPages <= 1) return null;
  return (
    <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-2.5">
      <p className="readout text-2xs text-muted-foreground">
        {t("status", { page: fmt.num(page), total: fmt.num(totalPages), items: itemsLabel(totalItems) })}
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          icon={<CaretLeft />}
          iconVisible
          aria-label={t("previous")}
          disabled={busy || page <= 1}
          onClick={() => onPage(page - 1)}
        />
        <Button
          variant="ghost"
          size="icon"
          icon={<CaretRight />}
          iconVisible
          aria-label={t("next")}
          disabled={busy || page >= totalPages}
          onClick={() => onPage(page + 1)}
        />
      </div>
    </div>
  );
}
