"use client";

import { useTranslations } from "next-intl";

import { ElevatedPillToggle } from "@/components/elevated-design/elevated-pill-toggle";
import { MapTrifold, Table } from "@/components/icons";
import type { LeadView } from "@/lib/leads/map-view";

export function LeadViewToggle({ value, onChange, className }: { value: LeadView; onChange: (view: LeadView) => void; className?: string }) {
  const t = useTranslations("leadsPage.view");
  return (
    <ElevatedPillToggle<LeadView>
      aria-label={t("label")}
      value={value}
      onChange={onChange}
      size="md"
      className={className}
      options={[
        { value: "table", label: t("table"), icon: <Table size={14} aria-hidden="true" /> },
        { value: "map", label: t("map"), icon: <MapTrifold size={14} aria-hidden="true" /> },
      ]}
    />
  );
}
