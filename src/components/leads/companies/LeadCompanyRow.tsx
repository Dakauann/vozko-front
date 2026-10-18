"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { EmptyValue } from "@/components/elevated-design/empty-value";
import { Buildings } from "@/components/icons";
import { DetailRow } from "@/components/leads/detail/DetailRow";
import { useWorkspace } from "@/contexts/workspace-context";
import { useLeadCompany } from "@/hooks/use-lead-companies";
import { isMissingSection } from "@/hooks/use-lead-records";
import { companyMembersHref } from "@/lib/leads/companies";
import { pathForScreen } from "@/lib/navigation/routes";

import { CompanyAvatar } from "./CompanyAvatar";

export function LeadCompanyRow({ companyId }: { companyId?: string }) {
  const t = useTranslations("leadDetail.company");
  const { can } = useWorkspace();
  const company = useLeadCompany(companyId ?? "");
  if (!can("lead_companies", "read")) return null;

  const muted = (text: string) => <span className="font-normal text-muted-foreground">{text}</span>;
  const leadsPath = pathForScreen("leads");
  const shown = company.data;

  return (
    <DetailRow
      icon={<Buildings />}
      label={t("label")}
      hint={shown && !shown.acceptsLeads ? t("closed") : undefined}
      action={
        shown && leadsPath ? (
          <Link href={companyMembersHref(leadsPath, shown.id)} className="text-xs font-medium text-primary hover:underline">
            {t("members")}
          </Link>
        ) : undefined
      }
    >
      {!companyId ? (
        muted(t("none"))
      ) : shown ? (
        <span className="inline-flex items-center gap-2">
          <CompanyAvatar company={shown} size="sm" />
          {shown.name}
        </span>
      ) : company.isError ? (
        isMissingSection(company.error) ? muted(t("gone")) : <EmptyValue />
      ) : (
        muted("…")
      )}
    </DetailRow>
  );
}
