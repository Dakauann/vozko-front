"use client";

import { CaretLeft, CaretRight } from "@/components/icons";
import ElevatedButton from "@/components/elevated-design/button";
import { cn } from "@/lib/utils";

export function ListPager({
  page,
  totalPages,
  onPage,
  disabled = false,
  previousLabel,
  nextLabel,
  pageLabel,
  className,
}: {
  page: number;
  totalPages: number;
  onPage: (page: number) => void;
  disabled?: boolean;
  previousLabel: string;
  nextLabel: string;
  pageLabel: string;
  className?: string;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className={cn("flex items-center justify-between gap-2 text-2xs text-muted-foreground", className)}>
      <ElevatedButton
        variant="ghost"
        size="sm"
        iconVisible
        icon={<CaretLeft size={12} />}
        title={previousLabel}
        disabled={page <= 1 || disabled}
        onClick={() => onPage(Math.max(page - 1, 1))}
      />
      <span>{pageLabel}</span>
      <ElevatedButton
        variant="ghost"
        size="sm"
        iconVisible
        iconSide="right"
        icon={<CaretRight size={12} />}
        title={nextLabel}
        disabled={page >= totalPages || disabled}
        onClick={() => onPage(Math.min(page + 1, totalPages))}
      />
    </div>
  );
}
