"use client";

import { Kanban, List, Table } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { ElevatedPillToggle } from "@/components/elevated-design/elevated-pill-toggle";

export type CrmViewMode = "classic" | "funnel" | "table";

interface CrmViewSwitcherProps {
  mode: CrmViewMode;
  onChange: (mode: CrmViewMode) => void;
  // "Tabela" (the data grid) exists only on the workspace-global CRM; the
  // per-campaign attendance UI keeps just Lista (the WhatsApp-like inbox) and
  // Kanban, so the classic inbox is never replaced.
  showTable?: boolean;
}

export default function CrmViewSwitcher({
  mode,
  onChange,
  showTable = false,
}: CrmViewSwitcherProps) {
  const t = useTranslations("crmBoard");

  const options = [
    {
      value: "classic" as const,
      label: t("view.chat"),
      icon: (
        <List
          weight={mode === "classic" ? "bold" : "regular"}
          className="h-3.5 w-3.5"
        />
      ),
    },
    {
      value: "funnel" as const,
      label: t("view.kanban"),
      icon: (
        <Kanban
          weight={mode === "funnel" ? "bold" : "regular"}
          className="h-3.5 w-3.5"
        />
      ),
    },
    ...(showTable
      ? [
          {
            value: "table" as const,
            label: t("view.table"),
            icon: (
              <Table
                weight={mode === "table" ? "bold" : "regular"}
                className="h-3.5 w-3.5"
              />
            ),
          },
        ]
      : []),
  ];

  return (
    <ElevatedPillToggle
      options={options}
      value={mode}
      onChange={onChange}
      size="md"
      collapseLabels="md"
      aria-label={t("toolbar.switchView")}
    />
  );
}
