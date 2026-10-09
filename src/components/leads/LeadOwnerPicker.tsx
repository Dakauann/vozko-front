"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

import { ElevatedCommandSelect } from "@/components/elevated-design/elevated-command-select";
import { useMemberSearch } from "@/components/leads/use-member-search";
import { memberDisplayName } from "@/hooks/use-assignable-members";

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
  const { ownerName, setSearch, found, searching } = useMemberSearch();
  const currentName = ownerId ? ownerName(ownerId) : null;

  const options = useMemo(() => {
    const members = found.members.map((member) => ({ value: member.userId, label: memberDisplayName(member) }));
    const current = ownerId && !members.some((option) => option.value === ownerId) ? [{ value: ownerId, label: currentName ?? ownerId }] : [];
    return [{ value: NO_OWNER, label: t("none") }, ...current, ...members];
  }, [found.members, ownerId, currentName, t]);

  return (
    <div className="space-y-1">
      <ElevatedCommandSelect
        label={t("label")}
        options={options}
        value={ownerId === null ? null : ownerId || NO_OWNER}
        onValueChange={(value) => onChange(value === NO_OWNER ? "" : value)}
        onSearch={setSearch}
        isLoading={searching}
        searchPlaceholder={t("search")}
        emptyMessage={t("empty")}
        disabled={disabled}
        fullWidth
      />
      {found.failed ? <p className="pl-1 text-xs text-destructive-ink">{t("membersFailed")}</p> : null}
    </div>
  );
}
