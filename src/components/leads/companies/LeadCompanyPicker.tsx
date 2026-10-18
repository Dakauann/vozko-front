"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { ElevatedCommandSelect, type ElevatedCommandOption } from "@/components/elevated-design/elevated-command-select";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useLeadCompaniesPage, useLeadCompany } from "@/hooks/use-lead-companies";
import type { LeadCompany } from "@/lib/leads/companies";

import { CompanyAvatar } from "./CompanyAvatar";

const NO_COMPANY = "__no_company__";
const SEARCH_DEBOUNCE_MS = 300;
const PICKER_PAGE_SIZE = 20;

export function LeadCompanyPicker({ companyId, onChange, disabled = false }: { companyId: string; onChange: (companyId: string) => void; disabled?: boolean }) {
  const t = useTranslations("leadSheet.company");
  const [search, setSearch] = useState("");
  const term = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS);
  const page = useLeadCompaniesPage({ page: 1, pageSize: PICKER_PAGE_SIZE, search: term });
  const current = useLeadCompany(companyId);

  const options = useMemo(() => {
    const option = (company: LeadCompany): ElevatedCommandOption => ({
      value: company.id,
      label: company.name,
      icon: <CompanyAvatar company={company} size="sm" />,
      description: company.acceptsLeads ? undefined : t("closed"),
      disabled: !company.acceptsLeads && company.id !== companyId,
    });
    const found = page.data?.items ?? [];
    const kept = current.data && !found.some((company) => company.id === current.data.id) ? [current.data] : [];
    return [{ value: NO_COMPANY, label: t("none") }, ...kept.map(option), ...found.map(option)];
  }, [page.data, current.data, companyId, t]);

  return (
    <div className="space-y-1">
      <ElevatedCommandSelect
        label={t("label")}
        options={options}
        value={companyId || NO_COMPANY}
        onValueChange={(value) => onChange(value === NO_COMPANY ? "" : value)}
        onSearch={setSearch}
        isLoading={page.isFetching && !page.data}
        searchPlaceholder={t("search")}
        emptyMessage={t("empty")}
        disabled={disabled}
        fullWidth
      />
      {page.isError ? <p className="pl-1 text-xs text-destructive-ink">{t("failed")}</p> : null}
    </div>
  );
}
