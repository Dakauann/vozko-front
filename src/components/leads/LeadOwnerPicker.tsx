"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

import { MemberCommandSelect } from "@/components/members/MemberCommandSelect";

const NO_OWNER = "__no_owner__";

export function LeadOwnerPicker({
  ownerId,
  onChange,
  disabled = false,
}: {
  ownerId: string | null;
  onChange: (ownerId: string) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("leadsPage.owner");
  const none = useMemo(() => [{ value: NO_OWNER, label: t("none") }], [t]);
  return (
    <MemberCommandSelect
      value={ownerId ?? ""}
      selectedValue={ownerId === null ? null : ownerId || NO_OWNER}
      onChange={(value) => onChange(value === NO_OWNER ? "" : value)}
      text={{ label: t("label"), search: t("search"), empty: t("empty"), failed: t("membersFailed") }}
      leadingOptions={none}
      disabled={disabled}
    />
  );
}
