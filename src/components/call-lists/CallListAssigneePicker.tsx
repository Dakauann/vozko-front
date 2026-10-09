"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { ElevatedCommandSelect } from "@/components/elevated-design/elevated-command-select";
import { X } from "@/components/icons";
import { useMemberDirectory, useMemberSearch } from "@/components/leads/use-member-search";
import { memberDisplayName } from "@/hooks/use-assignable-members";

export function useMemberNames() {
  const { readable, ownerName } = useMemberDirectory();
  return { name: (userId: string) => ownerName(userId) ?? userId, readable };
}

export function CallListAssigneePicker({
  assigneeIds,
  onChange,
  disabled = false,
}: {
  assigneeIds: readonly string[];
  onChange: (assigneeIds: string[]) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("callLists.assignees");
  const { readable, ownerName, setSearch, found, searching } = useMemberSearch();
  const [picked, setPicked] = useState<ReadonlyMap<string, string>>(new Map());

  const nameOf = (userId: string) => picked.get(userId) ?? ownerName(userId) ?? userId;

  const options = useMemo(
    () =>
      found.members
        .filter((member) => !assigneeIds.includes(member.userId))
        .map((member) => ({ value: member.userId, label: memberDisplayName(member) })),
    [found.members, assigneeIds],
  );

  if (!readable) {
    return <p className="text-sm text-muted-foreground">{t("noMembersPermission")}</p>;
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">{t("label")}</p>
      {assigneeIds.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5" aria-label={t("label")}>
          {assigneeIds.map((userId) => {
            const name = nameOf(userId);
            return (
              <li key={userId} className="inline-flex items-center gap-1 rounded-[--radius] border border-border bg-muted py-0.5 pl-2.5 pr-1 text-xs font-medium text-foreground">
                {name}
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange(assigneeIds.filter((id) => id !== userId))}
                  aria-label={t("remove", { name })}
                  className="inline-flex size-5 items-center justify-center rounded-[--radius] text-muted-foreground hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                >
                  <X className="h-3 w-3" weight="bold" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">{t("none")}</p>
      )}
      <ElevatedCommandSelect
        label={t("add")}
        options={options}
        value={null}
        onValueChange={(value, option) => {
          setPicked((current) => new Map(current).set(value, option.label));
          onChange([...assigneeIds, value]);
        }}
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
