"use client";

import { useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import {
  DownloadSimple,
  FileText,
  Table,
} from "@/components/icons";
import type { Icon } from "@/components/icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ReportFormat } from "@/lib/reports/types";

const FORMAT_ICON: Record<ReportFormat, Icon> = {
  csv: Table,
  xlsx: Table,
  pdf: FileText,
};

export function ExportMenu({
  formats,
  onSelect,
  busy = false,
  disabled = false,
}: {
  formats: readonly ReportFormat[];
  onSelect: (format: ReportFormat) => void;
  busy?: boolean;
  disabled?: boolean;
}) {
  const t = useTranslations("metricsOps.export");

  if (formats.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled || busy}>
        <Button
          icon={<DownloadSimple className="h-4 w-4" weight="bold" />}
          iconVisible
          title={t("button")}
          variant="command"
          disabled={disabled || busy}
        >
          <span className="max-sm:sr-only">
            {busy ? t("preparing") : t("button")}
          </span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="min-w-[13rem]">
        {formats.map((format) => {
          const FormatIcon = FORMAT_ICON[format];
          return (
            <DropdownMenuItem
              key={format}
              onSelect={() => onSelect(format)}
              className="flex cursor-pointer items-start gap-2.5"
            >
              <FormatIcon className="mt-0.5 h-4 w-4 shrink-0" weight="bold" />
              <span className="min-w-0">
                <span className="block text-sm">{t(`format.${format}.label`)}</span>
                <span className="block text-2xs text-muted-foreground">
                  {t(`format.${format}.hint`)}
                </span>
              </span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
