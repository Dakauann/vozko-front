"use client";

import { useTranslations } from "next-intl";

import { Family, Plus } from "@/components/icons";
import { ScreenLoader } from "@/components/brand/screen-loader";
import { PanelSection } from "@/components/dashboard/PanelSection";
import { SectionState } from "@/components/dashboard/attendance/section-state";
import Button from "@/components/elevated-design/button";
import { RelativeLines } from "@/components/leads/RelativeLines";
import { useLeadRelatives } from "@/hooks/use-lead-records";
import type { LeadRelative } from "@/lib/leads/types";

import { PagedListFooter, pagedSectionState } from "./PagedListFooter";

function RelativeRow({ relative }: { relative: LeadRelative }) {
  const t = useTranslations("leadSheet.family");
  return (
    <li className="flex items-start gap-4 border-b border-border py-2.5 last:border-0">
      <span className="w-28 shrink-0 sm:w-40 text-sm text-muted-foreground">{t(`kinds.${relative.kind}`)}</span>
      <span className="min-w-0 flex-1">
        <RelativeLines name={relative.name} number={relative.number} href={`/dashboard/leads/${relative.leadId}`} />
      </span>
    </li>
  );
}

export function LeadFamilyTab({ leadId, total, onAdd }: { leadId: string; total: number; onAdd?: () => void }) {
  const t = useTranslations("leadDetail.family");
  const query = useLeadRelatives(leadId, true);
  const relatives = query.data?.pages.flatMap((page) => page.items) ?? [];
  const empty = query.isSuccess && relatives.length === 0;

  const addButton = onAdd ? (
    <Button variant="secondary" size="sm" icon={<Plus className="h-3.5 w-3.5" weight="bold" />} iconVisible iconSide="left" title={t("add")} onClick={onAdd} />
  ) : null;

  return (
    <PanelSection
      title={t("title")}
      legend={total > 0 ? t("count", { count: total }) : undefined}
      actions={empty ? undefined : addButton ?? undefined}
    >
      <SectionState query={pagedSectionState(query)}>
        {query.isPending ? (
          <ScreenLoader fit="inline" />
        ) : empty ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Family className="h-4 w-4" aria-hidden />
              {t("empty")}
            </p>
            {addButton}
          </div>
        ) : (
          <>
            <ul>
              {relatives.map((relative) => (
                <RelativeRow key={relative.relationId} relative={relative} />
              ))}
            </ul>
            <PagedListFooter
              query={query}
              pageSizes={query.data?.pages.map((page) => page.items.length) ?? []}
              loadMore={t("loadMore")}
              loadingMore={t("loadingMore")}
            />
          </>
        )}
      </SectionState>
    </PanelSection>
  );
}
