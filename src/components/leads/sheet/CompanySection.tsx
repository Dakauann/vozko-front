"use client";

import { useTranslations } from "next-intl";

import { EmptyValue } from "@/components/elevated-design/empty-value";
import { Buildings } from "@/components/icons";
import { LeadCompanyPicker } from "@/components/leads/companies/LeadCompanyPicker";
import { useLeadCompany } from "@/hooks/use-lead-companies";

import { SheetHint, SheetSection } from "./SheetSection";

export function CompanySection({ companyId, canChange, onChange }: { companyId: string; canChange: boolean; onChange: (companyId: string) => void }) {
  const t = useTranslations("leadSheet.company");
  const company = useLeadCompany(canChange ? "" : companyId);

  return (
    <SheetSection icon={<Buildings />} title={t("title")} anchor="company">
      {canChange ? (
        <LeadCompanyPicker companyId={companyId} onChange={onChange} />
      ) : (
        <>
          <p className="pl-1 text-sm text-foreground">{company.data?.name ?? (companyId ? <EmptyValue /> : t("none"))}</p>
          <SheetHint>{t("readOnly")}</SheetHint>
        </>
      )}
    </SheetSection>
  );
}
