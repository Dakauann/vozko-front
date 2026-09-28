"use client";

import { CaretLeft, CaretRight } from "@/components/icons";

export function ChannelListStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="whitespace-nowrap text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold tabular-nums text-foreground">{value}</span>
    </div>
  );
}

export function ChannelListPagination({
  page,
  totalPages,
  loading,
  labels,
  onPage,
}: {
  page: number;
  totalPages: number;
  loading: boolean;
  labels: { pageOf: string; previous: string; next: string };
  onPage: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-4 px-1">
      <span className="text-xs text-muted-foreground">{labels.pageOf}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 1 || loading}
          onClick={() => onPage(page - 1)}
          className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
        >
          <CaretLeft className="h-3.5 w-3.5" weight="bold" />
          {labels.previous}
        </button>
        <button
          type="button"
          disabled={page >= totalPages || loading}
          onClick={() => onPage(page + 1)}
          className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
        >
          {labels.next}
          <CaretRight className="h-3.5 w-3.5" weight="bold" />
        </button>
      </div>
    </div>
  );
}
